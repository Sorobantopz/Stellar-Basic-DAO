import { isStellarBasicDaoLink, parseTransactionDeepLink, resolveDeepLink } from '../utils/deep-link-routing';

describe('deep link routing', () => {
  it('recognizes Stellar Basic DAO domains and scheme URLs', () => {
    expect(isStellarBasicDaoLink('RustAcademy://transaction/12345')).toBe(true);
    expect(isStellarBasicDaoLink('https://RustAcademy.to/transaction/12345')).toBe(true);
    expect(isStellarBasicDaoLink('https://www.RustAcademy.to/jordan?amount=1.2')).toBe(true);
    expect(isStellarBasicDaoLink('https://example.com/transaction/12345')).toBe(false);
  });

  it('parses transaction deep links with query params', () => {
    const result = parseTransactionDeepLink(
      'https://www.RustAcademy.to/transaction/999?memo=hello&txHash=0xabc',
    );
    expect(result).toEqual({
      id: '999',
      params: { memo: 'hello', txHash: '0xabc' },
    });
  });

  it('resolves payment confirmation links to the payment confirmation route', () => {
    const result = resolveDeepLink('https://RustAcademy.to/jordan?amount=12.5&asset=XLM');
    expect(result).toEqual({
      route: {
        pathname: '/payment-confirmation',
        params: { username: 'jordan', amount: '12.5000000', asset: 'XLM', privacy: 'false' },
      },
    });
  });

  it('resolves transaction links to the transaction route', () => {
    const result = resolveDeepLink('RustAcademy://transaction/abc-123?status=Success&asset=XLM');
    expect(result).toEqual({
      route: {
        pathname: '/transaction/[id]',
        params: { id: 'abc-123', status: 'Success', asset: 'XLM' },
      },
    });
  });

  it('returns an error for invalid Stellar Basic DAO links', () => {
    const result = resolveDeepLink('https://RustAcademy.to/transaction/');
    expect(result).toEqual({ error: 'Unsupported or expired Stellar Basic DAO link.' });
  });

  it('returns a generic error for malformed RustAcademy://transaction links', () => {
    const result = resolveDeepLink('RustAcademy://transaction/');
    expect(result).toEqual({ error: 'Unsupported or expired Stellar Basic DAO link.' });
  });

  it('ignores unrelated URLs', () => {
    expect(resolveDeepLink('https://example.com/hello')).toEqual({ ignored: true });
  });

  it('routes a scheme transaction link with an amount param to the transaction screen', () => {
    // Regression: `transaction` is a valid payment username, so an amount
    // param used to hijack the link into the payment-confirmation flow.
    const result = resolveDeepLink('RustAcademy://transaction/tx-42?amount=5&asset=XLM');
    expect(result).toEqual({
      route: {
        pathname: '/transaction/[id]',
        params: { id: 'tx-42', amount: '5', asset: 'XLM' },
      },
    });
  });

  it('routes an https transaction link with an amount param to the transaction screen', () => {
    const result = resolveDeepLink('https://rustacademy.to/transaction/tx-9?amount=3.5');
    expect(result).toEqual({
      route: {
        pathname: '/transaction/[id]',
        params: { id: 'tx-9', amount: '3.5' },
      },
    });
  });

  it('accepts an explicit port on the app host', () => {
    const result = resolveDeepLink('https://www.rustacademy.to:8443/jordan?amount=1&asset=XLM');
    expect(result).toEqual({
      route: {
        pathname: '/payment-confirmation',
        params: { username: 'jordan', amount: '1.0000000', asset: 'XLM', privacy: 'false' },
      },
    });
  });

  it('resolves scheme transaction links case-insensitively', () => {
    const result = resolveDeepLink('RustAcademy://TRANSACTION/tx-77');
    expect(result).toEqual({
      route: {
        pathname: '/transaction/[id]',
        params: { id: 'tx-77' },
      },
    });
  });
});
