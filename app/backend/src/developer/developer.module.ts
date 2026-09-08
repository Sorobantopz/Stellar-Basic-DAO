import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { DeveloperController } from './developer.controller';
import { DeveloperService } from './developer.service';

@Module({
  imports: [ApiKeysModule, NotificationsModule, AuditModule],
  controllers: [DeveloperController],
  providers: [DeveloperService, ApiKeyGuard],
})
export class DeveloperModule {}
