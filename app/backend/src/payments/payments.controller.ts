import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";

import { HorizonService } from "../transactions/horizon.service";

type RecentPaymentsQuery = {
  address: string;
  since?: string; // ISO timestamp or epoch ms
  limit?: number;
};

@ApiTags("payments")
@Controller("payments")
export class PaymentsController {
  constructor(private readonly horizonService: HorizonService) {}

  @Get("recent")
  @ApiOperation({
    summary: "Fetch recent payments for an address (since timestamp)",
  })
  @ApiResponse({ status: 200, description: "List of recent payments" })
  async recent(@Query() query: RecentPaymentsQuery) {
    const { address, since, limit = 20 } = query;

    if (!address) {
      return { items: [] };
    }

    // HorizonService.getPayments returns items sorted desc by created_at.
    // Clamp the limit so a hostile ?limit=1e9 can't balloon the response.
    const effectiveLimit = clampLimit(limit, 20);
    const resp = await this.horizonService.getPayments(
      address,
      undefined,
      effectiveLimit,
    );

    const sinceTs = since ? parseSince(since) : undefined;

    const filtered = sinceTs
      ? resp.items.filter((it) => new Date(it.timestamp).getTime() > sinceTs)
      : resp.items;

    return { items: filtered };
  }
}

function parseSince(raw?: string): number | undefined {
  if (!raw) return undefined;
  // accept epoch ms or ISO
  const n = Number(raw);
  if (!Number.isNaN(n) && n > 0) return n;
  const d = Date.parse(raw);
  return Number.isNaN(d) ? undefined : d;
}

/**
 * Clamp a pagination limit to 1-100 (default 20); NaN/negative falls back.
 */
function clampLimit(limit: number | undefined, fallback: number): number {
  if (limit === undefined || Number.isNaN(limit)) return fallback;
  return Math.min(100, Math.max(1, Math.floor(limit)));
}
