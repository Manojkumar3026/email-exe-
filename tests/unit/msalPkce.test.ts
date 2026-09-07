import { describe, expect, it } from 'vitest';
import { generateCodeChallenge, generateCodeVerifier } from '../../src/lib/auth/msalPkce';

describe('PKCE code verifier/challenge', () => {
  it('generates a URL-safe verifier with no padding characters', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(verifier.length).toBeGreaterThanOrEqual(43);
  });

  it('matches the RFC 7636 S256 test vector', async () => {
    // From RFC 7636 Appendix B.
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = await generateCodeChallenge(verifier);
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('produces a different verifier on each call', () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });
});
