#!/bin/sh
# Backup diário do Postgres. Agendar na VPS via cron (ver docs/DEPLOY.md):
#   0 3 * * * /opt/delivery-app/deploy/backup.sh >> /var/log/delivery-backup.log 2>&1
# Mantém 14 dias localmente. TODO: enviar para R2/B2 com rclone.
set -eu

BACKUP_DIR=/opt/delivery-app/backups
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"

docker compose -f /opt/delivery-app/docker-compose.prod.yml exec -T postgres \
  pg_dump -U delivery -d delivery --format=custom \
  > "$BACKUP_DIR/delivery-$STAMP.dump"

# retenção: apaga backups com mais de 14 dias
find "$BACKUP_DIR" -name 'delivery-*.dump' -mtime +14 -delete

echo "[$(date)] backup ok: delivery-$STAMP.dump ($(du -h "$BACKUP_DIR/delivery-$STAMP.dump" | cut -f1))"
