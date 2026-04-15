import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import Swal from "sweetalert2";
import { getDatabase, ref, onValue } from "firebase/database";
import { getFirebaseApp } from "../../../lib/firebaseClient";
import { normalizeWml } from "../../../lib/wmlSnapshotUtils";
import { fetchThemeData } from "../../themeSlice";
import { selectAdminToken, selectSessionId } from "../../sessionSlice";
import {
  wmlEnd,
  wmlGetState,
  wmlNextQuestion,
  wmlShowResult,
} from "../../functions/wmlApi";

const ROSTER_PAGE_SIZE = 8;

/**
 * Live host controls for Who's Most Likely — embedded on Questions page.
 */
export default function WmlHostPanel({ collapsed }) {
  const dispatch = useDispatch();
  const adminToken = useSelector(selectAdminToken);
  const sessionId = useSelector(selectSessionId);
  const { currentTheme, data: themeData } = useSelector(
    (state) => state.theme
  );

  const questionTimerSeconds = useMemo(() => {
    const v = themeData?.wmlQuestionTimerSeconds;
    const n =
      typeof v === "string" ? parseInt(v, 10) : Number(v);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  }, [themeData?.wmlQuestionTimerSeconds]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("waiting");
  const [currentRound, setCurrentRound] = useState(null);
  const [roster, setRoster] = useState([]);
  const [voteStats, setVoteStats] = useState(null);
  const [wmlRtdb, setWmlRtdb] = useState(null);
  const [rosterPage, setRosterPage] = useState(0);
  const [timerTick, setTimerTick] = useState(0);
  const autoShowResultFiredRef = useRef(null);

  const refreshState = useCallback(async () => {
    if (!adminToken || !currentTheme || !sessionId) return;
    setError("");
    const json = await wmlGetState({
      token: adminToken,
      currentTheme,
      sessionId,
    });
    if (json.success) {
      setPhase(json.phase || "waiting");
      setCurrentRound(json.currentRound || null);
      setRoster(json.roster || []);
      setVoteStats(json.voteStats);
    }
  }, [adminToken, currentTheme, sessionId]);

  useEffect(() => {
    dispatch(fetchThemeData({ themeId: currentTheme }));
  }, [dispatch, currentTheme]);

  useEffect(() => {
    refreshState().catch((e) => setError(e.message || String(e)));
  }, [refreshState]);

  useEffect(() => {
    const app = getFirebaseApp();
    const sid = sessionId;
    if (!app || !sid || !process.env.REACT_APP_FIREBASE_DATABASE_URL) {
      return undefined;
    }
    const db = getDatabase(app);
    const wmlRef = ref(db, `/${sid}/wml`);
    const unsub = onValue(
      wmlRef,
      (snap) => {
        setWmlRtdb(normalizeWml(snap.val()));
      },
      (err) => {
        console.warn(
          "[WML host] RTDB listener error:",
          err?.message || err
        );
      }
    );
    return () => unsub();
  }, [sessionId]);

  const phaseShown = wmlRtdb?.phase ?? phase;
  const roundShown = wmlRtdb?.currentRound ?? currentRound;
  const votesShown = wmlRtdb?.votesSummary ?? voteStats;

  useEffect(() => {
    autoShowResultFiredRef.current = null;
  }, [roundShown?.roundId]);

  useEffect(() => {
    if (phaseShown !== "question" || wmlRtdb?.questionDeadlineMs == null) {
      return undefined;
    }
    const id = window.setInterval(
      () => setTimerTick((t) => t + 1),
      1000
    );
    return () => window.clearInterval(id);
  }, [phaseShown, wmlRtdb?.questionDeadlineMs]);

  const secondsLeft = useMemo(() => {
    const d = Number(wmlRtdb?.questionDeadlineMs);
    if (phaseShown !== "question" || !Number.isFinite(d)) return null;
    return Math.max(0, Math.ceil((d - Date.now()) / 1000));
  }, [phaseShown, wmlRtdb?.questionDeadlineMs, timerTick]);

  useEffect(() => {
    if (!adminToken || !currentTheme || !sessionId) return undefined;
    if (phaseShown !== "question") return undefined;
    const deadline = Number(wmlRtdb?.questionDeadlineMs);
    const rid = roundShown?.roundId;
    if (!Number.isFinite(deadline) || rid == null) return undefined;

    const fireIfDue = () => {
      if (Date.now() < deadline) return;
      if (autoShowResultFiredRef.current === rid) return;
      autoShowResultFiredRef.current = rid;
      wmlShowResult({ token: adminToken, currentTheme, sessionId })
        .then(() => refreshState())
        .catch(() => {
          autoShowResultFiredRef.current = null;
        });
    };

    const id = window.setInterval(fireIfDue, 500);
    fireIfDue();
    return () => window.clearInterval(id);
  }, [
    adminToken,
    currentTheme,
    sessionId,
    phaseShown,
    wmlRtdb?.questionDeadlineMs,
    roundShown?.roundId,
    refreshState,
  ]);

  const rosterList = useMemo(() => {
    const fromRtdb = wmlRtdb?.roster;
    if (Array.isArray(fromRtdb) && fromRtdb.length > 0) return fromRtdb;
    return roster;
  }, [wmlRtdb?.roster, roster]);

  useEffect(() => {
    const pageCount = Math.ceil(rosterList.length / ROSTER_PAGE_SIZE) || 1;
    const maxIdx = Math.max(0, pageCount - 1);
    setRosterPage((p) => Math.min(p, maxIdx));
  }, [rosterList.length]);

  const run = async (fn) => {
    if (!currentTheme) {
      Swal.fire("Theme", "No theme selected.", "warning");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await fn();
      await refreshState();
    } catch (e) {
      setError(e.message || String(e));
      Swal.fire("Error", e.message || "Request failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const confirmEnd = () => {
    Swal.fire({
      title: "End game?",
      text: "Final scores will be shown to players, then the session ends.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "End game",
      cancelButtonText: "Cancel",
    }).then((r) => {
      if (r.isConfirmed) {
        run(() =>
          wmlEnd({ token: adminToken, currentTheme, sessionId })
        );
      }
    });
  };

  const showNextQuestion = phaseShown !== "question";
  const hasActiveRoundForResult =
    Boolean(roundShown?.promptText) || roundShown?.roundId != null;
  const showShowResult =
    phaseShown === "question" && hasActiveRoundForResult;
  const endGameDisabled =
    loading ||
    (phaseShown === "waiting" && roundShown?.roundId == null);

  const rosterPageCount =
    rosterList.length === 0
      ? 0
      : Math.ceil(rosterList.length / ROSTER_PAGE_SIZE);
  const rosterSliceStart = rosterPage * ROSTER_PAGE_SIZE;
  const rosterPageRows = rosterList.slice(
    rosterSliceStart,
    rosterSliceStart + ROSTER_PAGE_SIZE
  );

  const optionsList = useMemo(
    () =>
      Array.isArray(roundShown?.options) ? roundShown.options : [],
    [roundShown?.options]
  );

  if (collapsed) {
    return null;
  }

  return (
    <div className="wml-panel-card">
      {error ? <div className="wml-panel-error">{error}</div> : null}

      <div className="wml-live-row">
        <div className="wml-live-left">
          <div className="wml-phase-pill">
            Phase: <strong>{phaseShown}</strong>
          </div>
          <div className="wml-current-prompt">
            {roundShown?.promptText ? (
              <>
                <div className="wml-prompt-label">Current question</div>
                <p className="wml-prompt-text">{roundShown.promptText}</p>
                {optionsList.length ? (
                  <ul className="wml-options-list">
                    {optionsList.map((o) => (
                      <li key={o.playerId}>
                        <span className="wml-option-name">{o.displayName}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <p className="wml-prompt-empty">
                No active round. Use <strong>Next question</strong> when players
                are ready.
              </p>
            )}
          </div>
          <div className="wml-vote-meta">
            {votesShown ? (
              <span>
                Votes: {votesShown.submittedCount ?? "—"}/
                {votesShown.expectedCount ?? "—"}
              </span>
            ) : (
              <span className="wml-vote-meta--muted">Votes: —</span>
            )}
            {secondsLeft != null ? (
              <span
                className="wml-question-timer"
                aria-live="polite"
              >
                {secondsLeft}s
              </span>
            ) : null}
          </div>
        </div>

        <div className="wml-live-right">
          <div className="wml-action-row">
            {showNextQuestion ? (
              <button
                type="button"
                className="btn outline wml-action-primary"
                disabled={loading}
                onClick={() =>
                  run(() =>
                    wmlNextQuestion({
                      token: adminToken,
                      currentTheme,
                      sessionId,
                      questionTimerSeconds,
                    })
                  )
                }
              >
                Next question
              </button>
            ) : null}
            {showShowResult ? (
              <button
                type="button"
                className="btn outline"
                disabled={loading}
                onClick={() =>
                  run(() =>
                    wmlShowResult({
                      token: adminToken,
                      currentTheme,
                      sessionId,
                    })
                  )
                }
              >
                Show result
              </button>
            ) : null}
            <button
              type="button"
              className="btn outline wml-action-danger"
              disabled={endGameDisabled}
              onClick={confirmEnd}
            >
              End game
            </button>
          </div>

          <div className="wml-roster-block">
            <div className="wml-roster-title">Connected users</div>
            {rosterList.length === 0 ? (
              <p className="wml-roster-empty">No players joined yet.</p>
            ) : (
              <>
                <table className="wml-roster-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rosterPageRows.map((p) => (
                      <tr key={p.id}>
                        <td>{p.display_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rosterPageCount > 1 ? (
                  <div className="wml-roster-pager">
                    <button
                      type="button"
                      className="btn outline wml-roster-pager-btn"
                      disabled={rosterPage <= 0}
                      onClick={() =>
                        setRosterPage((p) => Math.max(0, p - 1))
                      }
                    >
                      Previous
                    </button>
                    <span className="wml-roster-pager-meta">
                      Page {rosterPage + 1} of {rosterPageCount}
                    </span>
                    <button
                      type="button"
                      className="btn outline wml-roster-pager-btn"
                      disabled={rosterPage >= rosterPageCount - 1}
                      onClick={() =>
                        setRosterPage((p) =>
                          Math.min(rosterPageCount - 1, p + 1)
                        )
                      }
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
