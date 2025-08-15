// AI 챗봇 API DTO 정의

import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ChatbotQueryDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsOptional()
  @IsString()
  session_id?: string;
}

export class ChatbotResponseDto {
  answer: string;
  route: 'sensor' | 'general' | 'sensor_cache' | 'sensor_detail' | 'error';
  session_id: string;
  turn_id: number;
  processing_time: number;
  mode: string;
  docs_found?: number;
  top_score?: number;
  error?: string;
  traceback?: string;
}

export class ChatbotHealthDto {
  status: 'healthy' | 'error';
  python_available: boolean;
  chatbot_module_available: boolean;
  error?: string;
}