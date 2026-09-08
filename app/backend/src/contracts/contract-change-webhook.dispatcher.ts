import { Injectable, Logger } from "@nestjs/common";
//! Contract change webhook dispatcher.
//!
//! Dispatches signed webhook payloads to registered subscribers
//! whenever the contract registry is published or rolled back.

import { createHmac } from "crypto";

export interface WebhookDispatchResult {
  webhookId: string;
  url: string;
  success: boolean;
  httpStatus?: number;
  error?: string;
}

@Injectable()
export class ContractChangeWebhookDispatcher {
  private readonly logger = new Logger(ContractChangeWebhookDispatcher.name);

  /** Per-request timeout in ms; a stalled endpoint must not hang the registry publish flow. */
  private readonly requestTimeoutMs = 10_000;

  async dispatch(
    webhooks: { id: string; webhookUrl: string; secret: string }[],
    payload: Record<string, unknown>,
  ): Promise<WebhookDispatchResult[]> {
    const results: WebhookDispatchResult[] = [];

    if (!webhooks.length) return results;

    const body = JSON.stringify({
      event: "contract_registry.changed",
      occurredAt: new Date().toISOString(),
      payload,
    });

    await Promise.allSettled(
      webhooks.map(async (webhook) => {
        try {
          const signature = createHmac("sha256", webhook.secret)
            .update(body)
            .digest("hex");

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

          const response = await fetch(webhook.webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Stellar-Basic-DAO-Signature": signature,
              "X-Stellar-Basic-DAO-Event": "contract_registry.changed",
            },
            body,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          results.push({
            webhookId: webhook.id,
            url: webhook.webhookUrl,
            success: response.ok,
            httpStatus: response.status,
          });
        } catch (error) {
          // DOMException (e.g. AbortError from the request timeout) is not an
          // `instanceof Error` in Node 18+, so fall back to reading `.message`
          // off any throwable instead of discarding it as "Unknown error".
          const message =
            error instanceof Error
              ? error.message
              : typeof error === "object" &&
                  error !== null &&
                  "message" in error
                ? String((error as { message: unknown }).message)
                : "Unknown error";
          results.push({
            webhookId: webhook.id,
            url: webhook.webhookUrl,
            success: false,
            error: message,
          });
        }
      }),
    );

    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
      this.logger.warn(
        `Failed to deliver contract change webhook to ${failures.length}/${results.length} endpoints`,
      );
    }

    return results;
  }
}
