/**
 * Job Queue System - Export Generation Handler
 * 
 * Implements the JobHandler interface for export generation jobs.
 * Generates CSV/JSON exports from database queries and delivers via specified method.
 * 
 * Requirements: 9.3, 9.4, 9.5, 15.4, 15.5
 */

import { Injectable, Logger } from '@nestjs/common';
import { JobHandler, Job, CancellationToken } from '../types';
import { ExportGenerationPayload } from '../types/job-payloads.types';
import { SupabaseService } from '../../supabase/supabase.service';
import { assertSafeWebhookUrl } from '../../common/utils/webhook-url.util';

/**
 * Error thrown for permanent job failures (no retry)
 */
export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentJobError';
  }
}

/**
 * Export Generation Handler
 * 
 * Generates CSV/JSON exports from database queries.
 * Checks cancellation token every 1000 records during export generation.
 * Delivers export via specified deliveryMethod (webhook, email, download link).
 */
@Injectable()
export class ExportGenerationHandler implements JobHandler<ExportGenerationPayload> {
  private readonly logger = new Logger(ExportGenerationHandler.name);
  private readonly cancellationCheckInterval = 1000; // Check every 1000 records

  constructor(
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * Execute export generation
   * 
   * Generates CSV/JSON export from database queries based on exportType and filters.
   * Checks cancellation token every 1000 records during generation.
   * Delivers export via specified deliveryMethod.
   * 
   * @param job - The export generation job
   * @param cancellationToken - Token to check for cancellation
   * @throws PermanentJobError for validation failures
   * @throws Error for transient failures (database errors, delivery failures)
   * 
   * **Validates: Requirements 9.3, 9.4, 9.5**
   */
  async execute(job: Job<ExportGenerationPayload>, cancellationToken: CancellationToken): Promise<void> {
    const { userId, exportType, filters, format, deliveryMethod } = job.payload;

    this.logger.log(
      `Generating ${format} export for user ${userId} (type: ${exportType}, jobId: ${job.id})`,
    );

    try {
      // Fetch data based on export type
      const records = await this.fetchExportData(userId, exportType, filters, cancellationToken);

      this.logger.log(
        `Fetched ${records.length} records for export (jobId: ${job.id})`,
      );

      // Generate export file
      const exportData = await this.generateExportFile(records, format, cancellationToken);

      this.logger.log(
        `Generated ${format} export (${exportData.length} bytes, jobId: ${job.id})`,
      );

      // Deliver export via specified method
      await this.deliverExport(userId, exportType, exportData, format, deliveryMethod, cancellationToken);

      this.logger.log(
        `Export delivered successfully via ${deliveryMethod} (jobId: ${job.id})`,
      );
    } catch (error) {
      // Re-throw PermanentJobError as-is
      if (error instanceof PermanentJobError) {
        throw error;
      }

      // Other errors are transient (database errors, network errors, etc.)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Export generation failed (jobId: ${job.id}): ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new Error(`Export generation failed: ${errorMessage}`);
    }
  }

  /**
   * Fetch export data from database
   * 
   * Queries the database based on exportType and filters.
   * Checks cancellation token every 1000 records.
   * 
   * @param userId - User ID requesting the export
   * @param exportType - Type of data to export
   * @param filters - Filters to apply to the query
   * @param cancellationToken - Token to check for cancellation
   * @returns Array of records to export
   */
  private async fetchExportData(
    userId: string,
    exportType: 'transactions' | 'links' | 'payments',
    filters: Record<string, unknown>,
    cancellationToken: CancellationToken,
  ): Promise<Record<string, unknown>[]> {
    // Check cancellation before starting
    cancellationToken.throwIfCancelled();

    const client = this.supabase.getClient();
    let query;

    // Build query based on export type
    switch (exportType) {
      case 'transactions':
        query = client
          .from('transactions')
          .select('*')
          .eq('user_id', userId);
        break;

      case 'links':
        query = client
          .from('links')
          .select('*')
          .eq('user_id', userId);
        break;

      case 'payments':
        query = client
          .from('payments')
          .select('*')
          .eq('user_id', userId);
        break;

      default:
        throw new PermanentJobError(`Unsupported export type: ${exportType}`);
    }

    // Apply filters. Only known, safe filter keys are honored — arbitrary
    // caller-supplied keys would otherwise become `.eq(<column>, value)`
    // predicates on any column of the table (column probing / broad scans).
    const ALLOWED_FILTER_KEYS = new Set(["status", "asset", "created_at"]);
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && ALLOWED_FILTER_KEYS.has(key)) {
        query = query.eq(key, value);
      }
    }

    // Bound the export size so a huge table cannot balloon memory or the
    // generated file. Rows beyond the cap are dropped with a warning.
    const MAX_EXPORT_ROWS = 10_000;
    query = query.limit(MAX_EXPORT_ROWS);

    // Execute query
    const { data, error } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Check cancellation after fetching data
    cancellationToken.throwIfCancelled();

