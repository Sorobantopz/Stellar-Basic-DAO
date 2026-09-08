import { AuditService } from "./audit.service";
import { SupabaseService } from "../supabase/supabase.service";
import { AuditLog } from "./audit.model";

describe("AuditService.exportCsv", () => {
  let service: AuditService;

  beforeEach(() => {
    const supabase = {
      getClient: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          then: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    } as unknown as SupabaseService;
    service = new AuditService(supabase as never);
  });

  function makeLog(overrides: Partial<AuditLog> = {}): AuditLog {
    return {
      id: "log-1",
      actor: "alice",
      action: "test.action",
      target: undefined,
      requestId: undefined,
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      ...overrides,
    } as AuditLog;
  }

  it("neutralizes spreadsheet formula injection in actor values", async () => {
    (service as unknown as { readLogs: () => Promise<AuditLog[]> }).readLogs =
      jest.fn().mockResolvedValue([
        makeLog({ actor: "=HYPERLINK(\"http://evil.example\",\"x\")" }),
      ]);

    const csv = await service.exportCsv();
    expect(csv).not.toContain(",=HYPERLINK(");
    expect(csv).toContain("'=HYPERLINK");
  });

  it("quotes cells containing commas or quotes", async () => {
    (service as unknown as { readLogs: () => Promise<AuditLog[]> }).readLogs =
      jest.fn().mockResolvedValue([
        makeLog({ actor: 'bob, "the builder"' }),
      ]);

    const csv = await service.exportCsv();
    expect(csv).toContain('"bob, ""the builder"""');
  });

  it("returns the header row when there are no logs", async () => {
    (service as unknown as { readLogs: () => Promise<AuditLog[]> }).readLogs =
      jest.fn().mockResolvedValue([]);

    const csv = await service.exportCsv();
    expect(csv).toBe("id,actor,action,target,requestId,createdAt\n");
  });
});