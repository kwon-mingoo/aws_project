import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 환경변수에서 허용된 도메인 가져오기
  const allowedOrigins = [
    'http://localhost:3000', // 개발 환경
    'https://localhost:3000', // 로컬 HTTPS
    'http://localhost:3002', // 프론트엔드 개발 환경
    'https://localhost:3002', // 프론트엔드 로컬 HTTPS`
  ];

  // ✅ CORS: 프리플라이트 포함 넓게 허용 (개발용)
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'http://localhost:3002',
        'https://localhost:3002',
        'https://aws2aws2.com',
        'http://aws2aws2.com'
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
    credentials: true, // 쿠키/세션 안 쓰면 false로 바꿔도 됨
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'x-amz-date',
      'x-amz-security-token',
      'x-amz-content-sha256',
      'x-api-key'//희연이가 추가함
    ],
    exposedHeaders: ['Content-Length', 'Content-Type'],
  });

  // ✅ 어떤 가드/미들웨어가 OPTIONS를 막아도 204로 통과시키기 (개발용 안전장치)
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      const origin = req.headers.origin;
      const allowedOrigins = [
        'http://localhost:3002',
        'https://localhost:3002',
        'https://aws2aws2.com',
        'http://aws2aws2.com'
      ];
      
      if (!origin || allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin || '*');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
        res.header(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, X-Requested-With, X-CSRF-Token, x-amz-date, x-amz-security-token, x-amz-content-sha256, x-api-key'
        );//희연이가 추가함
        return res.sendStatus(204);
      }
    }
    next();
  });

  // 운영 환경 도메인 추가
  if (process.env.DOMAIN_NAME) {
    allowedOrigins.push(`https://${process.env.DOMAIN_NAME}`);
    allowedOrigins.push(`https://www.${process.env.DOMAIN_NAME}`);
    allowedOrigins.push(`http://${process.env.DOMAIN_NAME}`);
    allowedOrigins.push(`http://www.${process.env.DOMAIN_NAME}`);
  }

  // 추가 도메인들 (환경변수로 전달된 경우)
  if (process.env.ADDITIONAL_DOMAINS) {
    const additionalDomains = process.env.ADDITIONAL_DOMAINS.split(',');
    additionalDomains.forEach(domain => {
      const cleanDomain = domain.trim();
      allowedOrigins.push(`https://${cleanDomain}`);
      allowedOrigins.push(`http://${cleanDomain}`);
    });
  }

  await app.listen(process.env.BACKEND_PORT ?? process.env.PORT ?? 3001, '0.0.0.0');
}
bootstrap();
