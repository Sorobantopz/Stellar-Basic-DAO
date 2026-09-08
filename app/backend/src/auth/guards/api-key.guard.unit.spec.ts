import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiKeyGuard } from "./api-key.guard";
import { ApiKeysService } from "../../api-keys/api-keys.service";
import { Test } from "@nestjs/testing";
import { Request } from "express";

/** Create a typed mock ExecutionContext with request + optional apiKey */
function makeContext(headers: Record<string, string> = {}) {
  const req = {
    headers,
  } as Request & { apiKey?: unknown };

  const ctx = {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;

  return { ctx, req };
}

describe("ApiKeyGuard", () => {
  let guard: ApiKeyGuard;

  const mockApiKeysService = {
    validateKey: jest.fn(),
    isOverQuota: jest.fn().mockReturnValue(false),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn().mockReturnValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        {
          provide: ApiKeysService,
          useValue: mockApiKeysService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<ApiKeyGuard>(ApiKeyGuard);
  });

  it("should allow public access when no API key is provided", async () => {
    const { ctx } = makeContext();

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it("should allow access when API key is valid", async () => {
    mockApiKeysService.validateKey.mockResolvedValue({
      record: {
        id: "api-key-id",
        name: "test key",
        scopes: [],
        request_count: 0,
        monthly_quota: 1000,
      },
      hasScope: () => true,
    });

    const { ctx, req } = makeContext({
      "x-api-key": "valid-key",
    });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(req.apiKey).toBeDefined();
  });

  it("should deny access when API key is invalid", async () => {
    mockApiKeysService.validateKey.mockResolvedValue(null);

    const { ctx } = makeContext({
      "x-api-key": "invalid-key",
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("should deny anonymous access when the route requires scopes", async () => {
    // Route declares @RequireScopes('admin'); no API key present.
    mockReflector.getAllAndOverride.mockReturnValue(["admin"]);

    const { ctx } = makeContext();

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(mockApiKeysService.validateKey).not.toHaveBeenCalled();
  });

  it("should allow anonymous access when no scopes are required", async () => {
    mockReflector.getAllAndOverride.mockReturnValue([]);

    const { ctx } = makeContext();

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it("should deny access when the key lacks the required scope", async () => {
    mockReflector.getAllAndOverride.mockReturnValue(["admin"]);
    mockApiKeysService.validateKey.mockResolvedValue({
      record: {
        id: "api-key-id",
        name: "test key",
        scopes: ["read"],
        request_count: 0,
        monthly_quota: 1000,
      },
      hasScope: (scope: string) => scope === "read",
    });

    const { ctx } = makeContext({
      "x-api-key": "read-only-key",
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      "API key missing required scope: admin",
    );
  });
});