/**
 * Single host for Extramile staging/production API (login, org, reports).
 * Paths are appended in code; value should have no trailing slash.
 */
export function getExtramileApiOrigin() {
  const raw = process.env.REACT_APP_EXTRAMILE_API_ORIGIN || "";
  return String(raw).replace(/\/+$/, "");
}
