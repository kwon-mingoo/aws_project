// AWS S3 mintrend 데이터 API 컨트롤러

import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { S3Service } from './s3.service';

@Controller('s3')
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  /**
   * @api {GET} /s3/file/last/mintrend 최신 mintrend 데이터 조회
   * @apiName GetLastMintrendData
   * @apiGroup S3
   * 
   * @apiDescription mintrend 폴더에서 가장 최신 파일의 마지막 데이터를 조회
   * 실시간 모니터링이나 대시보드에서 최신 센서 값을 표시하는데 사용
   * 
   * @apiSuccess {String} filename 파일명
   * @apiSuccess {Object} data 마지막 데이터 객체
   * 
   * @apiExample {curl} Example usage:
   *     curl -X GET http://localhost:3000/s3/file/last/mintrend
   * 
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "filename": "202508121348_mintrend.json",
   *       "data": {
   *         "timestamp": "2025-08-12T13:48:00",
   *         "mintemp": 25.92,
   *         "minhum": 62.22,
   *         "mingas": 966.08
   *       }
   *     }
   */
  @Get('file/last/mintrend')
  async getLastDataFromLatestMintrendFile(
    @Res({ passthrough: true }) res: Response,
  ) {
    const latestFileKey = await this.s3Service.getLatestMintrendFile();

    if (!latestFileKey) {
      throw new NotFoundException('No files found in mintrend folder');
    }

    const data = await this.fetch(latestFileKey);
    const filename = latestFileKey.split('/').pop() || latestFileKey;

    if (Array.isArray(data) && data.length > 0) {
      const lastIndex = data.length - 1;
      const lastData = data[lastIndex];

      res.setHeader('Cache-Control', 'public, max-age=29');
      return {
        filename,
        data: lastData,
      };
    }

    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      res.setHeader('Cache-Control', 'public, max-age=29');
      // JSON 파일에 이미 filename, data 구조가 있는 경우 그대로 반환
      if (data.filename && data.data) {
        return data;
      }
      // 그렇지 않으면 래핑해서 반환
      return {
        filename,
        data: data,
      };
    }

    throw new BadRequestException(
      'Unsupported data format. Expected array or object.',
    );
  }

  /**
   * @api {GET} /s3/history/:date 날짜별 mintrend 데이터 내역 조회
   * @apiName GetMintrendHistory
   * @apiGroup S3
   * 
   * @apiDescription 특정 날짜의 모든 mintrend 파일 데이터를 시간순으로 조회
   * 일일 트렌드 분석이나 데이터 히스토리 추적에 사용
   * 
   * @apiParam {String} date 날짜 (YYYYMMDD 형식, 예: 20250812)
   * 
   * @apiSuccess {String} date 요청한 날짜
   * @apiSuccess {Number} totalFiles 총 파일 수
   * @apiSuccess {Object[]} files 파일 데이터 배열 (최신순 정렬)
   * @apiSuccess {String} files.filename 파일명
   * @apiSuccess {Object} files.data 파일 내 데이터
   * 
   * @apiExample {curl} Example usage:
   *     curl -X GET http://localhost:3000/s3/history/20250812
   * 
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "date": "20250812",
   *       "totalFiles": 32,
   *       "files": [
   *         {
   *           "filename": "202508121412_mintrend.json",
   *           "data": {
   *             "timestamp": "2025-08-12T14:12:00",
   *             "mintemp": 26.18,
   *             "minhum": 61.16
   *           }
   *         }
   *       ]
   *     }
   * 
   * @apiError {Object} 400 잘못된 날짜 형식
   * @apiError {Object} 404 해당 날짜에 파일이 없음
   */
  @Get('history/:date')
  async getHistoryByDate(
    @Param('date') date: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!/^\d{8}$/.test(date)) {
      throw new BadRequestException(
        'Invalid date format. Use YYYYMMDD (e.g., 20250812)',
      );
    }

    try {
      const fileKeys = await this.s3Service.getFilesByDate(date, 'mintrend');

      if (fileKeys.length === 0) {
        throw new NotFoundException(`No mintrend files found for date: ${date}`);
      }

      const filesData: Record<string, any> = {};

      await Promise.all(
        fileKeys.map(async (key) => {
          try {
            const filename = key.split('/').pop() || key;
            const data = await this.s3Service.getJson(key);
            filesData[filename] = data;
          } catch (error) {
            console.error(`Error reading file ${key}:`, error);
            const filename = key.split('/').pop() || key;
            filesData[filename] = { error: 'Failed to read file' };
          }
        }),
      );

      const sortedFiles = Object.keys(filesData)
        .map(filename => ({
          filename,
          ...filesData[filename]
        }))
        .sort((a, b) => {
          const timestampA = a.filename.match(/^(\d{12})/)?.[1] || '0';
          const timestampB = b.filename.match(/^(\d{12})/)?.[1] || '0';
          return parseInt(timestampB) - parseInt(timestampA);
        });

      res.setHeader('Cache-Control', 'public, max-age=600');

      return {
        date,
        totalFiles: fileKeys.length,
        files: sortedFiles,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      console.error(`Error getting mintrend data for date ${date}:`, error);
      throw new BadRequestException(
        `Failed to retrieve mintrend data for date: ${date}`,
      );
    }
  }

  /**
   * S3 JSON 파일 가져오기 및 에러 처리 내부 메서드
   */
  private async fetch(key: string) {
    try {
      const data = await this.s3Service.getJson(key);

      if (typeof data !== 'object' || data === null) {
        throw new BadRequestException('S3 object is not valid JSON');
      }

      return data;
    } catch (err: any) {
      const code = err?.$metadata?.httpStatusCode;

      if (code === 404 || err?.name === 'NoSuchKey') {
        throw new NotFoundException(`S3 object not found: ${key}`);
      }

      if (err?.message?.includes('S3_BUCKET_NAME is not set')) {
        throw new BadRequestException(
          'Server misconfig: S3_BUCKET_NAME missing',
        );
      }

      throw err;
    }
  }
}