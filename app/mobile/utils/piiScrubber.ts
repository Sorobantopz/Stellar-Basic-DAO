// Stellar account (G...) and contract (C...) addresses: 56-char base32
// (no 0/O/I/l) strings that identify a user's wallet and would let a log
// reader tie a record back to an on-chain account.
const STELLAR_ADDRESS_PATTERN =
  /\b[GCN][A-Z2-7]{55}\b/g;

// Public keys / memos may embed the address next to punctuation, so also
// catch addresses wrapped in common delimiters.
const STELLAR_ADDRESS_EMBEDDED =
  /[GCN][A-Z2-7]{55}/g;

// Stellar secret keys (S...) are the 56-char base32 private half of a key
// pair. Leaking one in a log hands over the account itself, so scrub them
// before addresses: a secret key never starts with G/C/N so the address
// patterns above leave it intact for this pass to catch.
const STELLAR_SECRET_PATTERN =
  /\bS[A-Z2-7]{55}\b/g;
const STELLAR_SECRET_EMBEDDED =
  /S[A-Z2-7]{55}/g;

export function scrubPii(text: string): string {
  if (!text) return text;

  // Basic email redaction
  let scrubbed = text.replace(
    /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi,
    '[EMAIL]',
  );

  // Basic phone redaction (e.g., +1-555-555-5555 or (555) 555-5555)
  scrubbed = scrubbed.replace(
    /(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
    '[PHONE]',
  );

  // Basic SSN redaction
  scrubbed = scrubbed.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');

  // Credit Card redaction
  scrubbed = scrubbed.replace(/\b(?:\d{4}[ -]?){3}\d{4}\b/g, '[CARD]');

  // Secret keys MUST be redacted before addresses: base32 alphabets overlap,
  // so an embedded-address pass scanning a long S-key could otherwise match a
  // G/C/N subsequence and leave the rest of the private key in the output.
  scrubbed = scrubbed.replace(STELLAR_SECRET_PATTERN, '[STELLAR_SECRET]');
  scrubbed = scrubbed.replace(STELLAR_SECRET_EMBEDDED, '[STELLAR_SECRET]');

  // Stellar wallet / contract address redaction (word-bounded first so a
  // longer base32 token is not half-redacted, then embedded occurrences).
  scrubbed = scrubbed.replace(STELLAR_ADDRESS_PATTERN, '[STELLAR_ADDR]');
  scrubbed = scrubbed.replace(STELLAR_ADDRESS_EMBEDDED, '[STELLAR_ADDR]');

  return scrubbed;
}
