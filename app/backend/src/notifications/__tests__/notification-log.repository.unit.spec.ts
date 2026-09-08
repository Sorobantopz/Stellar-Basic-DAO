import { NotificationLogRepository } from "../notification-log.repository";
import { SupabaseService } from "../../supabase/supabase.service";

const PUBLIC_KEY = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

describe("NotificationLogRepository.getWebhookStats", () => {
  /**
   * Builds a fluent query builder that mirrors supabase-js behavior for
   * head:true count queries: `data` is [] and the count is reported on the
   * response's `count` field. The last `.eq("status", ...)` value routes the
   * awaited query to the matching count.
   */
  function buildRepo(counts: { sent?: number; failed?: number }) {
    let statusValue: string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dynamic: Record<string, jest.Mock>;
    // Lazy `() => dynamic` (not `mockReturnValue(dynamic)`): the object is
    // still undefined while its own literal is being built.
    dynamic = {
      select: jest.fn().mockImplementation(() => dynamic),
      eq: jest.fn().mockImplementation((_col: string, val: string) => {
        statusValue = val;
        return dynamic;
      }),
      lt: jest.fn().mockImplementation(() => dynamic),
      order: jest.fn().mockImplementation(() => dynamic),
      limit: jest.fn().mockImplementation(() => dynamic),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
      // `await` adopts the thenable's state through its resolve/reject
      // callbacks, so this mock must invoke them (mirroring supabase-js).
      then: jest.fn().mockImplementation((onFulfilled, onRejected) => {
        if (statusValue === "sent") {
          return Promise.resolve({
            data: [],
            count: counts.sent ?? 0,
            error: null,
          }).then(onFulfilled, onRejected);
        }
        if (statusValue === "failed") {
          return Promise.resolve({
            data: [],
            count: counts.failed ?? 0,
            error: null,
          }).then(onFulfilled, onRejected);
        }
        return Promise.resolve({ data: [], error: null }).then(
          onFulfilled,
          onRejected,
        );
      }),
    };

    const supabase = {
      getClient: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(dynamic),
      }),
    } as unknown as SupabaseService;

    return new NotificationLogRepository(supabase);
  }

  it("reads sent/failed totals from the response count field (head:true)", async () => {
    const repo = buildRepo({ sent: 100, failed: 5 });

    const stats = await repo.getWebhookStats(PUBLIC_KEY);

    expect(stats.totalSent).toBe(100);
    expect(stats.totalFailed).toBe(5);
  });

  it("reports zero when the table is empty", async () => {
    const repo = buildRepo({ sent: 0, failed: 0 });

    const stats = await repo.getWebhookStats(PUBLIC_KEY);

    expect(stats.totalSent).toBe(0);
    expect(stats.totalFailed).toBe(0);
  });
});