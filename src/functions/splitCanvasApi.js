const apiBase = () => process.env.REACT_APP_BACKEND_URL || "";

function authHeaders(token, json = false) {
  const h = {
    Authorization: `Bearer ${token}`,
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export async function joinSplitCanvasPair(token, body) {
  const res = await fetch(`${apiBase()}/splitCanvas/join`, {
    method: "POST",
    headers: authHeaders(token, true),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not join pairing");
  return data;
}

export async function getSplitCanvasPair(token, pairId) {
  const res = await fetch(`${apiBase()}/splitCanvas/pair/${pairId}`, {
    method: "GET",
    headers: authHeaders(token, false),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not load pair");
  return data;
}

export async function uploadSplitCanvasDrawing(token, formData) {
  const res = await fetch(`${apiBase()}/splitCanvas/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Upload failed");
  return json;
}

/**
 * GET URL for gallery SSE (`EventSource` cannot send Authorization; token is passed as query — same caveats as plan).
 */
export function getSplitCanvasGalleryStreamUrl(token, themeName) {
  const q = new URLSearchParams({
    themeName: String(themeName),
    token: String(token),
  });
  return `${apiBase()}/splitCanvas/gallery/stream?${q.toString()}`;
}

export async function fetchSplitCanvasGallery(token, themeName, userId) {
  const body = { themeName };
  if (userId != null && String(userId) !== "") {
    body.userId = String(userId);
  }
  const res = await fetch(`${apiBase()}/splitCanvas/gallery`, {
    method: "POST",
    headers: authHeaders(token, true),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Gallery failed");
  return data;
}

export async function postSplitCanvasReaction(token, pairId, reaction, userId) {
  const res = await fetch(`${apiBase()}/splitCanvas/react`, {
    method: "POST",
    headers: authHeaders(token, true),
    body: JSON.stringify({ pairId, reaction, userId: String(userId) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Reaction failed");
  return data;
}
