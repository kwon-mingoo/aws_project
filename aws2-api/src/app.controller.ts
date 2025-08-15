import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * @api {GET} / 애플리케이션 기본 정보 조회
   * @apiName GetHello
   * @apiGroup App
   * 
   * @apiDescription 애플리케이션이 정상적으로 작동하는지 확인하는 기본 엔드포인트
   * 
   * @apiSuccess {String} message "Hello World!" 메시지 반환
   * 
   * @apiExample {curl} Example usage:
   *     curl -X GET http://localhost:3000/
   * 
   * @apiSuccessExample {String} Success-Response:
   *     HTTP/1.1 200 OK
   *     "Hello World!"
   */
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
