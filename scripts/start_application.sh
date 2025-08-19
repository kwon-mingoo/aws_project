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

# Python 패키지 설치
echo "Python 패키지 설치 중..."
pip3 install boto3>=1.34.0

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

# DynamoDB 테이블이 이미 생성되어 있다고 가정

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

# 보안 관련 환경변수 가져오기
ADMIN_API_KEY=$(aws ssm get-parameter --name "/test_pjs/backend/ADMIN_API_KEY" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || echo "admin-default-key")

# 프론트엔드 환경변수 가져오기
PORT=$(aws ssm get-parameter --name "/test_pjs/frontend/PORT" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || echo "3002")
REACT_APP_API_BASE_URL=$(aws ssm get-parameter --name "/test_pjs/frontend/REACT_APP_API_BASE_URL" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || echo "https://aws2aws2.com")
REACT_APP_DEBUG=$(aws ssm get-parameter --name "/test_pjs/frontend/REACT_APP_DEBUG" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || echo "false")
REACT_APP_ADMIN_API_KEY=$(aws ssm get-parameter --name "/test_pjs/backend/ADMIN_API_KEY" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || echo "admin-0816-key-0610-aws2")

# 도메인 정보
DOMAIN_NAME=$(aws ssm get-parameter --name "/test_pjs/domain" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || echo "localhost")

# IoT Core 설정
IOT_ENDPOINT_URL=$(aws ssm get-parameter --name "/test_pjs/backend/IOT_ENDPOINT_URL" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || echo "https://your-iot-endpoint.iot.ap-northeast-2.amazonaws.com")
IOT_TOPIC_CONTROL=$(aws ssm get-parameter --name "/test_pjs/backend/IOT_TOPIC_CONTROL" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || echo "device/control/environment")
DYNAMODB_CONTROL_TABLE=$(aws ssm get-parameter --name "/test_pjs/backend/DYNAMODB_CONTROL_TABLE" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || echo "EnvironmentControlLogs")

echo "환경변수 확인:"
echo "- S3_BUCKET_NAME=$S3_BUCKET_NAME"
echo "- AWS_ACCOUNT_ID=$AWS_ACCOUNT_ID"
echo "- AWS_REGION=$AWS_REGION"
echo "- BACKEND_PORT=$BACKEND_PORT"
echo "- PORT=$PORT"
echo "- DOMAIN_NAME=$DOMAIN_NAME"
echo "- IOT_ENDPOINT_URL=$IOT_ENDPOINT_URL"
echo "- IOT_TOPIC_CONTROL=$IOT_TOPIC_CONTROL"
echo "- DYNAMODB_CONTROL_TABLE=$DYNAMODB_CONTROL_TABLE"
echo "- ADMIN_API_KEY=***[SECURED]***"

# 백엔드 .env 파일 생성
echo "백엔드 .env 파일 생성 중..."
mkdir -p /home/ec2-user/app/aws2-api
cat > /home/ec2-user/app/aws2-api/.env << EOF
NODE_ENV=production
PORT=$BACKEND_PORT
BACKEND_PORT=$BACKEND_PORT
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
ADMIN_API_KEY=$ADMIN_API_KEY
RATE_LIMIT_TTL=60
RATE_LIMIT_LIMIT=20
IOT_ENDPOINT_URL=$IOT_ENDPOINT_URL
IOT_TOPIC_CONTROL=$IOT_TOPIC_CONTROL
DYNAMODB_CONTROL_TABLE=$DYNAMODB_CONTROL_TABLE
EOF

# .env 파일 생성 확인
if [ -f "/home/ec2-user/app/aws2-api/.env" ]; then
    echo "백엔드 .env 파일 생성 성공"
    ls -la /home/ec2-user/app/aws2-api/.env
else
    echo "백엔드 .env 파일 생성 실패"
    exit 1
fi

# 프론트엔드 .env 파일 생성
echo "프론트엔드 .env 파일 생성 중..."
mkdir -p /home/ec2-user/app/frontend_backup
cat > /home/ec2-user/app/frontend_backup/.env << EOF
REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL
REACT_APP_DEBUG=$REACT_APP_DEBUG
REACT_APP_ADMIN_API_KEY=$REACT_APP_ADMIN_API_KEY
REACT_APP_ENV=production
PORT=$PORT
BROWSER=none
CI=true
EOF

# .env 파일 생성 확인
if [ -f "/home/ec2-user/app/frontend_backup/.env" ]; then
    echo "프론트엔드 .env 파일 생성 성공"
    ls -la /home/ec2-user/app/frontend_backup/.env
else
    echo "프론트엔드 .env 파일 생성 실패"
    exit 1
fi

# 권한 설정
echo "환경변수 파일 권한 설정 중..."

# 백엔드 .env 파일 권한 설정
if [ -f "/home/ec2-user/app/aws2-api/.env" ]; then
    chown ec2-user:ec2-user /home/ec2-user/app/aws2-api/.env
    echo "백엔드 .env 파일 권한 설정 완료"
else
    echo "경고: 백엔드 .env 파일이 존재하지 않습니다"
fi

