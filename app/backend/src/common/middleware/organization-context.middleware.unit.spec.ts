import { OrganizationContextMiddleware } from './organization-context.middleware';

describe('OrganizationContextMiddleware', () => {
  const middleware = new OrganizationContextMiddleware();

  function run(headers: Record<string, string | undefined>) {
    const req = {
      headers,
    } as unknown as import('express').Request & {
      organizationContext?: unknown;
    };
    const next = jest.fn();
    middleware.use(req, {} as never, next);
    expect(next).toHaveBeenCalledTimes(1);
    return req;
  }

  it('carries the organization id from the header as a scoping hint', () => {
    const req = run({ 'x-organization-id': 'org-123' });
    expect(req.organizationContext).toEqual({
      organizationId: 'org-123',
      role: 'read_only',
    });
  });

  it('does not trust a client-supplied admin role header', () => {
    const req = run({ 'x-organization-role': 'admin' });
    expect(req.organizationContext).toEqual({
      organizationId: undefined,
      role: 'read_only',
    });
  });

  it('does not trust member role headers either', () => {
    const req = run({ 'x-organization-role': 'member' });
    expect(req.organizationContext?.role).toBe('read_only');
  });

  it('defaults to read_only with no headers', () => {
    const req = run({});
    expect(req.organizationContext).toEqual({
      organizationId: undefined,
      role: 'read_only',
    });
  });
});