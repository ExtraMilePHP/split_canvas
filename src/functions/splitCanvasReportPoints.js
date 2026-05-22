const REACTION_COLUMNS = [
  "react_like",
  "react_love",
  "react_laugh",
  "react_wow",
  "react_sad",
  "react_neutral",
];

export const SPLIT_CANVAS_POST_POINTS = 10;
export const SPLIT_CANVAS_REACTION_POINTS = 1;

export function totalReactionsOnPair(pair) {
  return REACTION_COLUMNS.reduce(
    (sum, col) => sum + (Number(pair?.[col]) || 0),
    0
  );
}

export function submittedPostCount(pair) {
  let n = 0;
  if (pair?.left_submitted_at) n += 1;
  if (pair?.right_submitted_at) n += 1;
  return n;
}

/** 10 once when the pair has any submission (not per side). */
export function pairPostPoints(pair) {
  if (pair?.left_submitted_at || pair?.right_submitted_at) {
    return SPLIT_CANVAS_POST_POINTS;
  }
  return 0;
}

/** Matches backend: 10 per pair entry + 1 per reaction count. */
export function calcSplitCanvasReportPoints(pair) {
  return (
    pairPostPoints(pair) +
    totalReactionsOnPair(pair) * SPLIT_CANVAS_REACTION_POINTS
  );
}
