/**
 * Firebase RTDB publishing removed. These calls are no-ops so WML REST flows keep working.
 * @see REQUIREMENTS_ADMIN_SPLIT_IMAGES.md
 */

export async function publishSnapshotFromGetState(_sessionId, _data) {
  return undefined;
}

export async function publishNextQuestionFromApi(_sessionId, _data, _opts) {
  return undefined;
}

export async function publishShowResultFromApi(_sessionId, _data) {
  return undefined;
}

export async function publishPhaseWaiting(_sessionId) {
  return undefined;
}

export async function publishEndFromApi(_sessionId, _data) {
  return undefined;
}

export async function publishShowFinalFromApi(_sessionId, _data) {
  return undefined;
}

export async function publishVoteSummary(_sessionId, _patch) {
  return undefined;
}
