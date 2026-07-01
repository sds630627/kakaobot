#!/bin/bash
REPO="https://raw.githubusercontent.com/sds630627/kakaobot/main/index.js"
FILE="/root/kakaobot/index.js"
while true; do
    curl -sf -o /tmp/idx_new.js "$REPO"
    if [ $? -eq 0 ] && ! diff -q "$FILE" /tmp/idx_new.js > /dev/null 2>&1; then
        node --check /tmp/idx_new.js && cp /tmp/idx_new.js "$FILE" && pm2 restart kakaobot && echo "[$(date '+%H:%M:%S')] 업데이트 완료"
    fi
    sleep 60
done