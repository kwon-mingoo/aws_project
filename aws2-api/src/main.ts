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
    'https://localhost:3002', // 프론트엔드 로컬 HTTPS
  ];

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

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
