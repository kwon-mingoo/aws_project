// AI 챗봇 API 컨트롤러

import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ChatbotService } from './chatbot.service';
import { ChatbotQueryDto, ChatbotResponseDto, ChatbotHealthDto } from './dto/chatbot.dto';

@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  /**
   * @api {POST} /chatbot/ask AI 챗봇에 질문하기
   * @apiName AskChatbot
   * @apiGroup Chatbot
   * 
   * @apiDescription 파이썬 AI 챗봇에 질문을 전송하고 답변을 받습니다.
   * 센서 데이터 질문(온도, 습도, 공기질)과 일반 질문을 모두 처리할 수 있습니다.
   * 
   * @apiBody {String} query 질문 내용
   * @apiBody {String} [session_id] 선택적 세션 ID
   * 
   * @apiSuccess {String} answer 챗봇 답변
   * @apiSuccess {String} route 라우팅 결과 (sensor/general/sensor_cache/sensor_detail/error)
   * @apiSuccess {String} session_id 세션 ID
   * @apiSuccess {Number} turn_id 턴 ID
   * @apiSuccess {Number} processing_time 처리 시간(초)
   * @apiSuccess {String} mode 처리 모드
   * @apiSuccess {Number} [docs_found] 검색된 문서 수
   * @apiSuccess {Number} [top_score] 최고 점수
   * 
   * @apiExample {curl} Example usage:
   *     curl -X POST http://localhost:3001/chatbot/ask \
   *          -H "Content-Type: application/json" \
   *          -d '{"query": "현재 온도가 어때?"}'
   * 
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "answer": "현재 온도는 25.5도입니다. 적정 온도로 편안해요!",
   *       "route": "sensor",
   *       "session_id": "20250813-142530-abc123",
   *       "turn_id": 1,
   *       "processing_time": 2.34,
   *       "mode": "rag",
   *       "docs_found": 3,
   *       "top_score": 95
   *     }
   */
  @Post('ask')
  @HttpCode(HttpStatus.OK)
  async askChatbot(
    @Body(ValidationPipe) queryDto: ChatbotQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ChatbotResponseDto> {
    const result = await this.chatbotService.askChatbot(queryDto);
    
    // 캐시 설정 - 센서 데이터는 짧게, 일반 질문은 길게
    if (result.route === 'sensor' || result.route === 'sensor_cache') {
      res.setHeader('Cache-Control', 'public, max-age=60'); // 1분
    } else {
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5분
    }
    
    return result;
  }

  /**
   * @api {GET} /chatbot/health 챗봇 시스템 상태 확인
   * @apiName ChatbotHealth
   * @apiGroup Chatbot
   * 
   * @apiDescription 파이썬 설치 상태와 챗봇 모듈의 동작 상태를 확인합니다.
   * 모니터링이나 헬스체크에 사용할 수 있습니다.
   * 
   * @apiSuccess {String} status 전체 상태 (healthy/error)
   * @apiSuccess {Boolean} python_available 파이썬 설치 여부
   * @apiSuccess {Boolean} chatbot_module_available 챗봇 모듈 동작 여부
   * @apiSuccess {String} [error] 에러 메시지 (상태가 error인 경우)
   * 
   * @apiExample {curl} Example usage:
   *     curl -X GET http://localhost:3001/chatbot/health
   * 
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "status": "healthy",
   *       "python_available": true,
   *       "chatbot_module_available": true
   *     }
   * 
   * @apiErrorExample {json} Error-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "status": "error",
   *       "python_available": false,
   *       "chatbot_module_available": false,
   *       "error": "Python is not available"
   *     }
   */
  @Get('health')
  async checkHealth(
    @Res({ passthrough: true }) res: Response,
  ): Promise<ChatbotHealthDto> {
    const result = await this.chatbotService.checkHealth();
    
    // 헬스체크는 캐싱하지 않음
    res.setHeader('Cache-Control', 'no-cache');
    
    return result;
  }
}