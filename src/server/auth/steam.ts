/**
 * Steam account linking via OpenID 2.0.
 *
 * Steam remains the credential authority: SkF never sees the member's Steam
 * password. We only receive a verified claimed_id containing the SteamID64.
 */

export const STEAM_OPENID_LOGIN = 'https://steamcommunity.com/openid/login';
export const STEAM_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';
export const STEAM_STATE_COOKIE = 'ct_steam_state';

const OPENID_NS = 'http://specs.openid.net/auth/2.0';
const IDENTIFIER_SELECT = 'http://specs.openid.net/auth/2.0/identifier_select';

export function steamStateCookie(state: string): string {
  return `${STEAM_STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
}

export const clearedSteamStateCookie =
  `${STEAM_STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export function steamAuthorizeUrl(returnTo: string, realm: string): string {
  const params = new URLSearchParams({
    'openid.ns': OPENID_NS,
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': realm,
    'openid.identity': IDENTIFIER_SELECT,
    'openid.claimed_id': IDENTIFIER_SELECT,
  });
  return `${STEAM_OPENID_LOGIN}?${params}`;
}

function steamIdFromClaimedId(claimedId: string): string | null {
  const match = claimedId.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/);
  return match?.[1] ?? null;
}

/**
 * Verify Steam's callback by replaying its signed OpenID payload back to Steam
 * with mode=check_authentication. Never trust claimed_id without this round-trip.
 */
export async function verifySteamCallback(
  params: URLSearchParams,
  expectedReturnTo: string,
): Promise<string> {
  if (params.get('openid.mode') !== 'id_res') {
    throw new Error('Steam sign-in was cancelled or did not complete.');
  }

  const returnTo = params.get('openid.return_to');
  if (returnTo !== expectedReturnTo) {
    throw new Error('Steam return URL did not match this site.');
  }

  const endpoint = params.get('openid.op_endpoint');
  if (endpoint && endpoint.replace(/\/$/, '') !== STEAM_OPENID_ENDPOINT.replace(/\/$/, '')) {
    throw new Error('Unexpected Steam OpenID endpoint.');
  }

  const claimedId = params.get('openid.claimed_id');
  const identity = params.get('openid.identity');
  if (!claimedId || !identity || claimedId !== identity) {
    throw new Error('Steam identity was missing or inconsistent.');
  }

  const steamId = steamIdFromClaimedId(claimedId);
  if (!steamId) throw new Error('Steam returned an invalid SteamID64.');

  const verify = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    if (key.startsWith('openid.')) verify.set(key, value);
  }
  verify.set('openid.mode', 'check_authentication');

  const res = await fetch(STEAM_OPENID_LOGIN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: verify,
  });
  if (!res.ok) throw new Error(`Steam verification failed (${res.status}).`);

  const body = await res.text();
  const valid = body
    .split(/\r?\n/)
    .some((line) => line.trim().toLowerCase() === 'is_valid:true');
  if (!valid) throw new Error('Steam could not verify this identity.');

  return steamId;
}
