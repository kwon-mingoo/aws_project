// AI 챗봇 서비스 - 파이썬 스크립트 실행 관리

import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { spawn } from 'child_process';
import { join } from 'path';
import { ChatbotQueryDto, ChatbotResponseDto, ChatbotHealthDto } from './dto/chatbot.dto';

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private readonly pythonScriptPath: string;
  private readonly timeout = 60000; // 60초 타임아웃

  constructor() {
    // 파이썬 스크립트 경로 설정
    this.pythonScriptPath = join(process.cwd(), 'python-scripts', 'api_wrapper.py');
    this.logger.log(`Python script path: ${this.pythonScriptPath}`);
  }

  /**
   * 챗봇에 질문을 전송하고 답변을 받습니다
   */
  async askChatbot(queryDto: ChatbotQueryDto): Promise<ChatbotResponseDto> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Processing query: ${queryDto.query.substring(0, 100)}...`);
      
      const result = await this.executePythonScript(queryDto.query);
      
      const processingTime = (Date.now() - startTime) / 1000;
      this.logger.log(`Query processed in ${processingTime.toFixed(2)}s, mode: ${result.mode}`);
      
      return result;
      
    } catch (error) {
      this.logger.error('Failed to process chatbot query', error);
      throw new InternalServerErrorException('챗봇 처리 중 오류가 발생했습니다.');
    }
  }

  /**
   * 챗봇 시스템 상태를 확인합니다
   */
  async checkHealth(): Promise<ChatbotHealthDto> {
    try {
      // 파이썬 설치 확인
      const pythonAvailable = await this.checkPythonAvailable();
      
      if (!pythonAvailable) {
        return {
          status: 'error',
          python_available: false,
          chatbot_module_available: false,
          error: 'Python is not available'
        };
      }

      // 챗봇 모듈 확인 (간단한 import 테스트)
      try {
        const result = await this.testPythonImport(); // 간단한 import 테스트
        return {
          status: 'healthy',
          python_available: true,
          chatbot_module_available: result
        };
      } catch (error) {
        return {
          status: 'error',
          python_available: true,
          chatbot_module_available: false,
          error: `Chatbot module error: ${error.message}`
        };
      }
      
    } catch (error) {
      this.logger.error('Health check failed', error);
      return {
        status: 'error',
        python_available: false,
        chatbot_module_available: false,
        error: error.message
      };
    }
  }

  /**
   * 파이썬 스크립트를 실행하고 결과를 파싱합니다
   */
  private async executePythonScript(query: string, timeoutMs?: number): Promise<ChatbotResponseDto> {
    return new Promise((resolve, reject) => {
      const timeout = timeoutMs || this.timeout;
      
      // 파이썬 프로세스 시작
      const pythonProcess = spawn('python3', [this.pythonScriptPath, query], {
        cwd: join(process.cwd(), 'python-scripts'),
        env: {
          ...process.env,
          PYTHONPATH: join(process.cwd(), 'python-scripts')
        }
      });

      let stdout = '';
      let stderr = '';
      let isResolved = false;

      // 타임아웃 설정
      const timer = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          pythonProcess.kill('SIGTERM');
          reject(new Error(`Python script timed out after ${timeout}ms`));
        }
      }, timeout);

      // stdout 데이터 수집
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // stderr 데이터 수집
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // 프로세스 종료 처리
      pythonProcess.on('close', (code) => {
        clearTimeout(timer);
        
        if (isResolved) return;
        isResolved = true;

        if (code !== 0) {
          this.logger.error(`Python script exited with code ${code}`);
          this.logger.error(`stderr: ${stderr}`);
          reject(new Error(`Python script failed with exit code ${code}: ${stderr}`));
          return;
        }

        try {
          // JSON 파싱
          const result = JSON.parse(stdout.trim());
          
          // 에러 응답 체크
          if (result.error) {
            this.logger.warn(`Python script returned error: ${result.error}`);
          }
          
          resolve(result as ChatbotResponseDto);
          
        } catch (parseError) {
          this.logger.error('Failed to parse Python script output', parseError);
          this.logger.error(`stdout: ${stdout}`);
          this.logger.error(`stderr: ${stderr}`);
          reject(new Error(`Failed to parse chatbot response: ${parseError.message}`));
        }
      });

      // 프로세스 에러 처리
      pythonProcess.on('error', (error) => {
        clearTimeout(timer);
        
        if (!isResolved) {
          isResolved = true;
          this.logger.error('Failed to start Python script', error);
          reject(new Error(`Failed to start Python process: ${error.message}`));
        }
      });
    });
  }

  /**
   * 파이썬 설치 확인
   */
  private async checkPythonAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const pythonProcess = spawn('python3', ['--version']);
      
      pythonProcess.on('close', (code) => {
        resolve(code === 0);
      });
      
      pythonProcess.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * 파이썬 모듈 import 테스트 (빠른 헬스체크용)
   */
  private async testPythonImport(): Promise<boolean> {
    return new Promise((resolve) => {
      const pythonProcess = spawn('python3', ['-c', 'import boto3, json; print("OK")'], {
        cwd: join(process.cwd(), 'python-scripts'),
        env: {
          ...process.env,
          PYTHONPATH: join(process.cwd(), 'python-scripts')
        }
      });

      let stdout = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.on('close', (code) => {
        resolve(code === 0 && stdout.trim() === 'OK');
      });

      pythonProcess.on('error', () => {
        resolve(false);
      });
    });
  }
}