import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [ApiKeysModule, SupabaseModule],
  controllers: [AuditController],
  providers: [AuditService, ApiKeyGuard],
  exports: [AuditService],
})
export class AuditModule {}
