/**
 * Persisted embedded-mode flag lives on `userData.fromMobileApp` (localStorage + Redux auth.user).
 */

export function readPersistedFromMobileApp() {
  try {
    const raw = localStorage.getItem("userData");
    if (!raw) return false;
    const u = JSON.parse(raw);
    return u?.fromMobileApp === true;
  } catch {
    return false;
  }
}

/** @param {object | null | undefined} user auth user (e.g. state.auth.user) */
export function isFromMobileAppUser(user) {
  return user?.fromMobileApp === true;
}

function extramileBaseOrigin() {
  const base = process.env.REACT_APP_BASE_URL;
  if (!base) return null;
  try {
    return new URL(base).origin;
  } catch {
    return null;
  }
}

/**
 * True if url targets the same host as REACT_APP_BASE_URL (Extramile Play).
 * Relative URLs are resolved against that base.
 */
export function isExtramilePlayUrl(urlString) {
  if (urlString == null || urlString === "") return false;
  const origin = extramileBaseOrigin();
  if (!origin) return false;
  try {
    const baseUrl = new URL(origin);
    const target = new URL(String(urlString), baseUrl);
    return target.hostname === baseUrl.hostname;
  } catch {
    return false;
  }
}

/**
 * Exit to Extramile: in embedded app, notify native instead of navigating when applicable.
 * Pass `user` when Redux has the current session; if omitted or null, falls back to persisted userData.
 */
export function leaveToExtramile(urlString, user) {
  if (!urlString) return;
  const embedded =
    user != null ? isFromMobileAppUser(user) : readPersistedFromMobileApp();
  if (embedded && isExtramilePlayUrl(urlString)) {
    window.GameStatus?.postMessage("navigate_back");
    return;
  }
  window.location.assign(urlString);
}
