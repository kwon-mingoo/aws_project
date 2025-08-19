// AWS API 서비스를 위한 메인 애플리케이션 모듈
// S3, QuickSight 및 AI 챗봇 기능 제공

import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health.controller';
import { S3Module } from './s3/s3.module';
import { S3Controller } from './s3/s3.controller';
import { QuickSightModule } from './quicksight/quicksight.module';
import { ChatbotModule } from './chatbot/chatbot.module';
import { LoginModule } from './login/login.module';
import { ControlModule } from './control/control.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      name: 'short',
      ttl: 1000, // 1초
      limit: 3,  // 1초에 3회
    }, {
      name: 'medium', 
      ttl: 10000, // 10초
      limit: 20,  // 10초에 20회
    }, {
      name: 'long',
      ttl: 60000, // 1분
      limit: 100, // 1분에 100회
    }]),
    S3Module, 
    QuickSightModule, 
    ChatbotModule, 
    LoginModule,
    ControlModule
  ],
  controllers: [AppController, HealthController, S3Controller],
  providers: [AppService],
})
export class AppModule {}
