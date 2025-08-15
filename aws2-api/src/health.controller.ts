import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  /**
   * @api {GET} /healthz 애플리케이션 헬스체크 (기존)
   * @apiName HealthCheck
   * @apiGroup Health
   * 
   * @apiDescription 애플리케이션의 상태를 확인하는 헬스체크 엔드포인트
   * 로드 밸런서나 모니터링 시스템에서 서비스 상태를 확인하는데 사용
   * 
   * @apiSuccess {Boolean} ok 애플리케이션 정상 상태 (항상 true)
   * 
   * @apiExample {curl} Example usage:
   *     curl -X GET http://localhost:3000/healthz
   * 
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "ok": true
   *     }
   */
  @Get('healthz')
  healthz() {
    return { 
      ok: true,
      timestamp: new Date().toISOString(),
      service: 'aws2-giot-backend',
      version: process.env.npm_package_version || '1.0.0'
    };
  }

  /**
   * @api {GET} /health 애플리케이션 헬스체크 (ALB 표준)
   * @apiName StandardHealthCheck
   * @apiGroup Health
   * 
   * @apiDescription ALB와 표준 모니터링 시스템 호환을 위한 헬스체크 엔드포인트
   * AWS Application Load Balancer의 기본 health check 경로
   * 
   * @apiSuccess {Boolean} ok 애플리케이션 정상 상태 (항상 true)
   * @apiSuccess {String} timestamp 현재 시간
   * @apiSuccess {String} service 서비스 이름
   * @apiSuccess {String} version 애플리케이션 버전
   * 
   * @apiExample {curl} Example usage:
   *     curl -X GET http://localhost:3001/health
   * 
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "ok": true,
   *       "timestamp": "2024-01-15T10:30:45.123Z",
   *       "service": "aws2-giot-backend",
   *       "version": "1.0.0"
   *     }
   */
  @Get('health')
  health() {
    return { 
      ok: true,
      timestamp: new Date().toISOString(),
      service: 'aws2-giot-backend',
      version: process.env.npm_package_version || '1.0.0'
    };
  }
}
