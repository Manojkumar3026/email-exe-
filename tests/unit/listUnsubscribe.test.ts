import { describe, expect, it } from 'vitest';
import { parseListUnsubscribe } from '../../src/lib/unsubscribe/listUnsubscribe';

describe('parseListUnsubscribe', () => {
  it('extracts both mailto and https URLs when both are present', () => {
    const parsed = parseListUnsubscribe(
      '<mailto:unsub@example.com>, <https://example.com/unsubscribe?id=123>',
      undefined,
    );
    expect(parsed.mailtoUrl).toBe('mailto:unsub@example.com');
    expect(parsed.httpUrl).toBe('https://example.com/unsubscribe?id=123');
  });

  it('flags one-click support only when both the URL and the Post header are present', () => {
    const withPost = parseListUnsubscribe(
      '<https://example.com/unsub>',
      'List-Unsubscribe=One-Click',
    );
    expect(withPost.supportsOneClick).toBe(true);

    const withoutPost = parseListUnsubscribe('<https://example.com/unsub>', undefined);
    expect(withoutPost.supportsOneClick).toBe(false);
  });

  it('returns no URLs and supportsOneClick=false when the header is missing', () => {
    const parsed = parseListUnsubscribe(undefined, undefined);
    expect(parsed.httpUrl).toBeUndefined();
    expect(parsed.mailtoUrl).toBeUndefined();
    expect(parsed.supportsOneClick).toBe(false);
  });
});
