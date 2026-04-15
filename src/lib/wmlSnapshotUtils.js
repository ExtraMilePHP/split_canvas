/**
 * Firebase RTDB often returns arrays as objects with "0","1",… keys.
 */

export function normalizeFirebaseList(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") {
    return Object.keys(value)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => value[k]);
  }
  return [];
}

export function normalizeWml(raw) {
  if (raw == null || typeof raw !== "object") return null;
  const out = { ...raw };
  if (raw.questionDeadlineMs != null) {
    const n = Number(raw.questionDeadlineMs);
    out.questionDeadlineMs = Number.isFinite(n) ? n : null;
  }
  if (raw.roster != null) {
    out.roster = normalizeFirebaseList(raw.roster);
  }
  if (raw.currentRound != null && typeof raw.currentRound === "object") {
    out.currentRound = {
      ...raw.currentRound,
      options: normalizeFirebaseList(raw.currentRound.options),
    };
  }
  if (raw.results != null && typeof raw.results === "object") {
    out.results = {
      ...raw.results,
      tallies: normalizeFirebaseList(raw.results.tallies),
      leaderboard: normalizeFirebaseList(raw.results.leaderboard),
    };
  }
  return out;
}

const PHASE_ORDER = {
  waiting: 0,
  question: 1,
  results: 2,
  final: 3,
  ended: 4,
};

/** Prefer the more advanced game phase when RTDB and REST disagree (e.g. stale RTDB). */
function maxPhase(p1, p2) {
  const i1 = p1 != null ? PHASE_ORDER[p1] ?? -1 : -1;
  const i2 = p2 != null ? PHASE_ORDER[p2] ?? -1 : -1;
  if (i1 >= i2) return p1 ?? p2;
  return p2 ?? p1;
}

/** After game over, prefer REST get-state (authoritative leaderboard); mid-round keep RTDB-first. */
function mergeDisplayResults(mergedPhase, rtdbNorm, restNorm) {
  if (mergedPhase === "ended" || mergedPhase === "final") {
    return restNorm?.results ?? rtdbNorm?.results;
  }
  return rtdbNorm?.results ?? restNorm?.results;
}

/**
 * Prefer RTDB when it already has a live prompt; otherwise use REST get-state shape.
 * Keeps RTDB results/votesSummary when present.
 */
export function mergeWmlDisplay(rtdbNorm, restPayload) {
  const restNorm =
    restPayload?.success === true
      ? normalizeWml({
          phase: restPayload.phase,
          currentRound: restPayload.currentRound,
          results: restPayload.results,
          votesSummary:
            restPayload.voteStats != null
              ? {
                  submittedCount: restPayload.voteStats.submittedCount,
                  expectedCount: restPayload.voteStats.expectedCount,
                }
              : undefined,
        })
      : null;

  const rtdbPrompt = rtdbNorm?.currentRound?.promptText;
  if (rtdbPrompt) {
    const mergedPhase = maxPhase(rtdbNorm?.phase, restNorm?.phase);
    return {
      ...rtdbNorm,
      phase: mergedPhase,
      results: mergeDisplayResults(mergedPhase, rtdbNorm, restNorm),
      votesSummary: rtdbNorm?.votesSummary ?? restNorm?.votesSummary,
    };
  }

  const restPrompt = restNorm?.currentRound?.promptText;
  if (restPrompt) {
    const mergedPhase = maxPhase(rtdbNorm?.phase, restNorm?.phase);
    return {
      ...restNorm,
      phase: mergedPhase,
      results: mergeDisplayResults(mergedPhase, rtdbNorm, restNorm),
      votesSummary: rtdbNorm?.votesSummary ?? restNorm?.votesSummary,
      questionDeadlineMs: rtdbNorm?.questionDeadlineMs ?? null,
    };
  }

  if (rtdbNorm?.phase && rtdbNorm.phase !== "waiting") {
    return rtdbNorm;
  }

  return rtdbNorm || restNorm;
}
