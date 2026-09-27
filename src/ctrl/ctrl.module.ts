import { Module } from '@nestjs/common';
import { CtrlController } from './ctrl.controller';
import { CtrlTpvRepository } from './infrastructure/ctrl-tpv.repository';
import { CtrlUseCase } from './application/use-cases/ctrl.use-case';
import { CTRL_REPOSITORY, CTRL_USE_CASE } from './ctrl.tokens';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CtrlController],
  providers: [
    { provide: CTRL_REPOSITORY, useClass: CtrlTpvRepository },
    { provide: CTRL_USE_CASE, useClass: CtrlUseCase },
  ],
  exports: [CTRL_USE_CASE],
})
export class CtrlModule {}
