import { Module } from '@nestjs/common';
import { SupportBundleService } from './support-bundle.service';
import { SupportBundleController } from './support-bundle.controller';
import { ContractsModule } from '../contracts/contracts.module';
import { IndexerLagModule } from '../indexer-lag/indexer-lag.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { AuditModule } from '../audit/audit.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';

@Module({
  imports: [ContractsModule, IndexerLagModule, IngestionModule, AuditModule, ApiKeysModule],
  controllers: [SupportBundleController],
  providers: [SupportBundleService],
  exports: [SupportBundleService],
})
export class SupportBundleModule {}