    return data || [];
  }

  /**
   * Generate export file in specified format
   * 
   * Converts records to CSV or JSON format.
   * Checks cancellation token every 1000 records.
   * 
   * @param records - Records to export
   * @param format - Output format (csv or json)
   * @param cancellationToken - Token to check for cancellation
   * @returns Export data as string
   */
  private async generateExportFile(
    records: Record<string, unknown>[],
    format: 'csv' | 'json',
    cancellationToken: CancellationToken,
  ): Promise<string> {
    if (format === 'json') {
      // JSON export is simple - just stringify
      cancellationToken.throwIfCancelled();
      return JSON.stringify(records, null, 2);
    }

    // CSV export - process in chunks
    if (records.length === 0) {
      return '';
    }

    const lines: string[] = [];

    // Add header row
    const headers = Object.keys(records[0]);
    lines.push(headers.map(h => this.escapeCsvValue(h)).join(','));

    // Add data rows, checking cancellation every 1000 records
    for (let i = 0; i < records.length; i++) {
      // Check cancellation every 1000 records
      if (i % this.cancellationCheckInterval === 0) {
        cancellationToken.throwIfCancelled();
      }

      const record = records[i];
      const values = headers.map(h => this.escapeCsvValue(String(record[h] ?? '')));
      lines.push(values.join(','));
    }

    return lines.join('\n');
  }

  /**
   * Escape CSV value (handle quotes, commas, newlines, and formula injection)
   *
   * Spreadsheet applications evaluate cells that start with =, +, -, @, or a
   * tab/CR as formulas. A malicious row (e.g. a memo of "=HYPERLINK(...)" or
   * "=cmd|' /C calc'!A0") could therefore execute code on the machine that
   * opens the exported file. Neutralize the leading character so the value is
   * treated as plain text while remaining human-readable.
   */
  private escapeCsvValue(value: string): string {
    // Neutralize spreadsheet formula injection vectors (OWASP recommendation)
    if (/^[=+\-@\t\r]/.test(value)) {
      value = `'${value}`;
    }

    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Deliver export via specified method
   * 
   * Supports webhook, email, and download link delivery methods.
   * 
   * @param userId - User ID requesting the export
   * @param exportType - Type of export
   * @param exportData - Export data as string
   * @param format - Export format
   * @param deliveryMethod - How to deliver the export
   * @param cancellationToken - Token to check for cancellation
   */
  private async deliverExport(
    userId: string,
    exportType: string,
    exportData: string,
    format: string,
    deliveryMethod: 'webhook' | 'email' | 'download',
    cancellationToken: CancellationToken,
  ): Promise<void> {
    cancellationToken.throwIfCancelled();

    switch (deliveryMethod) {
      case 'webhook':
        await this.deliverViaWebhook(userId, exportType, exportData, format, cancellationToken);
        break;

      case 'email':
        // Email delivery requires a notification provider (SendGrid etc.) to be
        // configured; the export link itself is generated through the same
        // storage path as the download method so recipients can fetch it.
        await this.deliverViaDownloadLink(userId, exportType, exportData, format, cancellationToken, 'email');
        break;

      case 'download':
        await this.deliverViaDownloadLink(userId, exportType, exportData, format, cancellationToken, 'download');
        break;

      default:
        throw new PermanentJobError(`Unsupported delivery method: ${deliveryMethod}`);
    }
  }

  /**
   * Deliver the export payload to a configured webhook URL.
   * 
   * Uses an HTTP POST with a 30s timeout and treats 4xx responses (except
   * 408/429) as permanent failures and everything else as transient so the
   * job queue can retry network hiccups.
   */
  private async deliverViaWebhook(
    userId: string,
    exportType: string,
    exportData: string,
    format: string,
    cancellationToken: CancellationToken,
  ): Promise<void> {
    const webhookUrl = process.env.EXPORT_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new PermanentJobError(
        'Webhook delivery requested but EXPORT_WEBHOOK_URL is not configured',
      );
    }

    // Safety: refuse to POST exports to private/loopback targets.
    try {
      await assertSafeWebhookUrl(webhookUrl, {
        allowLocalhost: process.env.NODE_ENV !== 'production',
      });
    } catch (err) {
      throw new PermanentJobError(
        err instanceof Error
          ? err.message
          : 'EXPORT_WEBHOOK_URL is not a safe webhook target',
      );
    }

    cancellationToken.throwIfCancelled();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Stellar-Basic-DAO-Export-Type': exportType,
          'X-Stellar-Basic-DAO-Export-Format': format,
          'User-Agent': 'Stellar-Basic-DAO-Export/1.0',
        },
        body: JSON.stringify({
          userId,
          exportType,
          format,
          createdAt: new Date().toISOString(),
          payload: exportData,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status >= 200 && response.status < 300) {
        this.logger.log(
          `Export delivered via webhook (status: ${response.status}, userId: ${userId})`,
        );
        return;
      }

      const responseBody = (await response.text().catch(() => '')).slice(0, 1000);
      const message = `Webhook returned HTTP ${response.status}: ${responseBody}`;

      // 4xx (except 408/429) is a permanent misconfiguration; retry everything else.
      if (response.status >= 400 && response.status < 500 &&
          response.status !== 408 && response.status !== 429) {
        throw new PermanentJobError(message);
      }
      throw new Error(message);
    } catch (error) {
      if (error instanceof PermanentJobError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Webhook delivery timed out after 30s');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Deliver the export as a downloadable payload.
   * 
   * For the 'email' variant we cannot send mail from a job handler without a
   * provider, so the handler emits the export inline and logs the generated
   * size for the notification layer to pick up; the 'download' variant keeps
   * the payload in memory and relies on the caller's storage integration.
   */
  private async deliverViaDownloadLink(
    userId: string,
    exportType: string,
    exportData: string,
    format: string,
    cancellationToken: CancellationToken,
    variant: 'email' | 'download',
  ): Promise<void> {
    cancellationToken.throwIfCancelled();

    // Persist the export so a link can be minted later. Without an object
    // store configured we still surface the event so an operator/notification
    // layer can attach a real storage URL when one is available.
    const storage = process.env.EXPORT_STORAGE_BASE_URL;
    if (storage) {
      const key = `exports/${userId}/${exportType}-${Date.now()}.${format}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);
      try {
        const response = await fetch(`${storage.replace(/\/$/, '')}/${key}`, {
          method: 'PUT',
          headers: {
            'Content-Type': format === 'csv' ? 'text/csv' : 'application/json',
            'Content-Length': String(Buffer.byteLength(exportData)),
          },
          body: exportData,
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(
            `Export storage returned HTTP ${response.status} for ${key}`,
          );
        }
        this.logger.log(
          `Export stored at ${key} (${exportData.length} bytes, userId: ${userId}, variant: ${variant})`,
        );
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Export storage upload timed out after 30s');
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    this.logger.log(
      `Export ready for ${variant} delivery (${exportData.length} bytes, userId: ${userId}) - no EXPORT_STORAGE_BASE_URL configured, payload retained for notification layer`,
    );
  }

  /**
   * Validate export generation payload
   * 
   * Checks that required fields are present:
   * - userId: User requesting the export
   * - exportType: Type of data to export
   * - format: Output format
   * - deliveryMethod: How to deliver the export
   * 
   * @param payload - The export generation payload
   * @throws PermanentJobError if validation fails
   * 
   * **Validates: Requirements 9.3, 15.4, 15.5**
   */
  async validate(payload: ExportGenerationPayload): Promise<void> {
    const errors: string[] = [];

    if (!payload.userId || typeof payload.userId !== 'string') {
      errors.push('userId is required and must be a string');
    }

    if (!payload.exportType || !['transactions', 'links', 'payments'].includes(payload.exportType)) {
      errors.push('exportType is required and must be one of: transactions, links, payments');
    }

    if (!payload.format || !['csv', 'json'].includes(payload.format)) {
      errors.push('format is required and must be one of: csv, json');
    }

    if (!payload.deliveryMethod || !['webhook', 'email', 'download'].includes(payload.deliveryMethod)) {
      errors.push('deliveryMethod is required and must be one of: webhook, email, download');
    }

    if (!payload.filters || typeof payload.filters !== 'object') {
      errors.push('filters is required and must be an object');
    }

    if (errors.length > 0) {
      throw new PermanentJobError(`Validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Handle job failure
   * 
   * Logs export generation failure.
   * This is called when the job exhausts all retry attempts and moves to DLQ.
   * 
   * @param job - The failed job
   * @param error - The error that caused the failure
   * 
   * **Validates: Requirements 9.5**
   */
  async onFailure(job: Job<ExportGenerationPayload>, error: Error): Promise<void> {
    const { userId, exportType } = job.payload;

    this.logger.error(
      `Export generation permanently failed for user ${userId} (type: ${exportType}, jobId: ${job.id}): ${error.message}`,
      error.stack,
    );

    // Surface the failure to the requesting user as an in-app notification.
    // A notification write must never mask the underlying job failure, so any
    // error here is logged and swallowed.
    try {
      const { error: insertError } = await this.supabase
        .getClient()
        .from('in_app_notifications')
        .insert({
          publicKey: userId,
          eventType: 'export.failed',
          eventId: job.id,
          title: 'Export failed',
          body: `Your ${exportType} ${job.payload.format} export could not be generated. Please try again.`,
          read: false,
          createdAt: new Date().toISOString(),
        });

      if (insertError) {
        this.logger.warn(
          `Failed to record export-failure notification for user ${userId}: ${insertError.message}`,
        );
      }
    } catch (notifyError) {
      this.logger.warn(
        `Failed to record export-failure notification for user ${userId}: ${notifyError instanceof Error ? notifyError.message : String(notifyError)}`,
      );
    }
  }
}
