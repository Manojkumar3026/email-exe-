// Parses the List-Unsubscribe / List-Unsubscribe-Post headers (RFC 2369 / RFC 8058).
// We deliberately never auto-submit the one-click POST silently on the user's behalf —
// unsubscribe always opens the link so the user can see and confirm it. This also sidesteps
// the extension's restrictive CSP connect-src (limited to Gmail/Graph hosts), since opening
// a link is a navigation, not a fetch.

export interface ParsedUnsubscribe {
  httpUrl?: string;
  mailtoUrl?: string;
  supportsOneClick: boolean;
}

export function parseListUnsubscribe(
  header: string | undefined,
  postHeader: string | undefined,
): ParsedUnsubscribe {
  if (!header) return { supportsOneClick: false };

  const urls = [...header.matchAll(/<([^>]+)>/g)].map((m) => m[1]);
  const httpUrl = urls.find((u) => u.startsWith('http://') || u.startsWith('https://'));
  const mailtoUrl = urls.find((u) => u.startsWith('mailto:'));

  return {
    httpUrl,
    mailtoUrl,
    supportsOneClick: Boolean(httpUrl) && /one-click/i.test(postHeader ?? ''),
  };
}

export function openUnsubscribeLink(parsed: ParsedUnsubscribe): boolean {
  const target = parsed.httpUrl ?? parsed.mailtoUrl;
  if (!target) return false;
  window.open(target, '_blank', 'noopener,noreferrer');
  return true;
}
