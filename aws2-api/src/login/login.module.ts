import { Module } from '@nestjs/common';
import { LoginController } from './login.controller';
import { LoginService } from './login.service';

@Module({
  controllers: [LoginController],
  providers: [LoginService],
  exports: [LoginService], // 다른 모듈에서 사용할 수 있도록 export
})
export class LoginModule {}