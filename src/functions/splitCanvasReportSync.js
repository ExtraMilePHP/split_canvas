import { sendReport } from "./sendReport";
import { calcSplitCanvasReportPoints } from "./splitCanvasReportPoints";

function sideReportId(pair, side) {
  if (side === "left") {
    return pair?.left_report_id ?? pair?.leftReportId ?? null;
  }
  return pair?.right_report_id ?? pair?.rightReportId ?? null;
}

function sideUserId(pair, side) {
  return side === "left" ? pair?.left_user_id : pair?.right_user_id;
}

function sideUserName(pair, side) {
  return side === "left" ? pair?.left_user_name : pair?.right_user_name;
}

export function buildSplitCanvasReportPayload(pair, side, authUser) {
  const reportId = sideReportId(pair, side);
  const userId = sideUserId(pair, side);
  if (!authUser?.sessionId || !reportId || userId == null || userId === "") {
    return null;
  }

  return {
    sessionId: authUser.sessionId,
    role: authUser.role,
    token: authUser.token || null,
    name: String(sideUserName(pair, side) || authUser.name || ""),
    userId: String(userId),
    gameId: authUser.gameId || "",
    organizationId: authUser.organizationId,
    points: calcSplitCanvasReportPoints(pair),
    time: "00:00:00",
    reportId: String(reportId),
    ans: "",
  };
}

/** Update Extramile for left and right when each side has a stored report id. */
export function syncBothSplitCanvasReports(pair, authUser) {
  if (!authUser?.sessionId) return;

  for (const side of ["left", "right"]) {
    const payload = buildSplitCanvasReportPayload(pair, side, authUser);
    if (payload) {
      sendReport(payload).catch(() => {});
    }
  }
}
