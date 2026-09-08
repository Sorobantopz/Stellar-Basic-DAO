import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RecurringPaymentsService } from './recurring-payments.service';
import { RecurringPaymentsRepository, DbRecurringPaymentLink, DbRecurringPaymentExecution } from './recurring-payments.repository';
import { RecurringPaymentProcessor } from '../stellar/recurring-payment-processor';
import { JobQueueService } from '../job-queue/job-queue.service';
import { JobType } from '../job-queue/types';
import { RecurringPaymentPayload } from '../job-queue/types/job-payloads.types';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class RecurringPaymentsScheduler implements OnModuleInit {
  private readonly logger = new Logger(RecurringPaymentsScheduler.name);
  private readonly maxRetries: number;
  private readonly retryBackoffMs: number;
  private readonly notificationHoursBefore: number;

  constructor(
    private readonly schedulerService: RecurringPaymentsService,
    private readonly repository: RecurringPaymentsRepository,
    private readonly paymentProcessor: RecurringPaymentProcessor,
    private readonly eventEmitter: EventEmitter2,
    private readonly jobQueueService: JobQueueService,
    private readonly supabase: SupabaseService,
  ) {
    this.maxRetries = parseInt(process.env.RECURRING_PAYMENT_MAX_RETRY || '3');
    this.retryBackoffMs = parseInt(process.env.RECURRING_PAYMENT_RETRY_BACKOFF_MS || '60000');
    this.notificationHoursBefore = parseInt(process.env.RECURRING_PAYMENT_NOTIFICATION_HOURS_BEFORE || '24');
  }

  onModuleInit(): void {
    this.logger.log('Recurring payments scheduler initialized');
    this.logger.log(`Configuration: maxRetries=${this.maxRetries}, retryBackoffMs=${this.retryBackoffMs}ms, notificationHoursBefore=${this.notificationHoursBefore}h`);
  }

  // ---------------------------------------------------------------------------
  // Cron Jobs
  // ---------------------------------------------------------------------------

  /**
   * Check for pending payments every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkAndExecutePendingPayments(): Promise<void> {
    try {
      this.logger.debug('Checking for pending recurring payments...');

      const linksDue = await this.schedulerService.getLinksDueForExecution();

      if (linksDue.length === 0) {
        this.logger.debug('No recurring payments due for execution');
        return;
      }

      this.logger.log(`Found ${linksDue.length} recurring payment(s) due for execution`);

      // Process each link sequentially to avoid race conditions
      for (const link of linksDue) {
        await this.processRecurringPayment(link);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error in scheduled payment execution: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
    }
  }

  /**
   * Send payment due notifications 24 hours before scheduled date
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sendUpcomingPaymentNotifications(): Promise<void> {
    try {
      this.logger.debug('Checking for upcoming payment notifications...');

      // This would query for payments scheduled in the next 24 hours
      // Implementation depends on specific notification requirements
      // For now, we'll skip detailed implementation
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error sending notifications: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
    }
  }

  // ---------------------------------------------------------------------------
  // Payment Processing Logic
  // ---------------------------------------------------------------------------

  private async processRecurringPayment(link: DbRecurringPaymentLink): Promise<void> {
    const linkId = link.id;
    let execution: DbRecurringPaymentExecution | undefined;

    try {
      this.logger.log(`Processing recurring payment for link: ${linkId}`);

      // Determine the next period number
      const nextPeriodNumber = link.executed_count + 1;

      // Create execution record
      execution = await this.repository.createExecution({
        recurringLinkId: linkId,
        periodNumber: nextPeriodNumber,
        scheduledAt: new Date(link.next_execution_date),
        amount: link.amount,
        asset: link.asset,
      });

      this.logger.log(`Created execution record: ${execution.id} for period ${nextPeriodNumber}`);

      // Execute the payment
      await this.executeSinglePayment(link, execution);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error processing recurring payment ${linkId}: ${errorMessage}`, error instanceof Error ? error.stack : undefined);

      if (execution) {
        // executeSinglePayment already marked this execution failed, emitted
        // the failure event, and notified the user — do not mark again.
        return;
      }

      // createExecution itself failed, so there is no execution row to mark
      // (markPaymentFailure expects an execution id, not a link id). Leave the
      // link due so the next scheduler run retries; the error is already logged.
    }
  }

  private async executeSinglePayment(
    link: DbRecurringPaymentLink,
    execution: DbRecurringPaymentExecution,
  ): Promise<void> {
    const executionId = execution.id;

    try {
      this.logger.log(`Enqueuing payment job for execution: ${executionId}`);

      // Determine recipient
      const recipientAddress = link.destination || (await this.resolveUsernameToAddress(link.username!));

      if (!recipientAddress) {
        throw new Error('Could not resolve recipient address');
      }

      // Enqueue payment job via JobQueueService
      const payload: RecurringPaymentPayload = {
        recurringLinkId: link.id,
        executionId: executionId,
        recipientAddress,
        amount: link.amount.toString(),
        asset: link.asset,
        assetIssuer: link.asset_issuer || undefined,
        memo: link.memo || undefined,
        memoType: link.memo_type || undefined,
      };

      const jobId = await this.jobQueueService.enqueue(
        JobType.RECURRING_PAYMENT,
        payload,
      );

      this.logger.log(`Payment job enqueued: ${jobId} for execution: ${executionId}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to enqueue payment job: ${errorMessage}`, error instanceof Error ? error.stack : undefined);

      const currentRetryCount = execution.retry_count + 1;

      // Mark as failed
      await this.schedulerService.markPaymentFailure(
        executionId,
        errorMessage,
        currentRetryCount,
      );

      // Emit failure event
      this.eventEmitter.emit('recurring.payment.failed', {
        executionId,
        linkId: link.id,
        failureReason: errorMessage,
        retryCount: currentRetryCount,
        permanent: currentRetryCount >= this.maxRetries,
      });

      // Send failure notification
      await this.notifyUser(link, execution, 'failed', undefined, errorMessage);

      // Re-throw to let caller handle
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Notification Helpers
  // ---------------------------------------------------------------------------

  private async notifyUser(
    link: DbRecurringPaymentLink,
    execution: DbRecurringPaymentExecution,
    type: 'success' | 'failed' | 'due',
    transactionHash?: string,
    failureReason?: string,
  ): Promise<void> {
    try {
      const eventType =
        type === 'success'
          ? 'recurring.payment.success'
          : type === 'failed'
          ? 'recurring.payment.failed'
          : 'recurring.payment.due';

      this.eventEmitter.emit(eventType, {
        linkId: link.id,
        executionId: execution.id,
        username: link.username,
        destination: link.destination,
        amount: link.amount,
        asset: link.asset,
        periodNumber: execution.period_number,
        transactionHash,
        failureReason,
      });

      this.logger.debug(`Emitted notification event: ${eventType}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error emitting notification: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
    }
  }

  /**
   * Resolve a username to its registered Stellar address.
   *
   * Looks up the canonical (lowercased) username in the usernames table so a
   * recurring payment configured with a named recipient pays the wallet that
   * actually owns the name. Returns null when the name is unclaimed.
   */
  private async resolveUsernameToAddress(username: string): Promise<string | null> {
    if (!username) return null;

    const normalized = username.trim().toLowerCase();
    try {
      const publicKey = await this.supabase.getPublicKeyByUsername(normalized);
      if (!publicKey) {
        this.logger.warn(
          `Could not resolve username "${normalized}" to a Stellar address`,
        );
      }
      return publicKey;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Username resolution failed for "${normalized}": ${errorMessage}`,
      );
      return null;
    }
  }
}
