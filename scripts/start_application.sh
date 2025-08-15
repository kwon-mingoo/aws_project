#!/bin/bash

echo "=== 애플리케이션 시작 중 ==="

# 애플리케이션 디렉토리로 이동
cd /home/ec2-user/app

# 완전한 시스템 준비 (Amazon Linux 2023)
echo "시스템 완전 설정 중..."

# 패키지 매니저 업데이트
dnf update -y

# 필수 시스템 도구 설치
dnf install -y curl wget git tar gzip unzip

# Node.js 및 npm 설치 (NodeSource 저장소 사용 - 더 안정적)
echo "Node.js 설치 중..."
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs

# Python (일부 npm 패키지 빌드용)
dnf install -y python3 python3-pip

# Build tools (네이티브 모듈 컴파일용)
dnf install -y gcc-c++ make

# nginx 설치 및 시작
echo "nginx 설치 중..."
dnf install -y nginx
systemctl enable nginx
systemctl start nginx

# nginx 설치 확인
if ! systemctl is-active --quiet nginx; then
    echo "nginx 서비스 시작 실패. 수동으로 시작 시도..."
    /usr/sbin/nginx
fi

if ! command -v nginx &> /dev/null; then
    echo "nginx 설치 실패"
    exit 1
fi

# PATH 환경변수 설정
export PATH=$PATH:/usr/local/bin:/usr/bin

# PM2 전역 설치
echo "PM2 설치 중..."
npm install -g pm2

# 로그 디렉토리 생성
mkdir -p /var/log/aws2-giot-app
chown -R ec2-user:ec2-user /var/log/aws2-giot-app

# 설치 확인
if ! command -v node &> /dev/null; then
    echo "Node.js 설치 실패"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "npm 설치 실패"
    exit 1
fi

if ! command -v pm2 &> /dev/null; then
    echo "PM2 설치 실패"
    exit 1
fi

echo "모든 의존성이 준비되었습니다."
echo "Node.js 버전: $(node --version)"
echo "npm 버전: $(npm --version)"
echo "PM2 버전: $(pm2 --version)"

# 기존 PM2 프로세스 정리
echo "기존 PM2 프로세스 정리 중..."
export HOME=/home/ec2-user
su - ec2-user -c "pm2 kill" 2>/dev/null || true

# AWS CLI 설치 (환경변수 가져오기용)
echo "AWS CLI 설치 중..."
if ! command -v aws &> /dev/null; then
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip awscliv2.zip
    ./aws/install
    export PATH=$PATH:/usr/local/bin
fi

# 환경변수 파일 생성
echo "환경변수 설정 중..."

# SSM Parameter Store에서 실제 값 가져오기
echo "SSM Parameter Store에서 환경변수 가져오는 중..."

# 백엔드 환경변수 가져오기 (모두 with-decryption 사용)
echo "SSM 파라미터 복호화 중..."
AWS_ACCESS_KEY_ID=$(aws ssm get-parameter --name "/test_pjs/backend/AWS_ACCESS_KEY_ID" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || echo "")
AWS_SECRET_ACCESS_KEY=$(aws ssm get-parameter --name "/test_pjs/backend/AWS_SECRET_ACCESS_KEY" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || echo "")
AWS_ACCOUNT_ID=$(aws ssm get-parameter --name "/test_pjs/backend/AWS_ACCOUNT_ID" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || echo "123456789012")
AWS_REGION=$(aws ssm get-parameter --name "/test_pjs/backend/AWS_REGION" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || echo "ap-northeast-2")
S3_BUCKET_NAME=$(aws ssm get-parameter --name "/test_pjs/backend/S3_BUCKET_NAME" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || echo "aws2-giot-data-bucket")
QUICKSIGHT_NAMESPACE=$(aws ssm get-parameter --name "/test_pjs/backend/QUICKSIGHT_NAMESPACE" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || echo "default")
BACKEND_PORT=$(aws ssm get-parameter --name "/test_pjs/backend/PORT" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || echo "3001")

# 프론트엔드 환경변수 가져오기
FRONTEND_PORT=$(aws ssm get-parameter --name "/test_pjs/frontend/PORT" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || echo "3002")
REACT_APP_API_BASE=$(aws ssm get-parameter --name "/test_pjs/frontend/REACT_APP_API_BASE" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || echo "http://localhost:3001")

# 도메인 정보
DOMAIN_NAME=$(aws ssm get-parameter --name "/test_pjs/domain" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || echo "localhost")

