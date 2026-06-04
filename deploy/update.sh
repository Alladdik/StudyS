#!/usr/bin/env bash
# CI/CD deploy shortcut — call via:
#   ssh root@vps "bash /opt/ltropik/repo/deploy/update.sh"
exec bash "$(dirname "$0")/ltropik.sh" update "$@"
