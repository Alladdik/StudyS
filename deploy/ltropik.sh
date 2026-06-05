#!/usr/bin/env bash
# =============================================================================
# LTropik Deploy Manager
# Usage:
#   bash ltropik.sh            → interactive menu
#   bash ltropik.sh setup      → first-time VPS setup
#   bash ltropik.sh update     → pull + build + deploy (CI/CD)
#   bash ltropik.sh status     → service + disk + version info
#   bash ltropik.sh logs       → live journal log
#   bash ltropik.sh restart    → restart backend
#   bash ltropik.sh backup     → backup media files
#   bash ltropik.sh rollback   → interactive rollback to previous commit
# =============================================================================
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
REPO_URL="https://github.com/Alladdik/StudyS.git"
BASE_DIR="/opt/ltropik"
REPO_DIR="$BASE_DIR/repo"
BACKEND_DIR="$BASE_DIR/backend"
FRONTEND_DIR="$BASE_DIR/frontend"
MEDIA_DIR="$BASE_DIR/media"
BACKUPS_DIR="$BASE_DIR/backups"
DP_KEYS_DIR="$BASE_DIR/dp-keys"
DEPLOY_LOG="$BASE_DIR/deploy.log"
LOCK_FILE="/tmp/ltropik_deploy.lock"

BACKEND_PORT=5090
SERVICE_NAME="ltropik-backend"
BACKEND_BIN="LTropik.WebAPI.dll"

# Frontend source (relative to REPO_DIR)
FRONTEND_SRC="ltropik-client"

# Backend source — the WebAPI project (relative to REPO_DIR)
BACKEND_SRC="src/LTropik.WebAPI"

# PostgreSQL
DB_NAME="ltropik"
DB_USER="ltropikuser"
DB_PASS="CHANGE_ME_secure_password"   # ← змінити перед першим setup!

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()    { echo -e "${BLUE}[$(date '+%H:%M:%S')]${RESET} $*" | tee -a "$DEPLOY_LOG"; }
ok()     { echo -e "${GREEN}✓${RESET} $*" | tee -a "$DEPLOY_LOG"; }
warn()   { echo -e "${YELLOW}⚠ $*${RESET}" | tee -a "$DEPLOY_LOG"; }
err()    { echo -e "${RED}✗ $*${RESET}" | tee -a "$DEPLOY_LOG"; exit 1; }
section(){ echo -e "\n${BOLD}${CYAN}══ $* ══${RESET}\n"; }

# ── Lock ──────────────────────────────────────────────────────────────────────
acquire_lock() {
    if mkdir "$LOCK_FILE" 2>/dev/null; then
        trap 'rm -rf "$LOCK_FILE"' EXIT INT TERM
    else
        err "Another deploy is in progress ($LOCK_FILE exists). Aborting."
    fi
}

# ── Wait for port ─────────────────────────────────────────────────────────────
wait_for_port() {
    local port=$1 timeout=${2:-30}
    log "Waiting for port $port (up to ${timeout}s)…"
    for ((i=0; i<timeout; i++)); do
        if nc -z 127.0.0.1 "$port" 2>/dev/null; then
            ok "Port $port is UP after ${i}s"
            return 0
        fi
        sleep 1
    done
    warn "Port $port did not respond in ${timeout}s — check: journalctl -u $SERVICE_NAME -n 50"
    return 1
}

# ── Git: pull latest ──────────────────────────────────────────────────────────
git_pull() {
    log "Fetching latest code…"
    cd "$REPO_DIR"
    git fetch origin
    local branch
    branch=$(git remote show origin | grep 'HEAD branch' | awk '{print $NF}')
    branch=${branch:-main}
    git reset --hard "origin/$branch"
    ok "Pulled branch: $branch ($(git rev-parse --short HEAD))"
}

