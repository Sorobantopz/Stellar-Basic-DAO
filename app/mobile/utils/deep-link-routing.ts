import { parsePaymentLink } from './parse-payment-link';

// NOTE: hosts are lowercase because the URL parser normalizes hostnames to
// lowercase (matches the applinks:RustAcademy.to / intent-filter registrations).
const RustAcademy_HOSTS = ['rustacademy.to', 'www.rustacademy.to'];
const RustAcademy_SCHEME = 'RustAcademy';

function isAppScheme(url: URL): boolean {
  // url.protocol is lowercased by the URL parser (e.g. "rustacademy:")
  return (
    url.protocol.slice(0, -1).toLowerCase() === RustAcademy_SCHEME.toLowerCase()
  );
}

function isAppHost(url: URL): boolean {
  // React Native's URL polyfill preserves hostname case, so compare
  // case-insensitively (works in both Node and RN environments).
  return RustAcademy_HOSTS.some((host) => url.hostname.toLowerCase() === host);
}

export interface DeepLinkRoute {
  pathname: string;
  params: Record<string, string>;
}

export type DeepLinkResolution =
  | { route: DeepLinkRoute }
  | { error: string }
  | { ignored: true };

export function parseTransactionDeepLink(
  raw: string,
): { id: string; params: Record<string, string> } | null {
  try {
    const url = new URL(raw);

    if (isAppScheme(url)) {
      // Scheme links route via the host: RustAcademy://transaction/<id>
      const isTransaction = url.hostname.toLowerCase() === 'transaction';
      const segments = url.pathname
        .replace(/^\/+/, '')
        .split('/')
        .filter(Boolean);
      if (isTransaction && segments.length >= 1) {
        const params: Record<string, string> = {};
        url.searchParams.forEach((value, key) => {
          params[key] = value;
        });
        return { id: segments[0], params };
      }
    }

    if (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      isAppHost(url)
    ) {
      const segments = url.pathname
        .replace(/^\/+/, '')
        .split('/')
        .filter(Boolean);
      if (segments.length >= 2 && segments[0] === 'transaction') {
        const params: Record<string, string> = {};
        url.searchParams.forEach((value, key) => {
          params[key] = value;
        });
        return { id: segments[1], params };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function isStellarBasicDaoLink(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (
      isAppScheme(url) ||
      ((url.protocol === 'https:' || url.protocol === 'http:') &&
        isAppHost(url))
    );
  } catch {
    return false;
  }
}

function looksLikePaymentLink(raw: string): boolean {
  try {
    const url = new URL(raw);

    if (isAppScheme(url)) {
      // transaction-hosted scheme links are transaction links; everything
      // else under the scheme is treated as a payment link
      return url.hostname.toLowerCase() !== 'transaction';
    }

    if (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      isAppHost(url)
    ) {
      const segments = url.pathname
        .replace(/^\/+/, '')
        .split('/')
        .filter(Boolean);
      return segments.length === 0 || segments[0] !== 'transaction';
    }

    return false;
  } catch {
    return false;
  }
}

export function resolveDeepLink(raw: string): DeepLinkResolution {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ignored: true };
  }

  // Resolve transaction links BEFORE payment links. A transaction deep link
  // may carry an `amount` query param, and `transaction` is a valid username
  // for the payment-link grammar — parsing payment first would misroute
  // `RustAcademy://transaction/<id>?amount=…` to the payment confirmation
  // screen as a payment to a user named "transaction".
  const transactionResult = parseTransactionDeepLink(trimmed);
  if (transactionResult) {
    return {
      route: {
        pathname: '/transaction/[id]',
        params: {
          id: transactionResult.id,
          ...transactionResult.params,
        },
      },
    };
  }

  const paymentResult = parsePaymentLink(trimmed);
  if (paymentResult.valid) {
    return {
      route: {
        pathname: '/payment-confirmation',
        params: {
          username: paymentResult.data.username,
          amount: paymentResult.data.amount,
          asset: paymentResult.data.asset,
          ...(paymentResult.data.memo ? { memo: paymentResult.data.memo } : {}),
          privacy: String(paymentResult.data.privacy),
        },
      },
    };
  }

  if (isStellarBasicDaoLink(trimmed)) {
    return {
      error: looksLikePaymentLink(trimmed)
        ? paymentResult.error ?? 'Unsupported or expired Stellar Basic DAO link.'
        : 'Unsupported or expired Stellar Basic DAO link.',
    };
  }

  return { ignored: true };
}