# 프론트엔드 .env 파일 권한 설정
if [ -f "/home/ec2-user/app/frontend_backup/.env" ]; then
    chown ec2-user:ec2-user /home/ec2-user/app/frontend_backup/.env
    echo "프론트엔드 .env 파일 권한 설정 완료"
else
    echo "오류: 프론트엔드 .env 파일이 존재하지 않습니다"
    exit 1
fi

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
    
    # Python 패키지 설치 (프로젝트별)
    echo "백엔드 Python 패키지 설치 중..."
    if [ -f "python-scripts/requirements.txt" ]; then
        pip3 install -r python-scripts/requirements.txt
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
    echo "현재 디렉토리: $(pwd)"
    echo "frontend_backup 디렉토리 확인: $(ls -la frontend_backup/ | head -3)"
    
    cd frontend_backup
    chown -R ec2-user:ec2-user .
    echo "프론트엔드 디렉토리로 이동 완료: $(pwd)"
    
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
    
    echo "프론트엔드 처리 완료, 상위 디렉토리로 이동"
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
    server_name aws2aws2.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Hide nginx version
    server_tokens off;

    # Health check endpoints
    location /health {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/health;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /healthz {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/healthz;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # API endpoints - backend routes
    location /quicksight/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/quicksight/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /s3/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/s3/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /chatbot/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/chatbot/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /login/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/login/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /control/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/control/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Frontend - React app (default fallback)
    location / {
        proxy_pass http://127.0.0.1:${PORT}/;
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

echo "현재 디렉토리: $(pwd)"
echo "파일 목록 확인:"
ls -la | grep -E "(ecosystem|package)"

if [ -f "/home/ec2-user/app/ecosystem.config.js" ]; then
    echo "ecosystem.config.js 파일 확인됨, PM2로 시작..."
    echo "ecosystem.config.js 내용 미리보기:"
    head -10 /home/ec2-user/app/ecosystem.config.js
    
    su - ec2-user -c "cd /home/ec2-user/app && pm2 start ecosystem.config.js" || {
        echo "ecosystem.config.js 시작 실패. 상세 로그:"
        su - ec2-user -c "cd /home/ec2-user/app && pm2 logs" || true
        echo "package.json으로 대체 시도..."
        su - ec2-user -c "cd /home/ec2-user/app && pm2 start npm --name 'app' -- start"
    }
else
    echo "ecosystem.config.js가 없습니다: $(ls -la /home/ec2-user/app/ | grep ecosystem || echo 'ecosystem 파일 없음')"
    echo "package.json으로 시작..."
    su - ec2-user -c "cd /home/ec2-user/app && pm2 start npm --name 'app' -- start"
fi

# PM2 자동 시작 설정 및 프로세스 저장
echo "PM2 자동 시작 설정 중..."
su - ec2-user -c "pm2 startup systemd -u ec2-user --hp /home/ec2-user" | grep "sudo" | sh || echo "PM2 startup 설정 실패 (이미 설정되었을 수 있음)"
su - ec2-user -c "pm2 save"
echo "PM2 프로세스 저장 완료"

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

# Health check 테스트 (강화된 버전)
echo "Health check 테스트 중..."
HEALTH_CHECK_SUCCESS=false
RETRY_COUNT=0
MAX_RETRIES=6

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Health check 시도 $RETRY_COUNT/$MAX_RETRIES..."
    
    if curl -f http://localhost/health > /dev/null 2>&1; then
        echo "✅ Health check 성공!"
        HEALTH_CHECK_SUCCESS=true
        break
    else
        echo "⏳ Health check 실패, 30초 후 재시도..."
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            sleep 30
        fi
    fi
done

if [ "$HEALTH_CHECK_SUCCESS" = "false" ]; then
    echo "❌ Health check 최종 실패 - 롤백 시작"
    echo "서비스 상태 진단:"
    
    # PM2 상태 확인
    echo "PM2 프로세스 상태:"
    su - ec2-user -c "pm2 list" || echo "PM2 상태 확인 실패"
    
    # nginx 상태 확인
    echo "nginx 상태:"
    systemctl status nginx --no-pager || echo "nginx 상태 확인 실패"
    
    # 직접 포트 확인
    echo "포트 상태 확인:"
    ss -tlnp | grep -E ":(3001|3002|80)" || echo "포트 확인 실패"
    
    # 백엔드 직접 접근 확인
    echo "백엔드 직접 접근 테스트:"
    curl -s http://localhost:3001/health || echo "백엔드 직접 접근 실패"
    
    # 프론트엔드 직접 접근 확인  
    echo "프론트엔드 직접 접근 테스트:"
    curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/ || echo "프론트엔드 직접 접근 실패"
    
    echo "❌ 배포 실패 - 수동 확인이 필요합니다"
    echo "다음 명령어로 문제를 확인하세요:"
    echo "  pm2 logs"
    echo "  sudo journalctl -u nginx -f"
    echo "  sudo tail -f /var/log/aws2-giot-app/*.log"
    
    exit 1
else
    echo "✅ 배포 성공 - 서비스가 정상적으로 실행 중입니다"
fi

echo "=== 애플리케이션 시작 완료 ==="