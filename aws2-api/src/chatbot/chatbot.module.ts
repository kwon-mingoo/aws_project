// AI 챗봇 모듈

import { Module } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';

@Module({
  controllers: [ChatbotController],
  providers: [ChatbotService],
  exports: [ChatbotService], // 다른 모듈에서 사용할 수 있도록 export
})
export class ChatbotModule {}