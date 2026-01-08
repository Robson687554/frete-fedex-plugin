import axios from 'axios';
import { FEDEX_CLIENT_ID, FEDEX_CLIENT_SECRET } from './config.js';

let cachedToken = null;
let tokenExpiresAt = 0;

export async function getFedexToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const resp = await axios.post(
    'https://apis.fedex.com/oauth/token',
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: FEDEX_CLIENT_ID,
      client_secret: FEDEX_CLIENT_SECRET
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  cachedToken = resp.data.access_token;
  tokenExpiresAt = now + resp.data.expires_in * 1000;
  return cachedToken;
}
