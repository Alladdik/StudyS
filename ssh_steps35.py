import paramiko
import sys
import io

# Force UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

host = "195.93.173.187"
user = "root"
password = "6o7LMc07JUCr"
port = 22

def run_command(ssh, label, cmd, timeout=300):
    print(f"\n{'=' * 60}")
    print(label)
    print('=' * 60)
    print(f"CMD: {cmd[:100]}{'...' if len(cmd) > 100 else ''}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
    output = b""
    while True:
        chunk = stdout.read(4096)
        if not chunk:
            break
        output += chunk
        sys.stdout.write(chunk.decode('utf-8', errors='replace'))
        sys.stdout.flush()
    exit_code = stdout.channel.recv_exit_status()
    print(f"\n[Exit: {exit_code}]")
    return exit_code

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {host}...")
    ssh.connect(host, port=port, username=user, password=password, timeout=30)
    print("Connected!\n")

    # STEP 3: Frontend
    rc3 = run_command(ssh, "STEP 3: Build + deploy frontend",
        'cd /opt/ltropik/repo/ltropik-client && npm install --no-audit --silent && npm run build 2>&1 | tail -5 && rsync -a --delete dist/ /opt/ltropik/frontend/ && echo "Frontend deployed"',
        timeout=300)

    # STEP 4: Restart service
    rc4 = run_command(ssh, "STEP 4: Restart service",
        "systemctl restart ltropik-backend && sleep 6 && systemctl is-active ltropik-backend",
        timeout=30)

    # STEP 5: Full verification
    rc5 = run_command(ssh, "STEP 5: Full verification",
        r"""
echo "=== Health ===" && curl -s http://127.0.0.1:5090/api/health/ping

echo "" && echo "=== TURN ===" && systemctl is-active coturn && grep "use-auth-secret" /etc/turnserver.conf && echo "TURN secret OK" && ss -ulnp | grep 3478 | head -2 && ss -tlnp | grep 5349 | head -2

echo "" && echo "=== TURN credentials endpoint ===" && curl -s -o /dev/null -w "HTTP %{http_code}" http://127.0.0.1:5090/api/rooms/turn-credentials

echo "" && echo "=== nginx ===" && nginx -t 2>&1 && systemctl is-active nginx

echo "" && echo "=== Ports ===" && ss -tlnp | grep -E "80 |443 |5090"

echo "" && echo "=== UFW ===" && ufw status | head -20

echo "" && echo "=== Git ===" && cd /opt/ltropik/repo && git log --oneline -3
""",
        timeout=60)

    ssh.close()

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Step 1 (git pull):      OK  (ran in previous session)")
    print(f"Step 2 (backend):       OK  (ran in previous session)")
    print(f"Step 3 (frontend):      {'OK' if rc3 == 0 else 'FAIL'}")
    print(f"Step 4 (restart):       {'OK' if rc4 == 0 else 'FAIL'}")
    print(f"Step 5 (verification):  {'OK' if rc5 == 0 else 'FAIL'}")

if __name__ == "__main__":
    main()
