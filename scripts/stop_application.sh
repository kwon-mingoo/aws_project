#!/bin/bash

echo "=== 애플리케이션 중지 중 ==="

# ec2-user PM2 프로세스 중지
export HOME=/home/ec2-user
export PATH=$PATH:/usr/local/bin:/usr/bin

if command -v pm2 &> /dev/null; then
    echo "PM2로 애플리케이션 중지 중..."
    su - ec2-user -c "pm2 stop all" || true
    su - ec2-user -c "pm2 delete all" || true
    su - ec2-user -c "pm2 kill" || true
fi

# Node.js 프로세스 강제 종료
echo "Node.js 프로세스 강제 종료 중..."
pkill -f "node" || true

# nginx 중지
if command -v nginx &> /dev/null; then
    echo "nginx 중지 중..."
    systemctl stop nginx || true
fi

echo "=== 애플리케이션 중지 완료 ==="