import { INestApplication } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { ApiKeysModule } from "../src/api-keys/api-keys.module";
import { ApiKeysService } from "../src/api-keys/api-keys.service";
import { ApiKeyRecord } from "../src/api-keys/api-keys.types";
import { OrganizationRoleGuard } from "../src/auth/guards/organization-role.guard";
import { SupabaseService } from "../src/supabase/supabase.service";
import { OrganizationContextMiddleware } from "../src/common/middleware/organization-context.middleware";

const KEY_ID = "5e64d0a4-92d6-4d5f-9a4b-0d1c2e3f4a5b";

function adminRecord(): ApiKeyRecord {
  return {
    id: KEY_ID,
    name: "admin-key",
    key_hash: "hash",
    key_hash_old: null,
    key_prefix: "qx_live_abcdef12",
    scopes: ["admin"],
    owner_id: null,
    organization_id: "org-123",
    is_active: true,
    request_count: 0,
    monthly_quota: 10_000,
    last_used_at: null,
    rotated_at: null,
    last_reset_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe("ApiKeysController auth (e2e)", () => {
  let app: INestApplication;
  let service: jest.Mocked<Pick<ApiKeysService, keyof ApiKeysService>>;

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({
        id: KEY_ID,
        name: "test",
        key_prefix: "qx_live_abcdef12",
        scopes: ["admin"],
        is_active: true,
        request_count: 0,
        monthly_quota: 10_000,
        last_used_at: null,
        created_at: new Date().toISOString(),
        key: "qx_live_secret",
      }),
      validateKey: jest.fn().mockResolvedValue(null),
      isOverQuota: jest.fn().mockReturnValue(false),
      listPaginated: jest
        .fn()
        .mockResolvedValue({ data: [], pagination: { next_cursor: null, has_more: false, limit: 20 } }),
      getUsage: jest
        .fn()
        .mockResolvedValue({ total_keys: 0, total_requests: 0, quota: 10_000 }),
      revoke: jest.fn().mockResolvedValue(undefined),
      rotate: jest.fn(),
      list: jest.fn().mockResolvedValue([]),
      emergencyRotate: jest.fn(),
    } as unknown as jest.Mocked<Pick<ApiKeysService, keyof ApiKeysService>>;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ApiKeysModule],
      providers: [
        // Reproduce production ordering: the global OrganizationRoleGuard runs
        // BEFORE the controller-level ApiKeyGuard.
        { provide: APP_GUARD, useClass: OrganizationRoleGuard },
      ],
    })
      .overrideProvider(ApiKeysService)
      .useValue(service)
      // Stub out the Supabase-backed service; the repository is never hit in
      // these tests because ApiKeysService is fully mocked.
      .overrideProvider(SupabaseService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();

    // Reproduce production middleware: organization context defaults the role to
    // read_only and never trusts a client-supplied role header.
    app.use((req, res, next) => {
      new OrganizationContextMiddleware().use(
        req as Parameters<OrganizationContextMiddleware["use"]>[0],
        res,
        next,
      );
    });

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("write endpoints", () => {
    it("rejects key minting without an API key, even with a spoofed admin role header", async () => {
      await request(app.getHttpServer())
        .post("/api-keys")
        .set("x-organization-role", "admin")
        .set("x-organization-id", "org-123")
        .send({ name: "attacker-key", scopes: ["admin"] })
        .expect(401)
        .expect((res) => {
          expect(res.body.error).toBe("API_KEY_REQUIRED");
        });

      expect(service.create).not.toHaveBeenCalled();
    });

    it("rejects key revocation without an API key", async () => {
      await request(app.getHttpServer())
        .delete(`/api-keys/${KEY_ID}`)
        .expect(401);

      expect(service.revoke).not.toHaveBeenCalled();
    });

    it("rejects key rotation without an API key", async () => {
      await request(app.getHttpServer())
        .post(`/api-keys/${KEY_ID}/rotate`)
        .expect(401);

      expect(service.rotate).not.toHaveBeenCalled();
    });

    it("allows an admin-scoped API key to create a key", async () => {
      service.validateKey.mockResolvedValue({
        record: adminRecord(),
        hasScope: (scope) => scope === "admin",
      });

      await request(app.getHttpServer())
        .post("/api-keys")
        .set("x-api-key", "qx_live_abcdef12secret")
        .send({ name: "my-key", scopes: ["admin"] })
        .expect(201);

      expect(service.create).toHaveBeenCalledTimes(1);
    });

    it("rejects a non-admin API key that tries to mint keys", async () => {
      const record = adminRecord();
      record.scopes = ["links:read"];
      service.validateKey.mockResolvedValue({
        record,
        hasScope: (scope) => record.scopes.includes(scope),
      });

      await request(app.getHttpServer())
        .post("/api-keys")
        .set("x-api-key", "qx_live_abcdef12readonly")
        .send({ name: "my-key", scopes: ["admin"] })
        .expect(403)
        .expect((res) => {
          expect(res.body.error).toBe("INSUFFICIENT_SCOPE");
        });

      expect(service.create).not.toHaveBeenCalled();
    });
  });

  describe("read endpoints", () => {
    it("rejects unauthenticated listing", async () => {
      await request(app.getHttpServer()).get("/api-keys").expect(401);

      expect(service.listPaginated).not.toHaveBeenCalled();
    });

    it("lists only the caller organization's keys with an admin key", async () => {
      service.validateKey.mockResolvedValue({
        record: adminRecord(),
        hasScope: (scope) => scope === "admin",
      });

      await request(app.getHttpServer())
        .get("/api-keys")
        .set("x-api-key", "qx_live_abcdef12secret")
        .expect(200);

      expect(service.listPaginated).toHaveBeenCalledWith(
        undefined,
        "org-123",
        undefined,
        undefined,
      );
    });
  });
});