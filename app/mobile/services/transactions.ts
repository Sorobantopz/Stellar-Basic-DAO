import type { TransactionResponse } from "../types/transaction";
import { getApiBaseUrl } from "../utils/api-config";
import { FetchTimeoutError, fetchWithTimeout } from "../utils/fetch-with-timeout";

const API_BASE_URL = getApiBaseUrl();

export interface FetchTransactionsOptions {
  limit?: number;
  cursor?: string;
  asset?: string;
}

/**
 * Fetches paginated payment history for a Stellar account from the Stellar Basic DAO backend.
 * Throws a descriptive Error on network issues or non-2xx responses.
 */
export async function fetchTransactions(
  accountId: string,
  options: FetchTransactionsOptions = {},
): Promise<TransactionResponse> {
  const { limit = 20, cursor, asset } = options;

  const params = new URLSearchParams({ accountId, limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  if (asset) params.set("asset", asset);

  const url = `${API_BASE_URL}/transactions?${params.toString()}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      headers: { Accept: "application/json" },
    });
  } catch (networkError) {
    if (networkError instanceof FetchTimeoutError) {
      throw new Error("The request timed out. Check your connection and try again.");
    }
    throw new Error(
      "Network request failed. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    let message = `Server error (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // ignore JSON parse errors — keep the status-code message
    }
    throw new Error(message);
  }

  return response.json() as Promise<TransactionResponse>;
}
