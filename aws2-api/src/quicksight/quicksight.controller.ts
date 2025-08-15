// AWS QuickSight 대시보드 API 컨트롤러

import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { QuickSightService } from './quicksight.service';

@Controller('quicksight')
export class QuickSightController {
  constructor(private readonly quickSightService: QuickSightService) {}

  /**
   * @api {GET} /quicksight/dashboards/:type 타입별 대시보드 조회 및 상세 정보 반환 (임베드 URL 포함 가능)
   * @apiName GetDashboardByType
   * @apiGroup QuickSight
   * 
   * @apiDescription 지정된 센서 타입에 따라 해당 대시보드를 찾아서 상세 정보를 반환
   * includeEmbedUrl=true 파라미터 추가 시 익명 사용자용 임베드 URL도 함께 생성
   * 
   * @apiParam {String} type 센서 타입 (TEMPERATURE, HUMIDITY, CO_CONCENTRATION 중 하나)
   * @apiParam {String} [includeEmbedUrl] "true"일 때 임베드 URL 자동 생성 (익명 사용자, 1시간 유효)
   * 
   * @apiSuccess {Object} dashboard 대시보드 상세 정보
   * @apiSuccess {String} dashboardId 대시보드 ID
   * @apiSuccess {String} type 요청한 센서 타입
   * @apiSuccess {String} requestId AWS 요청 ID
   * @apiSuccess {String} [embedUrl] 임베드 URL (includeEmbedUrl=true일 때만)
   * @apiSuccess {String} [embedExpirationTime] 임베드 URL 만료 시간 (includeEmbedUrl=true일 때만)
   * 
   * @apiExample {curl} 대시보드 정보만 조회:
   *     curl -X GET "http://localhost:3000/quicksight/dashboards/TEMPERATURE"
   * 
   * @apiExample {curl} 임베드 URL 포함 조회:
   *     curl -X GET "http://localhost:3000/quicksight/dashboards/TEMPERATURE?includeEmbedUrl=true"
   * 
   * @apiSuccessExample {json} 기본 응답:
   *     HTTP/1.1 200 OK
   *     {
   *       "dashboard": {
   *         "dashboardId": "temperature-dashboard-2024",
   *         "name": "Temperature Monitoring Dashboard",
   *         "description": "Real-time temperature sensor monitoring",
   *         "arn": "arn:aws:quicksight:...",
   *         "createdTime": "2024-01-15T09:30:00Z",
   *         "version": {
   *           "versionNumber": 3,
   *           "status": "CREATION_SUCCESSFUL"
   *         }
   *       },
   *       "dashboardId": "temperature-dashboard-2024",
   *       "type": "TEMPERATURE",
   *       "requestId": "req-abc123"
   *     }
   * 
   * @apiSuccessExample {json} 임베드 URL 포함 응답:
   *     HTTP/1.1 200 OK
   *     {
   *       "dashboard": { ... },
   *       "dashboardId": "temperature-dashboard-2024",
   *       "type": "TEMPERATURE",
   *       "requestId": "req-abc123",
   *       "embedUrl": "https://quicksight.aws.amazon.com/embed/...",
   *       "embedExpirationTime": "2024-12-15T15:30:00Z"
   *     }
   * 
   * @apiError {Object} 400 지원하지 않는 센서 타입
   * @apiError {Object} 404 해당 타입의 대시보드를 찾을 수 없음
   */
  @Get('dashboards/:type')
  async getDashboardByType(
    @Param('type') type: string,
    @Res({ passthrough: true }) res: Response,
    @Query('includeEmbedUrl') includeEmbedUrl?: string,
  ) {
    // 지원되는 센서 타입 검증
    const validTypes = ['TEMPERATURE', 'HUMIDITY', 'CO_CONCENTRATION'];
    const normalizedType = type.toUpperCase().replace(/\s+/g, '_');
    
    if (!validTypes.includes(normalizedType)) {
      throw new BadRequestException(
        `Invalid sensor type. Supported types: ${validTypes.join(', ')}`,
      );
    }

    try {
      // 1단계: 모든 대시보드 목록 조회
      console.log(`타입별 대시보드 검색 시작: ${normalizedType}`);
      const dashboardsResponse = await this.quickSightService.listDashboards(100);
      
      if (!dashboardsResponse.DashboardSummaryList || dashboardsResponse.DashboardSummaryList.length === 0) {
        throw new NotFoundException('No dashboards found in QuickSight account');
      }

      // 2단계: 타입에 맞는 대시보드 찾기
      const targetDashboard = this.findDashboardByType(dashboardsResponse.DashboardSummaryList, normalizedType);
      
      if (!targetDashboard) {
        throw new NotFoundException(`No dashboard found for sensor type: ${normalizedType}`);
      }

      console.log(`대시보드 발견: ${targetDashboard.DashboardId} (${targetDashboard.Name})`);

      // 3단계: 선택된 대시보드의 상세 정보 조회
      const dashboardDetail = await this.quickSightService.describeDashboard(targetDashboard.DashboardId!);
      
      if (!dashboardDetail.Dashboard) {
        throw new NotFoundException(`Dashboard details not found: ${targetDashboard.DashboardId}`);
      }

      // 기본 응답 객체
      const response: any = {
        dashboard: dashboardDetail.Dashboard,
        dashboardId: targetDashboard.DashboardId,
        type: normalizedType,
        requestId: dashboardDetail.$metadata?.requestId,
      };

      // 임베드 URL 생성이 요청된 경우
      if (includeEmbedUrl === 'true') {
        console.log(`🌐 익명 사용자용 임베드 URL 자동 생성: ${targetDashboard.DashboardId}`);
        
        try {
          const embedResponse = await this.quickSightService.generateEmbedUrlForAnonymousUser(
            targetDashboard.DashboardId!,
            { sessionLifetimeInMinutes: 60 } // 기본 1시간
          );

          if (embedResponse.EmbedUrl) {
            response.embedUrl = embedResponse.EmbedUrl;
            response.embedExpirationTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
            
            // 임베드 URL은 캐시하지 않음
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        } catch (embedError) {
          console.error(`임베드 URL 생성 실패 (${targetDashboard.DashboardId}):`, embedError);
          // 임베드 URL 생성 실패해도 대시보드 정보는 반환
        }
      } else {
        // 캐시 설정 (임베드 URL 없는 경우에만)
        res.setHeader('Cache-Control', 'public, max-age=600');
      }

      return response;
      
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      console.error(`타입별 대시보드 조회 중 오류 발생 (${normalizedType}):`, error);
      throw new BadRequestException(
        `Failed to retrieve dashboard for type ${normalizedType}: ${error.message}`,
      );
    }
  }

  /**
   * 센서 타입에 따라 대시보드를 찾는 내부 메서드
   */
  private findDashboardByType(dashboards: any[], sensorType: string) {
    // 대시보드 이름이나 ID에서 센서 타입을 찾는 매핑 로직
    const typeMapping: { [key: string]: string[] } = {
      'TEMPERATURE': ['temperature', 'temp', '온도'],
      'HUMIDITY': ['humidity', 'hum', '습도'],
      'CO_CONCENTRATION': ['co', 'carbon', 'concentration', '일산화탄소', 'gas']
    };

    const searchTerms = typeMapping[sensorType] || [];
    
    for (const dashboard of dashboards) {
      const dashboardName = (dashboard.Name || '').toLowerCase();
      const dashboardId = (dashboard.DashboardId || '').toLowerCase();
      
      // 대시보드 이름이나 ID에서 검색어 찾기
      for (const term of searchTerms) {
        if (dashboardName.includes(term.toLowerCase()) || dashboardId.includes(term.toLowerCase())) {
          return dashboard;
        }
      }
    }
    
    return null;
  }




  /**
   * @api {GET} /quicksight/config 서비스 설정 정보 조회
   * @apiName GetConfig
   * @apiGroup QuickSight
   * 
   * @apiDescription QuickSight 서비스의 현재 설정 정보를 반환
   * 디버깅 및 설정 확인 용도로 사용
   * 
   * @apiSuccess {String} awsAccountId AWS 계정 ID
   * @apiSuccess {String} namespace QuickSight 네임스페이스
   * @apiSuccess {String} region AWS 리전
   * 
   * @apiExample {curl} Example usage:
   *     curl -X GET http://localhost:3000/quicksight/config
   * 
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "awsAccountId": "123456789012",
   *       "namespace": "default",
   *       "region": "ap-northeast-2"
   *     }
   */
  @Get('config')
  getConfig() {
    return this.quickSightService.getAccountInfo();
  }
}