import {
  publishEndFromApi,
  publishNextQuestionFromApi,
  publishShowFinalFromApi,
  publishShowResultFromApi,
  publishSnapshotFromGetState,
  publishVoteSummary,
} from "../../lib/wmlClientRtdb";

const apiBase = () => process.env.REACT_APP_BACKEND_URL || "";

async function wmlPost(token, action, body = {}) {
  const res = await fetch(`${apiBase()}/wml/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data.message || data.error || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

export async function wmlGetState({ token, currentTheme, sessionId }) {
  const data = await wmlPost(token, "get-state", { currentTheme });
  if (sessionId && data?.success) {
    await publishSnapshotFromGetState(sessionId, data);
  }
  return data;
}

export async function wmlNextQuestion({
  token,
  currentTheme,
  sessionId,
  questionTimerSeconds,
}) {
  const data = await wmlPost(token, "next-question", { currentTheme });
  if (sessionId && data?.success) {
    await publishNextQuestionFromApi(sessionId, data, {
      questionTimerSeconds,
    });
  }
  return data;
}

export async function wmlShowResult({ token, currentTheme, sessionId }) {
  const data = await wmlPost(token, "show-result", { currentTheme });
  if (sessionId && data?.success) {
    await publishShowResultFromApi(sessionId, data);
  }
  return data;
}

export async function wmlShowFinal({ token, currentTheme, sessionId }) {
  const data = await wmlPost(token, "show-final", { currentTheme });
  if (sessionId && data?.success) {
    await publishShowFinalFromApi(sessionId, data);
  }
  return data;
}

export async function wmlEnd({ token, currentTheme, sessionId }) {
  const data = await wmlPost(token, "end", { currentTheme });
  if (sessionId && data?.success) {
    await publishEndFromApi(sessionId, data);
  }
  return data;
}

export function wmlUpdatePlayer({ token, currentTheme, playerId, isActive }) {
  return wmlPost(token, "update-player", {
    currentTheme,
    playerId,
    isActive,
  });
}

export function wmlJoin({
  token,
  currentTheme,
  displayName,
  avatarKey,
  userId,
}) {
  return wmlPost(token, "join", {
    currentTheme,
    displayName,
    avatarKey,
    userId,
  });
}

export async function wmlVote({
  token,
  currentTheme,
  voterPlayerId,
  chosenPlayerId,
  sessionId,
}) {
  const data = await wmlPost(token, "vote", {
    currentTheme,
    voterPlayerId,
    chosenPlayerId,
  });
  if (
    sessionId &&
    data?.success &&
    data.submittedCount != null &&
    data.expectedCount != null
  ) {
    await publishVoteSummary(sessionId, {
      submittedCount: data.submittedCount,
      expectedCount: data.expectedCount,
    });
  }
  return data;
}
