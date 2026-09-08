import { Injectable, Logger } from '@nestjs/common';
import { AuditLog, QueryAuditLogsDto } from './audit.model';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';

/** Cap for the in-memory audit buffer (fallback when the store is down). */
const MAX_IN_MEMORY_LOGS = 10_000;
/** Max rows pulled from the DB per read; prevents full-table scans in memory. */
const MAX_DB_LOGS_FETCH = 10_000;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private logs: AuditLog[] = [];

  constructor(private readonly supabaseService: SupabaseService) {}

  async log(
    actor: string,
    action: string,
    target?: string,
    metadata?: Record<string, unknown>,
    requestId?: string,
  ): Promise<void> {
    const entry: AuditLog = {
      id: randomUUID(),
      actor,
      action,
      target,
      metadata,
      requestId,
      createdAt: new Date(),
    };
    this.logs.push(entry);
    // Bound the in-memory fallback buffer so a long-running process cannot
    // accumulate an unbounded number of entries (each with metadata) in RAM.
    // The authoritative copy lives in the database; this buffer is only used
    // when the store is unavailable.
    if (this.logs.length > MAX_IN_MEMORY_LOGS) {
      this.logs = this.logs.slice(-MAX_IN_MEMORY_LOGS);
    }
    this.logger.log(`Audit Event: ${action} by ${actor}`);

    try {
      const client = this.supabaseService.getClient();
      const { error } = await client.from('admin_audit_logs').insert({
        id: entry.id,
        actor: entry.actor,
        action: entry.action,
        target: entry.target ?? null,
        metadata: entry.metadata ?? {},
        request_id: entry.requestId ?? null,
        created_at: entry.createdAt.toISOString(),
      });

      if (error) {
        this.logger.warn(`Failed to persist audit log ${entry.id}: ${error.message}`);
      }
    } catch (error) {
      this.logger.warn(
        `Audit store unavailable, keeping in-memory copy only: ${(error as Error).message}`,
      );
    }
  }

  async query(dto: QueryAuditLogsDto) {
    let result = await this.readLogs();

    if (dto.action) {
      result = result.filter(log => log.action === dto.action);
    }
    if (dto.actor) {
      result = result.filter(log => log.actor === dto.actor);
    }
    if (dto.startTime) {
      const start = new Date(dto.startTime).getTime();
      result = result.filter(log => log.createdAt.getTime() >= start);
    }
    if (dto.endTime) {
      const end = new Date(dto.endTime).getTime();
      result = result.filter(log => log.createdAt.getTime() <= end);
    }

    // Pagination (clamped: page >= 1, limit 1-200 to bound memory/CPU)
    const rawPage = Number(dto.page);
    const rawLimit = Number(dto.limit);
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(200, Math.floor(rawLimit)) : 50;
    const startIndex = (page - 1) * limit;
    const paginated = result.slice(startIndex, startIndex + limit);

    return {
      data: paginated,
      total: result.length,
      page,
      limit,
    };
  }

  async exportCsv(): Promise<string> {
    const logs = await this.readLogs();
    if (logs.length === 0) return 'id,actor,action,target,requestId,createdAt\n';
    
    const header = 'id,actor,action,target,requestId,createdAt\n';
    const rows = logs.map(log => {
      return [
        log.id,
        log.actor,
        log.action,
        log.target || '',
        log.requestId || '',
        log.createdAt.toISOString(),
      ]
        .map(this.escapeCsvCell)
        .join(',');
    }).join('\n');
    
    return header + rows;
  }

  /**
   * Escape a single CSV cell: quote delimiters and neutralize spreadsheet
   * formula prefixes so a crafted actor/action cannot inject columns or
   * execute formulas when the export is opened in Excel/Sheets.
   */
  private escapeCsvCell(value: string): string {
    let safe = value;
    if (/^[=+\-@\t\r]/.test(safe)) {
      safe = `'${safe}`;
    }
    if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
      return `"${safe.replace(/"/g, '""')}"`;
    }
    return safe;
  }

  async applyRetention(days: number = 90) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const initialCount = this.logs.length;
    this.logs = this.logs.filter(log => log.createdAt > cutoff);
    const deletedCount = initialCount - this.logs.length;

    try {
      const client = this.supabaseService.getClient();
      await client.from('admin_audit_logs').delete().lt('created_at', cutoff.toISOString());
    } catch (error) {
      this.logger.warn(
        `Failed to apply audit retention in store: ${(error as Error).message}`,
      );
    }
    
    this.logger.log(`Applied retention policy: deleted ${deletedCount} logs older than ${days} days`);
    return { deletedCount };
  }

  private async readLogs(): Promise<AuditLog[]> {
    try {
      const client = this.supabaseService.getClient();
      const { data, error } = await client
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(MAX_DB_LOGS_FETCH);

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) => ({
        id: String(row.id),
        actor: String(row.actor),
        action: String(row.action),
        target: row.target ? String(row.target) : undefined,
        metadata:
          row.metadata && typeof row.metadata === 'object'
            ? (row.metadata as Record<string, unknown>)
            : undefined,
        requestId: row.request_id ? String(row.request_id) : undefined,
        createdAt: new Date(String(row.created_at)),
      }));
    } catch (error) {
      this.logger.warn(
        `Reading audit logs from memory fallback: ${(error as Error).message}`,
      );
      return [...this.logs].sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );
    }
  }
}
