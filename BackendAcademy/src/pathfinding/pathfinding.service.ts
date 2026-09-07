import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PathfindingQuoteDto } from './dto/pathfinding-quote.dto';
import { PathHop, PathQuote } from './interfaces/pathfinding.interface';

/** Horizon API base URLs. */
const HORIZON_TESTNET_URL = 'https://horizon-testnet.stellar.org';
const HORIZON_PUBLIC_URL = 'https://horizon.stellar.org';

/** Default simulated spread for stub fallback (0.5%). */
const STUB_FEE_RATE = 0.005;
const STUB_SETTLE_SECONDS = 5;

/**
 * Build a Stellar asset identifier string for Horizon queries.
 * Native XLM is represented as "native", issued assets as "CODE:ISSUER".
 */
function assetString(code: string, issuer: string | null): string {
  if (!issuer) return 'native';
  return `${code}:${issuer}`;
}

/**
 * PathfindingService
 *
 * Queries Stellar Horizon's strict-send-paths endpoint to find optimal
 * payment routes between assets. Falls back to deterministic stub quotes
 * for development and testing.
 *
 * ## Horizon Integration
 *
 * Calls `GET /paths/strict-send?source_asset_type=...&source_amount=...&destination_asset_type=...`
 * to discover payment paths. The response includes path hops with
 * intermediate assets and amounts.
 *
 * ## Error handling
 *
 * - Invalid amounts → BadRequestException
 * - Horizon unavailable → falls back to stub with warning
 * - Unsupported asset pairs → empty hops with zero settlement estimate
 */
@Injectable()
export class PathfindingService {
  private readonly logger = new Logger(PathfindingService.name);

  /**
   * Get an optimal payment path quote for a given source/destination pair.
   */
  async quotePathPayment(dto: PathfindingQuoteDto): Promise<PathQuote> {
    const sourceNum = Number(dto.sourceAmount);

    if (!Number.isFinite(sourceNum) || sourceNum <= 0) {
      throw new BadRequestException(
        `Invalid sourceAmount: ${dto.sourceAmount}. Must be a positive decimal.`,
      );
    }

    // Attempt Horizon path-finding
    try {
      return await this.queryHorizonPaths(dto, sourceNum);
    } catch (err) {
      this.logger.warn(
        `Horizon path-finding failed (${(err as Error)?.message}), using stub quote`,
      );
    }

    // Fallback stub
    return this.stubQuote(dto, sourceNum);
  }

  /**
   * Query Horizon's strict-send-paths endpoint.
   */
  private async queryHorizonPaths(
    dto: PathfindingQuoteDto,
    _sourceAmount: number,
  ): Promise<PathQuote> {
    const baseUrl =
      process.env.STELLAR_NETWORK === 'mainnet'
        ? HORIZON_PUBLIC_URL
        : HORIZON_TESTNET_URL;

    const sourceAsset = assetString(dto.sourceAssetCode, dto.sourceAssetIssuer);
    const destAsset = assetString(dto.destinationAssetCode, dto.destinationAssetIssuer);

    const params = new URLSearchParams({
      source_asset_type: sourceAsset,
      source_amount: dto.sourceAmount,
      destination_asset_type: destAsset,
    });

    const url = `${baseUrl}/paths/strict-send?${params}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Horizon returned ${response.status}`);
    }

    const data = await response.json();
    const records = data._embedded?.records || [];

    if (records.length === 0) {
      return {
        sourceAmount: dto.sourceAmount,
        destinationAmount: '0.0000000',
        hops: [],
        estimatedSettleSeconds: 0,
      };
    }

    // Use the best path (first record — Horizon sorts by best rate)
    const best = records[0];
    const hops: PathHop[] = (best.path || []).map((p: any) => ({
      assetCode: p.asset_code || 'XLM',
      assetIssuer: p.asset_issuer || null,
      amount: p.amount || '0',
    }));

    return {
      sourceAmount: dto.sourceAmount,
      destinationAmount: best.destination_amount || '0.0000000',
      hops,
      estimatedSettleSeconds: STUB_SETTLE_SECONDS,
    };
  }

  /**
   * Deterministic stub quote for development/testing.
   */
  private stubQuote(dto: PathfindingQuoteDto, sourceNum: number): PathQuote {
    const destNum = sourceNum * (1 - STUB_FEE_RATE);
    const singleHop: PathHop = {
      assetCode: dto.destinationAssetCode,
      assetIssuer: dto.destinationAssetIssuer,
      amount: destNum.toFixed(7),
    };

    return {
      sourceAmount: dto.sourceAmount,
      destinationAmount: destNum.toFixed(7),
      hops: [singleHop],
      estimatedSettleSeconds: STUB_SETTLE_SECONDS,
    };
  }
}