echo "환경변수 확인:"
echo "- S3_BUCKET_NAME=$S3_BUCKET_NAME"
echo "- AWS_ACCOUNT_ID=$AWS_ACCOUNT_ID"
echo "- AWS_REGION=$AWS_REGION"
echo "- BACKEND_PORT=$BACKEND_PORT"
echo "- FRONTEND_PORT=$FRONTEND_PORT"
echo "- DOMAIN_NAME=$DOMAIN_NAME"

# 백엔드 .env 파일 생성
cat > /home/ec2-user/app/aws2-api/.env << EOF
NODE_ENV=production
PORT=$BACKEND_PORT
AWS_REGION=$AWS_REGION
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
AWS_ACCOUNT_ID=$AWS_ACCOUNT_ID
S3_BUCKET_NAME=$S3_BUCKET_NAME
S3_REGION=$AWS_REGION
QUICKSIGHT_ACCOUNT_ID=$AWS_ACCOUNT_ID
QUICKSIGHT_REGION=$AWS_REGION
QUICKSIGHT_NAMESPACE=$QUICKSIGHT_NAMESPACE
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/aws2-giot-app
HEALTH_CHECK_TIMEOUT=5000
METRICS_ENABLED=true
DOMAIN_NAME=$DOMAIN_NAME
EOF

# 프론트엔드 .env 파일 생성
cat > /home/ec2-user/app/frontend_backup/.env << EOF
REACT_APP_API_URL=$REACT_APP_API_BASE
REACT_APP_ENV=production
PORT=$FRONTEND_PORT
BROWSER=none
CI=true
EOF

# 루트 .env 파일 생성
cat > /home/ec2-user/app/.env << EOF
NODE_ENV=production
AWS_REGION=$AWS_REGION
S3_BUCKET_NAME=$S3_BUCKET_NAME
DOMAIN_NAME=$DOMAIN_NAME
EOF

# 권한 설정
chown ec2-user:ec2-user /home/ec2-user/app/.env
chown ec2-user:ec2-user /home/ec2-user/app/aws2-api/.env 2>/dev/null || true
chown ec2-user:ec2-user /home/ec2-user/app/frontend_backup/.env 2>/dev/null || true

# 백엔드 의존성 설치 및 빌드
if [ -d "aws2-api" ] && [ -f "aws2-api/package.json" ]; then
    echo "백엔드 의존성 설치 및 빌드 중..."
    cd aws2-api
    chown -R ec2-user:ec2-user .
    
    # 기존 node_modules 및 package-lock.json 정리 후 의존성 설치
    echo "백엔드 의존성 정리 및 설치 중..."
    rm -rf node_modules package-lock.json
    
    # npm 캐시 정리
    su - ec2-user -c "cd /home/ec2-user/app/aws2-api && npm cache clean --force"
    
    # 의존성 설치 (빌드에 필요한 devDependencies 포함)
    echo "백엔드 의존성 설치 중..."
    su - ec2-user -c "cd /home/ec2-user/app/aws2-api && npm install --no-optional --legacy-peer-deps"
    
    # NestJS CLI 전역 설치
    npm install -g @nestjs/cli
    
    # 빌드 실행
    echo "백엔드 빌드 실행 중..."
    su - ec2-user -c "cd /home/ec2-user/app/aws2-api && npm run build"
    
    # 빌드 결과 확인
    if [ ! -f "dist/main.js" ]; then
        echo "빌드 실패: dist/main.js 파일이 생성되지 않았습니다."
        echo "빌드 디렉토리 내용:"
        ls -la dist/ || echo "dist 디렉토리가 존재하지 않습니다."
        exit 1
    fi
    
    cd ..
fi

# npm 캐시 권한 문제 해결
echo "npm 캐시 권한 수정 중..."
chown -R ec2-user:ec2-user /home/ec2-user/.npm 2>/dev/null || true
su - ec2-user -c "npm cache clean --force" 2>/dev/null || true

