#!/usr/bin/env bash
# 同步网站静态文件到 UCloud 服务器。
# 用法: bash deploy/deploy.sh
set -euo pipefail

SERVER="root@106.75.246.233"
REMOTE_DIR="/var/www/speech-test"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)/public"

echo "==> 同步 $LOCAL_DIR -> $SERVER:$REMOTE_DIR"
if command -v rsync >/dev/null 2>&1; then
  rsync -avz --delete \
    --exclude '.DS_Store' --exclude 'Thumbs.db' \
    "$LOCAL_DIR/" "$SERVER:$REMOTE_DIR/"
else
  # Windows/Git Bash 通常没有 rsync，用 tar over ssh（全量覆盖，不删除远端多余文件）
  tar czf - --exclude '.DS_Store' --exclude 'Thumbs.db' -C "$LOCAL_DIR" . \
    | ssh "$SERVER" "tar xzf - -C $REMOTE_DIR && chown -R nginx:nginx $REMOTE_DIR"
fi

echo "==> 完成。https://hearing.hnboy2005.info/"
echo "    如更新了 deploy/xfyun-token-server.py，请另行执行:"
echo "    scp deploy/xfyun-token-server.py $SERVER:/opt/speech-test/ && ssh $SERVER 'systemctl restart speech-test-token'"
