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

/** Matches backend: 10 per submitted half + 1 per reaction. */
export function calcSplitCanvasReportPoints(pair) {
  return (
    submittedPostCount(pair) * SPLIT_CANVAS_POST_POINTS +
    totalReactionsOnPair(pair) * SPLIT_CANVAS_REACTION_POINTS
  );
}