# 프론트엔드 의존성 설치
if [ -d "frontend_backup" ] && [ -f "frontend_backup/package.json" ]; then
    echo "프론트엔드 의존성 설치 중..."
    cd frontend_backup
    chown -R ec2-user:ec2-user .
    
    # 기존 node_modules와 캐시 완전 정리
    rm -rf node_modules package-lock.json
    
    # npm 설정 초기화 및 캐시 정리
    su - ec2-user -c "cd /home/ec2-user/app/frontend_backup && npm cache clean --force"
    
    # 의존성 설치 (강제 설치)
    echo "프론트엔드 의존성 강제 설치 중..."
    su - ec2-user -c "cd /home/ec2-user/app/frontend_backup && npm install --no-optional --legacy-peer-deps"
    
    # 설치 검증
    echo "react-scripts 설치 확인 중..."
    if ! su - ec2-user -c "cd /home/ec2-user/app/frontend_backup && npx react-scripts --version" 2>/dev/null; then
        echo "react-scripts가 설치되지 않았습니다. 재설치 시도..."
        su - ec2-user -c "cd /home/ec2-user/app/frontend_backup && npm install react-scripts@5.0.1 --save"
    fi
    
    # serve 패키지 설치 (프로덕션 정적 파일 서빙용)
    echo "serve 패키지 설치 중..."
    su - ec2-user -c "cd /home/ec2-user/app/frontend_backup && npm install serve --save"
    
    # 프론트엔드 빌드
    echo "프론트엔드 빌드 실행 중..."
    su - ec2-user -c "cd /home/ec2-user/app/frontend_backup && CI=true npm run build"
    
    # 빌드 결과 확인
    if [ ! -d "build" ]; then
        echo "프론트엔드 빌드 실패: build 디렉토리가 생성되지 않았습니다."
        echo "현재 디렉토리 내용:"
        ls -la
        echo "node_modules 상태:"
        ls -la node_modules/.bin/ | grep react-scripts || echo "react-scripts 바이너리 없음"
        echo "package.json 확인:"
        cat package.json | grep react-scripts || echo "package.json에 react-scripts 없음"
        exit 1
    fi
    
    cd ..
fi

# nginx 프록시 설정 (동적 포트 적용)
echo "nginx 프록시 설정 중..."

# 기존 설정 파일들 정리
rm -f /etc/nginx/conf.d/default.conf
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

cat > /etc/nginx/conf.d/app.conf << EOF
server {
    listen 80;
    server_name _;

    location /health {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/health;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:${FRONTEND_PORT}/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# 기본 nginx server 블록 비활성화 - 더 안전한 방법
echo "기본 nginx server 블록 비활성화 중..."
# main nginx.conf에서 기본 server 블록 주석 처리
if grep -q "listen.*80" /etc/nginx/nginx.conf; then
    cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
    sed -i '/server {/,/}/s/^/#/' /etc/nginx/nginx.conf
fi

# 또는 include 구문만 남기고 기본 설정 제거
cat > /etc/nginx/nginx.conf << 'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log;
pid /run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;

    sendfile            on;
    tcp_nopush          on;
    tcp_nodelay         on;
    keepalive_timeout   65;
    types_hash_max_size 4096;

    include             /etc/nginx/mime.types;
    default_type        application/octet-stream;

    include /etc/nginx/conf.d/*.conf;
}
EOF

# ecosystem.config.js 확인 및 PM2 시작
echo "애플리케이션 시작 중..."
export HOME=/home/ec2-user

if [ -f "ecosystem.config.js" ]; then
    echo "ecosystem.config.js로 PM2 시작..."
    su - ec2-user -c "cd /home/ec2-user/app && pm2 start ecosystem.config.js" || {
        echo "ecosystem.config.js 시작 실패. package.json으로 시도..."
        su - ec2-user -c "cd /home/ec2-user/app && pm2 start npm --name 'app' -- start"
    }
else
    echo "ecosystem.config.js가 없습니다. package.json으로 시작..."
    su - ec2-user -c "cd /home/ec2-user/app && pm2 start npm --name 'app' -- start"
fi

# PM2 프로세스 저장
su - ec2-user -c "pm2 save"

# nginx 설정 테스트 및 재시작
echo "nginx 설정 테스트 및 재시작 중..."

# nginx 설정 파일 구문 확인
if ! nginx -t 2>&1; then
    echo "nginx 설정에 오류가 있습니다. 설정 파일을 확인합니다."
    echo "현재 nginx 설정 파일들:"
    ls -la /etc/nginx/conf.d/
    echo "app.conf 내용:"
    cat /etc/nginx/conf.d/app.conf
    exit 1
fi

systemctl restart nginx
if systemctl is-active --quiet nginx; then
    echo "nginx가 성공적으로 재시작되었습니다."
else
    echo "nginx 재시작에 실패했습니다. 직접 시작 시도..."
    /usr/sbin/nginx
fi

# 서비스 상태 확인
echo "서비스 상태 확인 중..."
sleep 5

# PM2 상태 확인
echo "PM2 프로세스 상태:"
su - ec2-user -c "pm2 list"

# nginx 상태 확인
echo "nginx 상태:"
systemctl status nginx --no-pager

# Health check 테스트
echo "Health check 테스트 중..."
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "✅ Health check 성공"
else
    echo "❌ Health check 실패"
    echo "로컬 애플리케이션 상태 확인:"
    curl -s http://localhost:3001/health || echo "백엔드 직접 접근 실패"
    curl -s http://localhost:3000 > /dev/null && echo "프론트엔드 직접 접근 성공" || echo "프론트엔드 직접 접근 실패"
fi

echo "=== 애플리케이션 시작 완료 ==="