import paramiko
import time
import sys
import io

# Force UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

host = "195.93.173.187"
user = "root"
password = "6o7LMc07JUCr"
port = 22

def run_command(ssh, cmd, timeout=300):
    print(f"\n>>> {cmd[:80]}{'...' if len(cmd) > 80 else ''}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    exit_code = stdout.channel.recv_exit_status()
    if out:
        print(out, end='')
    if err and err.strip():
        print("[STDERR]", err, end='')
    return out, err, exit_code

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    print(f"Connecting to {host}...")
    ssh.connect(host, port=port, username=user, password=password, timeout=30)
    print("Connected!\n")

    # ============================================================
    print("=" * 60)
    print("STEP 1: Pull latest code")
    print("=" * 60)
    cmd1 = """cd /opt/ltropik/repo && git fetch origin && git reset --hard origin/$(git remote show origin | grep 'HEAD branch' | awk '{print $NF}') && git log --oneline -3"""
    out, err, rc = run_command(ssh, cmd1, timeout=120)
    print(f"[Exit: {rc}]")

    # ============================================================
    print("\n" + "=" * 60)
    print("STEP 2: Build + deploy backend")
    print("=" * 60)
    cmd2 = """cd /opt/ltropik/repo/src/LTropik.WebAPI && dotnet publish -c Release -o /tmp/ltropik_new --nologo -v quiet 2>&1 | tail -5 && rsync -a --delete --exclude='appsettings.Production.json' /tmp/ltropik_new/ /opt/ltropik/backend/ && chown -R www-data:www-data /opt/ltropik/backend/ && rm -rf /tmp/ltropik_new && echo "Backend deployed" """
    out, err, rc = run_command(ssh, cmd2, timeout=300)
    print(f"[Exit: {rc}]")

    # ============================================================
    print("\n" + "=" * 60)
    print("STEP 3: Build + deploy frontend")
    print("=" * 60)
    cmd3 = """cd /opt/ltropik/repo/ltropik-client && npm install --no-audit --silent && npm run build 2>&1 | tail -5 && rsync -a --delete dist/ /opt/ltropik/frontend/ && echo "Frontend deployed" """
    out, err, rc = run_command(ssh, cmd3, timeout=300)
    print(f"[Exit: {rc}]")

    # ============================================================
    print("\n" + "=" * 60)
    print("STEP 4: Restart service")
    print("=" * 60)
    cmd4 = """systemctl restart ltropik-backend && sleep 6 && systemctl is-active ltropik-backend"""
    out, err, rc = run_command(ssh, cmd4, timeout=30)
    print(f"[Exit: {rc}]")

    # ============================================================
    print("\n" + "=" * 60)
    print("STEP 5: Full verification")
    print("=" * 60)
    cmd5 = """
echo "=== Health ===" && curl -s http://127.0.0.1:5090/api/health/ping

echo "" && echo "=== TURN ===" && systemctl is-active coturn && grep "use-auth-secret" /etc/turnserver.conf && echo "TURN secret OK" && ss -ulnp | grep 3478 | head -2 && ss -tlnp | grep 5349 | head -2

echo "" && echo "=== TURN credentials endpoint ===" && curl -s -o /dev/null -w "HTTP %{http_code}" http://127.0.0.1:5090/api/rooms/turn-credentials

echo "" && echo "=== nginx ===" && nginx -t 2>&1 && systemctl is-active nginx

echo "" && echo "=== Ports ===" && ss -tlnp | grep -E "80 |443 |5090"

echo "" && echo "=== UFW ===" && ufw status | head -20

echo "" && echo "=== Git ===" && cd /opt/ltropik/repo && git log --oneline -3
"""
    out, err, rc = run_command(ssh, cmd5, timeout=60)
    print(f"[Exit: {rc}]")

    ssh.close()
    print("\nDone.")

if __name__ == "__main__":
    main()
