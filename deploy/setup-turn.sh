#!/usr/bin/env bash
# ============================================================
# LTropik TURN Server Setup (coturn)
# Run once on the VPS as root:
#   bash /opt/ltropik/repo/deploy/setup-turn.sh
# ============================================================
set -euo pipefail

DOMAIN="ltropik.duckdns.org"
TURN_USER="ltropik"
TURN_PASS="LTropikTURN2026!"   # ← legacy static fallback (unused when secret set)
# Shared secret for time-limited credentials. Read from the deployed backend
# config so coturn and the API always agree; override with TURN_SECRET=… if set.
APP_CFG="/opt/ltropik/backend/appsettings.Production.json"
TURN_SECRET="${TURN_SECRET:-$(grep -oP '"Secret"\s*:\s*"\K[^"]+' "$APP_CFG" 2>/dev/null)}"
TURN_PORT=3478
TURN_TLS_PORT=5349
TURN_MIN_PORT=49152
TURN_MAX_PORT=65535

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}✓ $*${RESET}"; }
warn() { echo -e "${YELLOW}⚠ $*${RESET}"; }

[[ $EUID -eq 0 ]] || { echo "Run as root"; exit 1; }

# ── 1. Install coturn ─────────────────────────────────────
echo "Installing coturn..."
apt-get update -qq
apt-get install -y -qq coturn
ok "coturn installed: $(turnserver --version 2>&1 | head -1)"

# ── 2. Detect external IP ──────────────────────────────────
EXTERNAL_IP=$(curl -s https://api.ipify.org || curl -s ifconfig.me)
ok "External IP: $EXTERNAL_IP"

# ── 2.5 TLS certificate (reuse the domain's Let's Encrypt cert) ───────────
# turns:5349 lets clients on locked-down networks (only 443/TLS allowed) connect.
# coturn runs as the 'turnserver' user and can't read /etc/letsencrypt directly,
# so we copy the cert to a readable spot and keep it fresh via a renewal hook.
LE_DIR="/etc/letsencrypt/live/$DOMAIN"
TLS_CONFIG="# TLS disabled — no Let's Encrypt cert found for $DOMAIN"
if [[ -f "$LE_DIR/fullchain.pem" && -f "$LE_DIR/privkey.pem" ]]; then
    mkdir -p /etc/coturn/certs
    cp "$LE_DIR/fullchain.pem" /etc/coturn/certs/cert.pem
    cp "$LE_DIR/privkey.pem"   /etc/coturn/certs/pkey.pem
    chown -R turnserver:turnserver /etc/coturn/certs
    chmod 600 /etc/coturn/certs/*.pem
    TLS_CONFIG="tls-listening-port=$TURN_TLS_PORT
cert=/etc/coturn/certs/cert.pem
pkey=/etc/coturn/certs/pkey.pem"

    # Auto-recopy certs after every renewal, then restart coturn
    mkdir -p /etc/letsencrypt/renewal-hooks/deploy
    cat > /etc/letsencrypt/renewal-hooks/deploy/coturn.sh << HOOK
#!/usr/bin/env bash
cp "$LE_DIR/fullchain.pem" /etc/coturn/certs/cert.pem
cp "$LE_DIR/privkey.pem"   /etc/coturn/certs/pkey.pem
chown -R turnserver:turnserver /etc/coturn/certs
chmod 600 /etc/coturn/certs/*.pem
systemctl restart coturn
HOOK
    chmod +x /etc/letsencrypt/renewal-hooks/deploy/coturn.sh
    ok "TLS enabled (turns:$TURN_TLS_PORT) using Let's Encrypt cert for $DOMAIN"
else
    warn "No Let's Encrypt cert at $LE_DIR — TLS (turns:$TURN_TLS_PORT) DISABLED."
    warn "Get one first:  certbot certonly --nginx -d $DOMAIN   then re-run this script."
fi

# ── 2.7 Auth mode: time-limited secret (preferred) or legacy static user ──
if [[ -n "$TURN_SECRET" && "$TURN_SECRET" != "CHANGE_ME_long_random_turn_shared_secret" ]]; then
    AUTH_CONFIG="# Time-limited credentials (shared secret with the backend)
use-auth-secret
static-auth-secret=$TURN_SECRET"
    ok "Auth: time-limited credentials (use-auth-secret)"
else
    AUTH_CONFIG="# Legacy static username/password
lt-cred-mech
user=$TURN_USER:$TURN_PASS"
    warn "Turn:Secret not set in $APP_CFG — falling back to STATIC password."
    warn "Set a long random Turn:Secret in appsettings, then re-run for secure ephemeral creds."
fi

# ── 3. Write config ────────────────────────────────────────
cat > /etc/turnserver.conf << EOF
# LTropik TURN server config
listening-port=$TURN_PORT
$TLS_CONFIG
listening-ip=0.0.0.0
external-ip=$EXTERNAL_IP
relay-ip=$EXTERNAL_IP

realm=$DOMAIN
server-name=$DOMAIN

$AUTH_CONFIG

# Ports for WebRTC relay streams
min-port=$TURN_MIN_PORT
max-port=$TURN_MAX_PORT

# Security
fingerprint
no-multicast-peers
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=::1

# Logs
log-file=/var/log/turnserver/turnserver.log
pidfile=/var/run/turnserver/turnserver.pid
EOF

ok "Config written to /etc/turnserver.conf"

# ── 4. Enable coturn to start at boot ─────────────────────
sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn 2>/dev/null || true
ok "coturn enabled"

# ── 5. Create log dir ──────────────────────────────────────
mkdir -p /var/log/turnserver /var/run/turnserver
chown turnserver:turnserver /var/log/turnserver /var/run/turnserver 2>/dev/null || true

# ── 6. Open firewall ports ────────────────────────────────
if command -v ufw &>/dev/null && ufw status | grep -q "active"; then
    ufw allow $TURN_PORT/udp comment "TURN UDP"
    ufw allow $TURN_PORT/tcp comment "TURN TCP"
    ufw allow $TURN_TLS_PORT/tcp comment "TURNS TLS"
    ufw allow $TURN_MIN_PORT:$TURN_MAX_PORT/udp comment "TURN relay ports"
    ok "UFW rules added"
else
    warn "UFW not active — open ports manually: $TURN_PORT/udp+tcp, $TURN_TLS_PORT/tcp, $TURN_MIN_PORT-$TURN_MAX_PORT/udp"
fi

# ── 7. Restart and verify ──────────────────────────────────
systemctl restart coturn
sleep 2

if systemctl is-active --quiet coturn; then
    ok "coturn is running!"
else
    echo "coturn failed to start. Check: journalctl -u coturn -n 30"
    exit 1
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════${RESET}"
echo -e "${GREEN} TURN server ready!${RESET}"
echo -e "${GREEN}   URL:  turn:$EXTERNAL_IP:$TURN_PORT${RESET}"
echo -e "${GREEN}   URL:  turn:$DOMAIN:$TURN_PORT${RESET}"
echo -e "${GREEN}   User: $TURN_USER${RESET}"
echo -e "${GREEN}   Pass: $TURN_PASS${RESET}"
echo -e "${GREEN}════════════════════════════════════════${RESET}"
echo ""
warn "Update ICE_SERVERS in useWebRTC.ts if you changed TURN_PASS"
