#!/bin/bash

echo "=== 의존성 설치 시작 ==="

# 기본적인 시스템 준비만 수행
echo "시스템 준비 중..."

# 로그 디렉토리 생성
mkdir -p /var/log/aws2-giot-app
chmod 755 /var/log/aws2-giot-app

# 권한 설정
chown -R ec2-user:ec2-user /home/ec2-user/app

echo "=== 의존성 설치 완료 ==="