# WML Realtime Database (client writes)

Who's Most Likely game state under `/{sessionId}/wml` is **written from the browser** after successful REST API responses (see `src/lib/wmlClientRtdb.js`). The Node backend no longer uses Firebase Admin for RTDB.

## Security

- Client writes are subject to **Firebase Realtime Database security rules**, not server-side Admin bypass.
- You must allow authenticated users (or your chosen model) to **read and write** `/{sessionId}/wml/**` as needed.
- Consider **Firebase App Check** and tight rules (e.g. validate `phase` / shape) to reduce tampering. Malicious clients could otherwise push fake phases or scores until you enforce rules or move writes back server-side.

## Degraded mode

If `REACT_APP_FIREBASE_DATABASE_URL` is unset or RTDB writes fail, the app logs a warning and continues using REST (`wmlGetState`) for UI merge logic where implemented.
