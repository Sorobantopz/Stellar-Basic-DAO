import { Module } from '@nestjs/common';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysRepository } from './api-keys.repository';
import { SupabaseModule } from '../supabase/supabase.module';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';

@Module({
  imports: [SupabaseModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeysRepository, ApiKeyGuard],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
