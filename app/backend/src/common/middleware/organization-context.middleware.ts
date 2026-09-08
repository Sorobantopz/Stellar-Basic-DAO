import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

@Injectable()
export class OrganizationContextMiddleware implements NestMiddleware {
  use(req: Request, _: Response, next: NextFunction) {
    const orgHeader =
      (req.headers["x-organization-id"] as string | undefined) ??
      (req.headers["x-workspace-id"] as string | undefined);

    // The organization id is a scoping hint, but the role is NEVER taken from
    // a client-supplied header: a caller could trivially send
    // `x-organization-role: admin` and elevate themselves past any
    // @RequireOrgRole check (e.g. the api-keys management endpoints, which
    // for a while mounted no ApiKeyGuard at all). The authoritative role is
    // derived from a verified API key by ApiKeyGuard, which overwrites this
    // context after validation. Until then the caller is unauthenticated, so
    // default to read_only.
    req.organizationContext = {
      organizationId: orgHeader?.trim() || undefined,
      role: "read_only",
    };

    next();
  }
}