# ── Build frontend ────────────────────────────────────────────────────────────
build_frontend() {
    section "Frontend build"
    local src="$REPO_DIR/$FRONTEND_SRC"
    [[ -f "$src/package.json" ]] || err "Frontend source not found: $src/package.json"
    cd "$src"
    log "npm install…"
    npm install --no-audit
    log "npm run build…"
    npm run build
    ok "Frontend built → $src/dist/"
}

# ── Build backend ─────────────────────────────────────────────────────────────
# Result path stored in global BACKEND_TMP (avoids $() capturing log output)
BACKEND_TMP=""
build_backend() {
    section "Backend build"
    local src="$REPO_DIR/$BACKEND_SRC"
    ls "$src"/*.csproj > /dev/null 2>&1 || err "Backend .csproj not found in: $src"
    BACKEND_TMP="/tmp/ltropik_build_$$"
    mkdir -p "$BACKEND_TMP"
    log "dotnet publish…"
    cd "$src"
    dotnet publish -c Release -o "$BACKEND_TMP" --nologo -v quiet
    ok "Backend compiled → $BACKEND_TMP"
}

# ── Deploy artifacts ──────────────────────────────────────────────────────────
deploy_artifacts() {
    local backend_tmp=$1
    section "Deploying artifacts"

    # Frontend: sync dist/ → /opt/ltropik/frontend/
    log "Syncing frontend…"
    rsync -a --delete "$REPO_DIR/$FRONTEND_SRC/dist/" "$FRONTEND_DIR/"
    ok "Frontend synced"

    # Backend: sync publish/ → /opt/ltropik/backend/ (never touch wwwroot or Production cfg)
    log "Syncing backend…"
    rsync -a --delete --exclude='wwwroot/' --exclude='appsettings.Production.json' "$backend_tmp/" "$BACKEND_DIR/"
    ok "Backend synced"
    rm -rf "$backend_tmp"

    # Ensure wwwroot → media symlink exists
    if [[ ! -L "$BACKEND_DIR/wwwroot" ]]; then
        ln -sfn "$MEDIA_DIR" "$BACKEND_DIR/wwwroot"
        ok "Created symlink: $BACKEND_DIR/wwwroot → $MEDIA_DIR"
    fi

    # Permissions
    chown -R www-data:www-data "$MEDIA_DIR" "$BACKEND_DIR" "$DP_KEYS_DIR" 2>/dev/null || true
    chmod -R 750 "$MEDIA_DIR" "$BACKEND_DIR" 2>/dev/null || true
    ok "Permissions set"
}

# ── Run EF Core migrations (optional) ────────────────────────────────────────
run_migrations() {
    section "Database migrations"
    # Migrations run automatically on startup via app code (MigrateAsync).
    # If you need manual control, uncomment:
    # cd "$REPO_DIR/$BACKEND_SRC"
    # dotnet ef database update --connection "Host=localhost;Database=$DB_NAME;Username=$DB_USER;Password=$DB_PASS"
    log "Migrations: handled automatically by the app on startup"
}

# ── action: update (main CI/CD deploy) ───────────────────────────────────────
action_update() {
    acquire_lock
    local start_time=$SECONDS
    echo "" >> "$DEPLOY_LOG"
    log "══════════ DEPLOY START $(date '+%Y-%m-%d %H:%M:%S') ══════════"

    git_pull
    build_backend
    build_frontend
    deploy_artifacts "$BACKEND_TMP"
    run_migrations

    section "Restarting service"
    systemctl restart "$SERVICE_NAME"
    ok "Service restarted"
    wait_for_port "$BACKEND_PORT" 30

    local elapsed=$((SECONDS - start_time))
    ok "══════════ DEPLOY DONE in ${elapsed}s ══════════"
    log "══════════ DEPLOY END $(date '+%Y-%m-%d %H:%M:%S') ══════════"
}

# ── action: setup (first-time VPS) ───────────────────────────────────────────
action_setup() {
    [[ $EUID -eq 0 ]] || err "Setup must run as root"
    section "First-time LTropik VPS Setup"

    # System packages
    log "Installing system packages…"
    apt-get update -qq
    apt-get install -y -qq rsync git curl wget netcat-openbsd unzip apt-transport-https

    # .NET 8
    if ! command -v dotnet &>/dev/null; then
        log "Installing .NET 8 SDK…"
        wget -q https://packages.microsoft.com/config/ubuntu/$(lsb_release -rs)/packages-microsoft-prod.deb \
            -O /tmp/packages-microsoft-prod.deb
        dpkg -i /tmp/packages-microsoft-prod.deb
        apt-get update -qq
        apt-get install -y -qq dotnet-sdk-8.0
        ok ".NET 8 installed: $(dotnet --version)"
    else
        ok ".NET already installed: $(dotnet --version)"
    fi

    # Node.js 20
    if ! command -v node &>/dev/null; then
        log "Installing Node.js 20…"
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y -qq nodejs
        ok "Node.js installed: $(node --version)"
    else
        ok "Node.js already installed: $(node --version)"
    fi

    # nginx
    if ! command -v nginx &>/dev/null; then
        log "Installing nginx…"
        apt-get install -y -qq nginx
        ok "nginx installed"
    fi

    # PostgreSQL
    if ! command -v psql &>/dev/null; then
        log "Installing PostgreSQL…"
        apt-get install -y -qq postgresql postgresql-contrib
        ok "PostgreSQL installed"
    fi

    # Redis
    if ! command -v redis-cli &>/dev/null; then
        log "Installing Redis…"
        apt-get install -y -qq redis-server
        systemctl enable redis-server
        systemctl start redis-server
        ok "Redis installed and started"
    else
        ok "Redis already installed"
    fi

    # Directory structure
    section "Creating directory structure"
    mkdir -p "$BASE_DIR"/{repo,backend,frontend,media,backups,dp-keys}
    mkdir -p "$MEDIA_DIR/uploads"
    chown -R www-data:www-data "$BASE_DIR"
    chmod -R 750 "$BASE_DIR"
    touch "$DEPLOY_LOG"
    ok "Directories created under $BASE_DIR"

    # PostgreSQL user + DB
    section "PostgreSQL setup"
    if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
        ok "DB user '$DB_USER' already exists"
    else
        sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
        ok "Created DB user: $DB_USER"
    fi
    if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
        ok "Database '$DB_NAME' already exists"
    else
        sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
        ok "Created database: $DB_NAME"
    fi

    # Clone repo
    section "Cloning repository"
    if [[ -d "$REPO_DIR/.git" ]]; then
        ok "Repo already cloned at $REPO_DIR"
    else
        git clone "$REPO_URL" "$REPO_DIR"
        ok "Repo cloned"
    fi

    # Production appsettings
    section "Production appsettings"
    local prod_cfg="$REPO_DIR/deploy/appsettings.Production.json"
    local dest_cfg="$BACKEND_DIR/appsettings.Production.json"
    if [[ -f "$dest_cfg" ]]; then
        ok "appsettings.Production.json already exists — skipping"
    elif [[ -f "$prod_cfg" ]]; then
        # Substitute DB_PASS placeholder
        sed "s|CHANGE_ME_secure_password|$DB_PASS|g" "$prod_cfg" > "$dest_cfg"
        chown www-data:www-data "$dest_cfg"
        chmod 640 "$dest_cfg"
        ok "appsettings.Production.json written to $dest_cfg"
        warn "→ Edit $dest_cfg to set JWT key, Telegram token, email, etc."
    else
        warn "deploy/appsettings.Production.json not found — skipping"
    fi

    # First build + deploy
    section "Initial build"
    action_update

    # systemd service
    section "Installing systemd service"
    local service_src="$REPO_DIR/deploy/$SERVICE_NAME.service"
    if [[ -f "$service_src" ]]; then
        cp "$service_src" "/etc/systemd/system/$SERVICE_NAME.service"
    else
        warn "Service file not found at $service_src — using inline template"
        cat > "/etc/systemd/system/$SERVICE_NAME.service" << EOF
[Unit]
Description=LTropik Backend (.NET 8)
After=network.target postgresql.service
[Service]
Type=notify
WorkingDirectory=$BACKEND_DIR
ExecStart=/usr/bin/dotnet $BACKEND_DIR/$BACKEND_BIN
Restart=on-failure
RestartSec=10s
User=www-data
Group=www-data
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=ASPNETCORE_URLS=http://0.0.0.0:$BACKEND_PORT
ReadWritePaths=$MEDIA_DIR $BACKEND_DIR $DP_KEYS_DIR /tmp
PrivateTmp=yes
NoNewPrivileges=yes
ProtectSystem=full
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME
[Install]
WantedBy=multi-user.target
EOF
    fi
    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    ok "Service installed and enabled"

    # nginx
    section "Configuring nginx"
    local nginx_site="/etc/nginx/sites-available/ltropik"
    local nginx_snippet_dir="/etc/nginx/snippets"
    mkdir -p "$nginx_snippet_dir"

    cp "$REPO_DIR/deploy/nginx.conf" "$nginx_site"
    cp "$REPO_DIR/deploy/nginx-locations.conf" "$nginx_snippet_dir/ltropik-locations.conf"

    [[ -L /etc/nginx/sites-enabled/ltropik ]] || \
        ln -s "$nginx_site" /etc/nginx/sites-enabled/ltropik
    [[ -L /etc/nginx/sites-enabled/default ]] && \
        rm -f /etc/nginx/sites-enabled/default || true

    nginx -t && systemctl reload nginx
    ok "nginx configured and reloaded"

    section "Setup complete!"
    echo -e "${GREEN}"
    echo "  LTropik is running at: http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_VPS_IP')"
    echo ""
    echo "  Next steps:"
    echo "  1. Add your domain to nginx.conf (replace 'yourdomain.com')"
    echo "  2. Run: certbot --nginx -d yourdomain.com -d www.yourdomain.com"
    echo "  3. Set appsettings.Production.json with DB connection + JWT secret"
    echo "  4. Register Telegram webhook: POST /api/telegram/set-webhook"
    echo -e "${RESET}"
}

# ── action: backup ────────────────────────────────────────────────────────────
action_backup() {
    section "Media Backup"
    local ts; ts=$(date '+%Y%m%d_%H%M%S')
    local archive="$BACKUPS_DIR/ltropik_media_$ts.tar.gz"
    mkdir -p "$BACKUPS_DIR"
    tar -czf "$archive" -C "$BASE_DIR" media/
    ok "Backup created: $archive ($(du -sh "$archive" | cut -f1))"
    # Keep last 7 backups
    ls -t "$BACKUPS_DIR"/ltropik_media_*.tar.gz 2>/dev/null | tail -n +8 | xargs rm -f || true
    ok "Old backups pruned (keeping last 7)"
}

# ── action: rollback ──────────────────────────────────────────────────────────
action_rollback() {
    acquire_lock
    section "Rollback"
    cd "$REPO_DIR"
    echo "Recent commits:"
    git log --oneline -10
    echo ""
    read -rp "Enter commit hash to roll back to: " commit
    [[ -z "$commit" ]] && err "No commit specified"
    git checkout "$commit" -- .
    ok "Checked out $commit"
    build_backend
    build_frontend
    deploy_artifacts "$BACKEND_TMP"
    systemctl restart "$SERVICE_NAME"
    wait_for_port "$BACKEND_PORT" 30
    ok "Rolled back to $commit"
}

# ── action: status ────────────────────────────────────────────────────────────
action_status() {
    section "LTropik Status"
    echo -e "${BOLD}Service:${RESET}"
    systemctl status "$SERVICE_NAME" --no-pager -l | head -20 || true

    echo -e "\n${BOLD}Port $BACKEND_PORT:${RESET}"
    if nc -z 127.0.0.1 "$BACKEND_PORT" 2>/dev/null; then
        echo -e "  ${GREEN}● LISTENING${RESET}"
    else
        echo -e "  ${RED}● NOT listening${RESET}"
    fi

    echo -e "\n${BOLD}Redis:${RESET}"
    if redis-cli ping 2>/dev/null | grep -q PONG; then
        echo -e "  ${GREEN}● UP${RESET}"
    else
        echo -e "  ${RED}● DOWN${RESET}"
    fi

    echo -e "\n${BOLD}Disk usage:${RESET}"
    du -sh "$BASE_DIR"/{backend,frontend,media,backups} 2>/dev/null || true

    echo -e "\n${BOLD}Versions:${RESET}"
    echo "  .NET:  $(dotnet --version 2>/dev/null || echo 'not found')"
    echo "  Node:  $(node --version 2>/dev/null || echo 'not found')"
    echo "  nginx: $(nginx -v 2>&1 | head -1 || echo 'not found')"
    echo "  Redis: $(redis-server --version 2>/dev/null | head -1 || echo 'not found')"

    echo -e "\n${BOLD}Git:${RESET}"
    cd "$REPO_DIR" 2>/dev/null && git log --oneline -3 || echo "  (repo not found)"

    echo -e "\n${BOLD}Symlink:${RESET}"
    ls -la "$BACKEND_DIR/wwwroot" 2>/dev/null || echo "  wwwroot symlink missing!"
}

# ── action: logs ──────────────────────────────────────────────────────────────
action_logs() {
    journalctl -u "$SERVICE_NAME" -f --no-pager -n 50 \
        | awk '{
            if (/[Ee]rror|FATAL|Exception/)     { print "\033[31m" $0 "\033[0m" }
            else if (/[Ww]arn|WARNING/)          { print "\033[33m" $0 "\033[0m" }
            else if (/[Ii]nfo|started|listening/) { print "\033[32m" $0 "\033[0m" }
            else                                  { print $0 }
        }'
}

# ── action: restart ───────────────────────────────────────────────────────────
action_restart() {
    log "Restarting $SERVICE_NAME…"
    systemctl restart "$SERVICE_NAME"
    wait_for_port "$BACKEND_PORT" 20
    ok "Service restarted"
}

# ── Interactive menu ──────────────────────────────────────────────────────────
interactive_menu() {
    echo -e "${BOLD}${CYAN}"
    echo "  ╔══════════════════════════════════╗"
    echo "  ║     LTropik Deploy Manager       ║"
    echo "  ╚══════════════════════════════════╝"
    echo -e "${RESET}"
    echo "  1) update   — pull + build + deploy"
    echo "  2) status   — service + disk info"
    echo "  3) logs     — live log stream"
    echo "  4) restart  — restart backend"
    echo "  5) backup   — backup media files"
    echo "  6) rollback — rollback to previous commit"
    echo "  7) setup    — first-time VPS setup"
    echo "  q) quit"
    echo ""
    read -rp "  Choice: " choice
    case "$choice" in
        1) action_update ;;
        2) action_status ;;
        3) action_logs ;;
        4) action_restart ;;
        5) action_backup ;;
        6) action_rollback ;;
        7) action_setup ;;
        q|Q) exit 0 ;;
        *) err "Unknown choice: $choice" ;;
    esac
}

# ── Entry point ───────────────────────────────────────────────────────────────
mkdir -p "$BASE_DIR" 2>/dev/null || true
touch "$DEPLOY_LOG" 2>/dev/null || true

case "${1:-menu}" in
    update)   action_update ;;
    setup)    action_setup ;;
    status)   action_status ;;
    logs)     action_logs ;;
    restart)  action_restart ;;
    backup)   action_backup ;;
    rollback) action_rollback ;;
    menu)     interactive_menu ;;
    *)        err "Unknown command: $1. Use: update | setup | status | logs | restart | backup | rollback" ;;
esac
