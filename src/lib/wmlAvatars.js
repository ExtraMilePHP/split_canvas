/** Max WML character slots (theme `wmlAvatarKeys` + upload UI). */
export const WML_AVATAR_SLOT_COUNT = 15;

/**
 * Bundled default portraits (sorted by numeric filename).
 */
export function loadBundledAvatarUrls() {
  const ctx = require.context("../img/assets/avatar", false, /\.png$/);
  return ctx
    .keys()
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
      const nb = parseInt(b.match(/\d+/)?.[0] ?? "0", 10);
      return na - nb;
    })
    .map((key) => ctx(key));
}

/**
 * @param {string} avatarKey - 1-based index as string (DB / session)
 * @param {string[]} displayUrls - one URL per selectable slot
 */
export function avatarSrcForKey(avatarKey, displayUrls) {
  const n = parseInt(String(avatarKey), 10);
  if (
    !Number.isFinite(n) ||
    n < 1 ||
    !Array.isArray(displayUrls) ||
    displayUrls.length === 0
  ) {
    return displayUrls[0];
  }
  return displayUrls[n - 1] ?? displayUrls[0];
}

/**
 * If theme has any custom S3 avatars, returns 15 display URLs (custom or bundled fallback per slot).
 * Otherwise returns bundled URLs only (legacy behavior, any length).
 *
 * @param {object|null|undefined} themeData - `state.theme.data`
 * @param {string[]} bundledUrls - from `loadBundledAvatarUrls()`
 * @returns {{ urls: string[], gridSlotCount: number }}
 */
export function getWmlAvatarDisplayUrls(themeData, bundledUrls) {
  const bundled = Array.isArray(bundledUrls) ? bundledUrls : [];
  const keys = themeData?.wmlAvatarKeys;
  const s3Base = process.env.REACT_APP_S3_PATH || "";
  const hasCustom =
    Array.isArray(keys) &&
    keys.some((k) => k != null && String(k).trim() !== "");

  if (!hasCustom) {
    return {
      urls: bundled,
      gridSlotCount: bundled.length,
    };
  }

  const padded = Array.isArray(keys) ? [...keys] : [];
  while (padded.length < WML_AVATAR_SLOT_COUNT) {
    padded.push(null);
  }
  const urls = padded.slice(0, WML_AVATAR_SLOT_COUNT).map((filename, idx) => {
    if (filename != null && String(filename).trim() !== "") {
      return `${s3Base}${filename}`;
    }
    return bundled[idx] ?? bundled[0];
  });
  return {
    urls,
    gridSlotCount: WML_AVATAR_SLOT_COUNT,
  };
}
