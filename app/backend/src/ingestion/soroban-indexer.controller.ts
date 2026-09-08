import {
  BadRequestException,
  Body,
  Controller,
  ConflictException,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";

import { RequireScopes } from "../auth/decorators/require-scopes.decorator";
import { ApiKeyGuard } from "../auth/guards/api-key.guard";
import { SorobanEventIndexerService, LedgerRangeResult } from "./soroban-event-indexer.service";

/**
 * Largest ledger range a single reindex request may cover (~35 days of
 * ledgers at ~5s each). Larger ranges must be chunked into multiple calls;
 * this keeps one request from driving an unbounded Horizon scan.
 */
const MAX_REINDEX_LEDGERS = 50_000;

class ReindexDto {
  @IsString()
  @IsNotEmpty()
  contractId!: string;

  @IsInt()
  @Min(1)
  fromLedger!: number;

  @IsInt()
  @Min(1)
  toLedger!: number;

  /**
   * When true, ignores the stored checkpoint and re-processes the full range.
   * Idempotent upserts ensure no duplicate records are created.
   */
  @IsBoolean()
  @IsOptional()
  force?: boolean;
}

/**
 * Admin endpoint for triggering Soroban event reindexing over a ledger range.
 */
@ApiTags("indexer")
@UseGuards(ApiKeyGuard)
@Controller("indexer")
export class SorobanIndexerController {
  private running = false;

  constructor(private readonly indexer: SorobanEventIndexerService) {}

  @Post("reindex")
  @HttpCode(HttpStatus.OK)
  @RequireScopes("admin")
  @ApiOperation({
    summary: "Reindex Soroban contract events for a ledger range (admin only)",
    description:
      "Fetches and persists all contract events in [fromLedger, toLedger]. " +
      "Safe to call multiple times — idempotent upserts prevent duplicates. " +
      "Set force=true to ignore the stored checkpoint and reprocess the full range.",
  })
  @ApiResponse({ status: 200, description: "Reindex completed" })
  @ApiResponse({ status: 400, description: "Ledger range exceeds the per-request cap" })
  @ApiResponse({ status: 409, description: "A reindex run is already in progress" })
  async reindex(@Body() dto: ReindexDto): Promise<LedgerRangeResult> {
    if (dto.toLedger - dto.fromLedger > MAX_REINDEX_LEDGERS) {
      throw new BadRequestException({
        error: "RANGE_TOO_LARGE",
        message: `Ledger range exceeds the maximum of ${MAX_REINDEX_LEDGERS} ledgers per request; chunk the range and call again`,
      });
    }

    if (this.running) {
      throw new ConflictException("A reindex run is already in progress");
    }

    this.running = true;
    try {
      return await this.indexer.indexLedgerRange(
        dto.contractId,
        dto.fromLedger,
        dto.toLedger,
        undefined,
        dto.force ?? false,
      );
    } finally {
      this.running = false;
    }
  }
}
