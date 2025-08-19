# AWS2-GIOT Full-Stack Application

AWS에 배포되는 풀스택 애플리케이션 - NestJS 백엔드 + React 프론트엔드 + Python 챗봇

## 🏗️ 아키텍처

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React SPA     │    │   NestJS API     │    │  Python Scripts │
│  (Frontend)     │───▶│   (Backend)      │───▶│   (Chatbot)     │
│                 │    │                  │    │                 │
│ - TypeScript    │    │ - TypeScript     │    │ - API Wrapper   │
│ - React Router  │    │ - JWT Auth       │    │ - ML/AI Logic   │
│ - Material-UI   │    │ - AWS SDK        │    │ - Data Process  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌────────▼─────────┐            │
         └─────────────▶│      Nginx       │◀───────────┘
                        │  (Reverse Proxy) │
                        └──────────────────┘
```

## 📁 프로젝트 구조

```
aws2-giot-app/
├── appspec.yml                 # AWS CodeDeploy 배포 설정
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions CI/CD
├── scripts/                    # 배포 스크립트들
│   ├── before_install.sh       # 시스템 환경 준비
│   ├── install_dependencies.sh # 의존성 설치 및 빌드
│   ├── start_server.sh         # 서버 시작
│   ├── stop_application.sh     # 애플리케이션 중지
│   └── validate_service.sh     # 서비스 검증
├── aws2-api/                   # NestJS 백엔드
│   ├── src/
│   │   ├── main.ts            # 애플리케이션 엔트리포인트
│   │   ├── app.module.ts      # 루트 모듈
│   │   ├── chatbot/           # 챗봇 API 모듈
│   │   ├── quicksight/        # AWS QuickSight 연동
│   │   └── s3/                # AWS S3 연동
│   ├── python-scripts/        # Python 챗봇 스크립트
│   │   ├── api_wrapper.py
│   │   ├── chatbot.py
│   │   └── requirements.txt
│   └── package.json
├── frontend_backup/            # React 프론트엔드
│   ├── src/
│   │   ├── components/        # 재사용 가능한 컴포넌트
│   │   ├── pages/             # 페이지 컴포넌트들
│   │   └── services/          # API 서비스 레이어
│   └── package.json
└── package.json               # 루트 패키지 설정
```

## 🚀 배포 방법

### 1. GitHub Repository 설정

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/aws2-giot-app.git
git push -u origin main
```

### 2. AWS 리소스 설정

#### S3 버킷 생성
```bash
aws s3 mb s3://your-deployment-bucket-name
```

#### CodeDeploy 애플리케이션 생성
```bash
aws deploy create-application \
  --application-name aws2-giot-app \
  --compute-platform EC2/OnPremises
```

#### CodeDeploy 배포 그룹 생성
```bash
aws deploy create-deployment-group \
  --application-name aws2-giot-app \
  --deployment-group-name production \
  --service-role-arn arn:aws:iam::YOUR-ACCOUNT:role/CodeDeployServiceRole \
  --ec2-tag-filters Key=Environment,Value=Production,Type=KEY_AND_VALUE
```

### 3. EC2 인스턴스 설정

#### CodeDeploy Agent 설치 (Amazon Linux 2023)
```bash
sudo dnf update -y
sudo dnf install -y ruby wget
cd /home/ec2-user
wget https://aws-codedeploy-ap-northeast-2.s3.ap-northeast-2.amazonaws.com/latest/install
chmod +x ./install
sudo ./install auto
sudo systemctl start codedeploy-agent
sudo systemctl enable codedeploy-agent
```

#### IAM 역할 연결
EC2 인스턴스에 다음 정책이 포함된 IAM 역할을 연결하세요:
- `AmazonEC2RoleforAWSCodeDeploy`
- `CloudWatchAgentServerPolicy`

### 4. GitHub Secrets 설정

Repository Settings > Secrets and variables > Actions에서 다음 시크릿들을 설정:

```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-northeast-2
S3_BUCKET_NAME=your-deployment-bucket-name
CODEDEPLOY_APPLICATION_NAME=aws2-giot-app
CODEDEPLOY_DEPLOYMENT_GROUP=production
```

### 5. 배포 실행

main 브랜치에 push하면 자동으로 배포가 시작됩니다:

```bash
git add .
git commit -m "Deploy to production"
git push origin main
```

## 🔧 개발 환경 설정

### 로컬 개발 환경

```bash
# 의존성 설치
npm install

# 백엔드 개발 서버 실행
cd aws2-api
npm run start:dev

# 프론트엔드 개발 서버 실행 (다른 터미널)
cd frontend_backup
npm start
```

### 환경 변수 설정

`aws2-api/.env` 파일 생성:
```env
NODE_ENV=development
PORT=3001
AWS_REGION=ap-northeast-2
S3_BUCKET_NAME=your-bucket-name
AWS_ACCOUNT_ID=123456789012
```

## 📊 모니터링 및 로그

### 서비스 상태 확인
```bash
# PM2 프로세스 상태
pm2 list

# PM2 로그 확인
pm2 logs aws2-giot-backend

# Nginx 상태
sudo systemctl status nginx

# 애플리케이션 로그
sudo tail -f /var/log/aws2-giot-app/backend.log
```

### 헬스체크 엔드포인트
- Backend: `http://your-ec2-ip:3001/health`
- Frontend: `http://your-ec2-ip/`
- API Proxy: `http://your-ec2-ip/api/`

## 🔒 보안 설정

### EC2 보안 그룹 설정
```
인바운드 규칙:
- HTTP (80): 0.0.0.0/0
- HTTPS (443): 0.0.0.0/0  (SSL 사용 시)
- SSH (22): Your IP only
- Custom (3001): 내부 VPC only (선택사항)
```

### 환경 변수 보안
- 실제 API 키나 시크릿은 AWS Parameter Store 또는 Secrets Manager 사용 권장
- 프로덕션에서는 `.env` 파일 대신 환경 변수 직접 설정

## 🐛 트러블슈팅

### 일반적인 문제들

1. **빌드 실패**
   ```bash
   cd aws2-api
   npm install --force
   npx nest build
   ```

2. **포트 충돌**
   ```bash
   sudo lsof -ti:3001 | xargs sudo kill -9
   pm2 restart aws2-giot-backend
   ```

3. **Nginx 설정 오류**
   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   ```

4. **PM2 프로세스 문제**
   ```bash
   pm2 delete all
   pm2 start ecosystem.config.js
   ```

### 로그 위치
- 백엔드 로그: `/var/log/aws2-giot-app/backend.log`
- Nginx 로그: `/var/log/nginx/aws2-giot-app-error.log`
- CodeDeploy 로그: `/var/log/aws/codedeploy-agent/`

## 📞 지원

문제가 발생하면 다음을 확인해주세요:

1. **배포 로그**: GitHub Actions 탭에서 배포 로그 확인
2. **CodeDeploy 콘솔**: AWS 콘솔에서 배포 상태 확인
3. **EC2 인스턴스**: SSH로 접속하여 서비스 상태 확인
4. **헬스체크**: 각 엔드포인트의 응답 확인

---

## 🏷️ 버전 정보

- **Node.js**: 20.x
- **NestJS**: Latest
- **React**: Latest
- **Python**: 3.11+
- **OS**: Amazon Linux 2023