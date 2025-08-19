import { Module } from '@nestjs/common';
import { ControlController } from './control.controller';
import { ControlService } from './control.service';
import { IoTService } from './services/iot.service';

@Module({
  controllers: [ControlController],
  providers: [ControlService, IoTService],
  exports: [ControlService, IoTService],
})
export class ControlModule {}