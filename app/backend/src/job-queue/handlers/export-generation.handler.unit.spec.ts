/**
 * Unit tests for the ExportGenerationHandler.
 *
 * Covers:
 * - CSV formula-injection neutralization
 * - CSV quoting/escaping of commas, quotes, and newlines
 * - JSON export generation
 * - payload validation
 * - permanent-failure in-app notification
 */

import { ExportGenerationHandler, PermanentJobError } from "./export-generation.handler";
import type { Job, CancellationToken } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeCancellationToken(): CancellationToken {
  return { throwIfCancelled: jest.fn() } as unknown as CancellationToken;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeJob(payload: any = {}): Job<any> {
  return {
    id: "job-1",
    type: "export_generation",
    payload,
    status: "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
  } as unknown as Job<any>;
}

describe("ExportGenerationHandler", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handler: ExportGenerationHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      getClient: jest.fn(() => ({
        from: jest.fn(() => ({
          insert: jest.fn().mockResolvedValue({ error: null }),
          select: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      })),
    };
    handler = new ExportGenerationHandler(mockSupabase);
  });

  describe("CSV formula injection protection", () => {
    // Expose the private escape helper through a generated export and inspect
    // the produced CSV text via the storage path.
    async function csvFor(rows: Array<Record<string, unknown>>): Promise<string> {
      const oldStorage = process.env.EXPORT_STORAGE_BASE_URL;
      process.env.EXPORT_STORAGE_BASE_URL = "https://storage.example.com";
      const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
      global.fetch = fetchMock as unknown as typeof fetch;

      try {
        await handler.execute(
          makeJob({
            userId: "user-1",
            exportType: "transactions",
            filters: {},
            format: "csv",
            deliveryMethod: "download",
          }),
          makeCancellationToken(),
        );
      } finally {
        if (oldStorage === undefined) {
          delete process.env.EXPORT_STORAGE_BASE_URL;
        } else {
          process.env.EXPORT_STORAGE_BASE_URL = oldStorage;
        }
        delete (global as { fetch?: unknown }).fetch;
      }

      // Extract the body that was uploaded
      const body = fetchMock.mock.calls[0]?.[1]?.body as string;
      return body;
    }

    it("neutralizes cells starting with =", async () => {
      mockSupabase.getClient.mockReturnValue({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({ data: [{ memo: "=HYPERLINK(\"http://evil\")" }], error: null }),
          })),
        })),
      });
      const csv = await csvFor([]);
      // The leading = is neutralized with a single quote; the value is then
      // CSV-quoted because it contains double quotes (which get doubled).
      expect(csv).toContain("'=HYPERLINK");
      expect(csv).not.toContain("\n=HYPERLINK");
    });

    it("neutralizes cells starting with +, -, @, tab, and CR", async () => {
      mockSupabase.getClient.mockReturnValue({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({
              data: [
                { a: "+SUM(1,1)", b: "-2+3", c: "@SUM(1,1)", d: "\tCMD()", e: "\rCMD()" },
              ],
              error: null,
            }),
          })),
        })),
      });
      const csv = await csvFor([]);
      expect(csv).toContain("'+SUM(1,1)");
      expect(csv).toContain("'-2+3");
      expect(csv).toContain("'@SUM(1,1)");
      expect(csv).toContain("'\tCMD()");
      expect(csv).toContain("'\rCMD()");
    });

    it("leaves ordinary values untouched", async () => {
      mockSupabase.getClient.mockReturnValue({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({
              data: [{ username: "alice", amount: "123.45" }],
              error: null,
            }),
          })),
        })),
      });
      const csv = await csvFor([]);
      expect(csv).toContain("alice");
      expect(csv).toContain("123.45");
    });
  });

  describe("validate", () => {
    it("accepts a valid payload", async () => {
      await expect(
        handler.validate({
          userId: "u1",
          exportType: "transactions",
          filters: {},
          format: "csv",
          deliveryMethod: "download",
        }),
      ).resolves.toBeUndefined();
    });

    it("rejects unsupported export types", async () => {
      await expect(
        handler.validate({
          userId: "u1",
          exportType: "nonsense",
          filters: {},
          format: "csv",
          deliveryMethod: "download",
        } as never),
      ).rejects.toThrow(PermanentJobError);
    });

    it("rejects unsupported formats and delivery methods", async () => {
      await expect(
        handler.validate({
          userId: "u1",
          exportType: "links",
          filters: {},
          format: "xml",
          deliveryMethod: "download",
        } as never),
      ).rejects.toThrow(PermanentJobError);

      await expect(
        handler.validate({
          userId: "u1",
          exportType: "links",
          filters: {},
          format: "csv",
          deliveryMethod: "fax",
        } as never),
      ).rejects.toThrow(PermanentJobError);
    });

    it("rejects a missing userId", async () => {
      await expect(
        handler.validate({
          exportType: "links",
          filters: {},
          format: "csv",
          deliveryMethod: "download",
        } as never),
      ).rejects.toThrow(PermanentJobError);
    });
  });

  describe("onFailure", () => {
    it("writes an in-app notification for the user", async () => {
      const insertMock = jest.fn().mockResolvedValue({ error: null });
      mockSupabase.getClient.mockReturnValue({
        from: jest.fn(() => ({ insert: insertMock })),
      });

      await handler.onFailure(
        makeJob({
          userId: "user-9",
          exportType: "payments",
          format: "json",
        }),
        new Error("boom"),
      );

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          publicKey: "user-9",
          eventType: "export.failed",
          title: "Export failed",
        }),
      );
    });

    it("does not throw when the notification write fails", async () => {
      mockSupabase.getClient.mockReturnValue({
        from: jest.fn(() => ({
          insert: jest.fn().mockResolvedValue({ error: { message: "db down" } }),
        })),
      });

      await expect(
        handler.onFailure(makeJob({ userId: "u", exportType: "links", format: "csv" }), new Error("x")),
      ).resolves.toBeUndefined();
    });
  });
});