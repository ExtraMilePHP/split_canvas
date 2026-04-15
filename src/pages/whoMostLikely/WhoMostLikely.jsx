import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { selectAdminToken, selectSessionId } from "../../admin/sessionSlice";
import { wmlGetState, wmlJoin, wmlVote } from "../../admin/functions/wmlApi";
import { setBackButtonUrl } from "../uiSlice";
import bgDesk from "../../img/assets/parts/background-desk1.jpg";
import bgMob from "../../img/assets/parts/background-mob1.jpg";
import bgDesk2 from "../../img/assets/parts/background-desk2.jpg";
import bgMob2 from "../../img/assets/parts/background-mob2.jpg";
import winnerBgDesk from "../../img/assets/parts/winner-background-desk.jpg";
import winnerBgMob from "../../img/assets/parts/winner-background-mob.jpg";
import confetti from "canvas-confetti";
import {
  mergeWmlDisplay,
  normalizeFirebaseList,
  normalizeWml,
} from "../../lib/wmlSnapshotUtils";
import { sendReport } from "../../functions/sendReport";
import { fetchThemeData } from "../../admin/themeSlice";
import {
  loadBundledAvatarUrls,
  getWmlAvatarDisplayUrls,
  avatarSrcForKey,
} from "../../lib/wmlAvatars";
import "./whoMostLikely.css";

const WML_AVATAR_KEY = "wmlAvatarKey";

function wmlReportStorageKey(sessionId, theme) {
  return `wmlReportId:${sessionId}:${theme}`;
}

function readWmlReportId(sessionId, theme) {
  if (!sessionId || !theme) return null;
  try {
    return sessionStorage.getItem(wmlReportStorageKey(sessionId, theme));
  } catch {
    return null;
  }
}

function writeWmlReportId(sessionId, theme, id) {
  if (!sessionId || !theme || !id) return;
  try {
    sessionStorage.setItem(wmlReportStorageKey(sessionId, theme), String(id));
  } catch {
    /* ignore */
  }
}

function buildWmlReportData(user, points, reportId) {
  return {
    sessionId: user.sessionId,
    role: user.role,
    token: user.token || null,
    name: user.name,
    userId: user.userId,
    gameId: user.gameId || "",
    organizationId: user.organizationId,
    points,
    time: "00:00:00",
    reportId: reportId || null,
    ans: "",
  };
}

function playerStorageKey(sessionId, theme) {
  return `wmlPlayer:${sessionId}:${theme}`;
}

function voteStorageKey(sessionId, theme) {
  return `wmlVote:${sessionId}:${theme}`;
}

export default function WhoMostLikely() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const adminToken = useSelector(selectAdminToken);
  const sessionId = useSelector(selectSessionId);
  const { currentTheme, status: themeStatus, data: themeData } = useSelector(
    (state) => state.theme
  );
  const { user } = useSelector((state) => state.auth);

  const [joinLoading, setJoinLoading] = useState(true);
  const [joinError, setJoinError] = useState("");
  const [playerId, setPlayerId] = useState(null);

  const [wmlRtdb, setWmlRtdb] = useState(null);
  const [wmlRestPayload, setWmlRestPayload] = useState(null);

  const [voteSubmitting, setVoteSubmitting] = useState(false);
  const [voteError, setVoteError] = useState("");
  const [votedRoundId, setVotedRoundId] = useState(null);
  const [lastVoteChoice, setLastVoteChoice] = useState(null);

  const bundledAvatarUrls = useMemo(() => loadBundledAvatarUrls(), []);
  const avatarDisplayUrls = useMemo(
    () => getWmlAvatarDisplayUrls(themeData, bundledAvatarUrls).urls,
    [themeData, bundledAvatarUrls]
  );

  useEffect(() => {
    dispatch(setBackButtonUrl("/get-pairing"));
  }, [dispatch]);

  useEffect(() => {
    if (!currentTheme || !adminToken) return undefined;
    dispatch(fetchThemeData({ themeId: currentTheme }));
    return undefined;
  }, [dispatch, currentTheme, adminToken]);

  useEffect(() => {
    if (!adminToken) {
      navigate("/login", { replace: true });
    }
  }, [adminToken, navigate]);

  const resolveAvatarKey = useCallback(() => {
    const fromState = location.state?.avatarIndex;
    if (typeof fromState === "number" && fromState >= 0) {
      return String(fromState + 1);
    }
    try {
      const stored = sessionStorage.getItem(WML_AVATAR_KEY);
      if (stored) return stored;
    } catch {
      /* ignore */
    }
    return "1";
  }, [location.state]);

  const resolveDisplayName = useCallback(() => {
    const n = user?.name?.trim();
    if (n) return n;
    const e = user?.email?.trim();
    if (e) return e;
    return "Player";
  }, [user]);

  const resolveUserId = useCallback(() => {
    const raw = user?.userId ?? user?.id;
    if (raw === undefined || raw === null || raw === "") return undefined;
    const n = parseInt(String(raw), 10);
    if (!Number.isFinite(n) || Number.isNaN(n)) return undefined;
    return n;
  }, [user]);

  useEffect(() => {
    if (!adminToken || !sessionId || !currentTheme) {
      setJoinLoading(false);
      return undefined;
    }

    let cancelled = false;
    const key = playerStorageKey(sessionId, currentTheme);

    async function runJoin() {
      setJoinError("");
      setJoinLoading(true);
      try {
        const existing = sessionStorage.getItem(key);
        if (existing) {
          const pid = parseInt(existing, 10);
          if (Number.isFinite(pid)) {
            if (!cancelled) {
              setPlayerId(pid);
              setJoinLoading(false);
            }
            return;
          }
        }

        const body = {
          token: adminToken,
          currentTheme,
          displayName: resolveDisplayName(),
          avatarKey: resolveAvatarKey(),
        };
        const uid = resolveUserId();
        if (uid !== undefined) body.userId = uid;

        const data = await wmlJoin(body);
        if (!data.success || !data.playerId) {
          throw new Error(data.message || "Join failed");
        }
        try {
          sessionStorage.setItem(key, String(data.playerId));
        } catch {
          /* ignore */
        }
        if (!cancelled) {
          setPlayerId(data.playerId);
        }
        try {
          const snap = await wmlGetState({
            token: adminToken,
            currentTheme,
            sessionId,
          });
          if (!cancelled && snap?.success) {
            setWmlRestPayload(snap);
          }
        } catch {
          /* ignore */
        }
      } catch (e) {
        try {
          sessionStorage.removeItem(key);
        } catch {
          /* ignore */
        }
        if (!cancelled) {
          setJoinError(e.message || "Could not join game");
        }
      } finally {
        if (!cancelled) setJoinLoading(false);
      }
    }

    runJoin();
    return () => {
      cancelled = true;
    };
  }, [
    adminToken,
    sessionId,
    currentTheme,
    resolveAvatarKey,
    resolveDisplayName,
    resolveUserId,
  ]);

  const wml = useMemo(
    () => mergeWmlDisplay(wmlRtdb, wmlRestPayload),
    [wmlRtdb, wmlRestPayload]
  );

  const phase = wml?.phase || "waiting";
  const currentRound = wml?.currentRound || null;
  const votesSummary = wml?.votesSummary || null;
  const results = wml?.results || null;

  const showWinnerBg =
    phase === "results" && results?.winnerPlayerId != null;

  const usePlayfulBg = useMemo(() => Math.random() < 0.5, []);
  const skinClass = usePlayfulBg
    ? "who-most-likely--skin-playful"
    : "who-most-likely--skin-classic";

  useEffect(() => {
    if (!showWinnerBg || results?.winnerPlayerId == null) return undefined;
    const burst = (origin, angle) =>
      confetti({
        particleCount: 72,
        angle,
        spread: 52,
        startVelocity: 40,
        gravity: 0.62,
        origin,
        zIndex: 9999,
        scalar: 1,
      });
    const id = window.setTimeout(() => {
      burst({ x: 0.06, y: 0.88 }, 62);
      window.setTimeout(() => burst({ x: 0.94, y: 0.88 }, 118), 85);
    }, 0);
    return () => window.clearTimeout(id);
  }, [showWinnerBg, results?.winnerPlayerId]);

  useLayoutEffect(() => {
    const prev = {
      backgroundImage: document.body.style.backgroundImage,
      backgroundSize: document.body.style.backgroundSize,
      backgroundPosition: document.body.style.backgroundPosition,
      backgroundRepeat: document.body.style.backgroundRepeat,
      backgroundAttachment: document.body.style.backgroundAttachment,
    };

    const applyBodyBg = () => {
      const isMob = window.innerWidth < 769;
      const url = showWinnerBg
        ? isMob
          ? winnerBgMob
          : winnerBgDesk
        : isMob
        ? usePlayfulBg
          ? bgMob2
          : bgMob
        : usePlayfulBg
        ? bgDesk2
        : bgDesk;
      document.body.style.backgroundImage = `url(${url})`;
      document.body.style.backgroundSize = "100% 100%";
      document.body.style.backgroundPosition = "center";
      document.body.style.backgroundRepeat = "no-repeat";
      document.body.style.backgroundAttachment = "fixed";
    };

    applyBodyBg();
    window.addEventListener("resize", applyBodyBg);

    return () => {
      window.removeEventListener("resize", applyBodyBg);
      document.body.style.backgroundImage = prev.backgroundImage;
      document.body.style.backgroundSize = prev.backgroundSize;
      document.body.style.backgroundPosition = prev.backgroundPosition;
      document.body.style.backgroundRepeat = prev.backgroundRepeat;
      document.body.style.backgroundAttachment = prev.backgroundAttachment;
    };
  }, [showWinnerBg, usePlayfulBg]);

  const pollGameState = useCallback(async () => {
    if (!adminToken || !currentTheme || !sessionId) return;
    try {
      const data = await wmlGetState({
        token: adminToken,
        currentTheme,
        sessionId,
      });
      setWmlRestPayload(data);
    } catch {
      /* ignore transient errors */
    }
  }, [adminToken, currentTheme, sessionId]);

  const lobbyCount = useMemo(() => {
    const roster = wmlRtdb?.roster ?? wmlRestPayload?.roster;
    if (!Array.isArray(roster)) return null;
    return roster.filter(
      (p) => p.is_active === 1 || p.is_active === true
    ).length;
  }, [wmlRtdb?.roster, wmlRestPayload?.roster]);

  const showWaitingCopy =
    phase === "waiting" ||
    (phase !== "results" &&
      phase !== "final" &&
      phase !== "ended" &&
      !currentRound?.promptText);

  useEffect(() => {
    if (!adminToken || !currentTheme || joinLoading || !sessionId) return undefined;
    pollGameState();
    return undefined;
  }, [adminToken, currentTheme, joinLoading, sessionId, pollGameState]);

  useEffect(() => {
    if (!adminToken || !currentTheme || !sessionId || joinLoading) return undefined;
    const onVis = () => {
      if (document.visibilityState === "visible") {
        pollGameState();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [adminToken, currentTheme, sessionId, joinLoading, pollGameState]);

  const promptText =
    phase === "question" || phase === "results"
      ? currentRound?.promptText || ""
      : "";

  const inQuestionPhase = phase === "question" && currentRound?.promptText;
  const [questionTimerTick, setQuestionTimerTick] = useState(0);
  const roundId = currentRound?.roundId ?? null;

  useEffect(() => {
    if (!inQuestionPhase || wml?.questionDeadlineMs == null) {
      return undefined;
    }
    const id = window.setInterval(
      () => setQuestionTimerTick((t) => t + 1),
      1000
    );
    return () => window.clearInterval(id);
  }, [inQuestionPhase, wml?.questionDeadlineMs]);

  const questionSecondsLeft = useMemo(() => {
    const d = Number(wml?.questionDeadlineMs);
    if (!inQuestionPhase || !Number.isFinite(d)) return null;
    return Math.max(0, Math.ceil((d - Date.now()) / 1000));
  }, [inQuestionPhase, wml?.questionDeadlineMs, questionTimerTick]);
  const hasVotedThisRound =
    roundId != null && votedRoundId != null && votedRoundId === roundId;

  useEffect(() => {
    if (!sessionId || !currentTheme) {
      setVotedRoundId(null);
      setLastVoteChoice(null);
      return;
    }
    if (roundId == null) {
      setVotedRoundId(null);
      setLastVoteChoice(null);
      return;
    }
    try {
      const raw = sessionStorage.getItem(voteStorageKey(sessionId, currentTheme));
      if (!raw) {
        setVotedRoundId(null);
        setLastVoteChoice(null);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Number(parsed.roundId) === Number(roundId)) {
        setVotedRoundId(roundId);
        setLastVoteChoice(parsed.chosenPlayerId);
      } else {
        setVotedRoundId(null);
        setLastVoteChoice(null);
      }
    } catch {
      setVotedRoundId(null);
      setLastVoteChoice(null);
    }
  }, [sessionId, currentTheme, roundId]);

  const handleVote = async (chosenPlayerId) => {
    if (!adminToken || !currentTheme || !playerId || voteSubmitting) return;
    setVoteError("");
    setVoteSubmitting(true);
    try {
      await wmlVote({
        token: adminToken,
        currentTheme,
        voterPlayerId: playerId,
        chosenPlayerId,
        sessionId,
      });
      setVotedRoundId(roundId);
      setLastVoteChoice(chosenPlayerId);
      try {
        sessionStorage.setItem(
          voteStorageKey(sessionId, currentTheme),
          JSON.stringify({ roundId, chosenPlayerId })
        );
      } catch {
        /* ignore */
      }
    } catch (e) {
      setVoteError(e.message || "Vote failed");
    } finally {
      setVoteSubmitting(false);
    }
  };

  const roundOptions = useMemo(
    () => normalizeFirebaseList(currentRound?.options),
    [currentRound?.options]
  );

  const nameByPlayerId = useMemo(() => {
    const m = {};
    roundOptions.forEach((o) => {
      if (o && o.playerId != null) m[o.playerId] = o.displayName || "";
    });
    return m;
  }, [roundOptions]);

  const winnerInfo = useMemo(() => {
    const wid = results?.winnerPlayerId;
    if (wid == null) return null;
    const opt = roundOptions.find((o) => o.playerId === wid);
    if (opt) {
      return {
        name: opt.displayName || `Player ${wid}`,
        avatarKey: opt.avatarKey,
      };
    }
    const lb = normalizeFirebaseList(results?.leaderboard);
    const row = lb.find((r) => r.playerId === wid);
    if (row) {
      return {
        name: row.displayName || `Player ${wid}`,
        avatarKey: row.avatarKey,
      };
    }
    return {
      name: nameByPlayerId[wid] || `Player ${wid}`,
      avatarKey: "1",
    };
  }, [results, roundOptions, nameByPlayerId]);

  const winnerVoteCount = useMemo(() => {
    const tallies = normalizeFirebaseList(results?.tallies);
    const wid = results?.winnerPlayerId;
    if (wid == null) return null;
    const row = tallies.find((t) => t.playerId === wid);
    return row != null ? row.count : null;
  }, [results?.tallies, results?.winnerPlayerId]);

  const runnerUpTallies = useMemo(() => {
    const tallies = normalizeFirebaseList(results?.tallies);
    const wid = results?.winnerPlayerId;
    if (!tallies.length || wid == null) return [];
    return tallies
      .filter((t) => t.playerId !== wid)
      .sort((a, b) => Number(b.count) - Number(a.count))
      .slice(0, 3);
  }, [results?.tallies, results?.winnerPlayerId]);

  const leaderboardRows = useMemo(
    () => normalizeFirebaseList(results?.leaderboard),
    [results?.leaderboard]
  );
  const hasLeaderboard = leaderboardRows.length > 0;

  const myLeaderboardPoints = useMemo(() => {
    const row = leaderboardRows.find(
      (r) => Number(r.playerId) === Number(playerId)
    );
    return row != null ? Number(row.points) || 0 : 0;
  }, [leaderboardRows, playerId]);

  const wmlReportEndedSentRef = useRef(false);
  const lastReportPointsRef = useRef(undefined);

  useEffect(() => {
    wmlReportEndedSentRef.current = false;
    lastReportPointsRef.current = undefined;
  }, [sessionId, currentTheme]);

  useEffect(() => {
    if (!user || playerId == null || !currentTheme || !sessionId) return;

    const sync = async (points) => {
      const rid =
        user.reportId ?? readWmlReportId(sessionId, currentTheme) ?? null;
      const payload = buildWmlReportData(user, points, rid);
      try {
        const res = await sendReport(payload);
        const newId =
          res?.reportId ??
          res?.data?.reportId ??
          res?.report?.id ??
          res?.id;
        if (newId != null && newId !== true) {
          writeWmlReportId(sessionId, currentTheme, newId);
        }
      } catch (err) {
        console.error("[WML] sendReport", err);
      }
    };

    if (phase === "ended" && hasLeaderboard) {
      if (!wmlReportEndedSentRef.current) {
        wmlReportEndedSentRef.current = true;
        sync(myLeaderboardPoints);
      }
      return;
    }

    if (lastReportPointsRef.current === myLeaderboardPoints) return;
    lastReportPointsRef.current = myLeaderboardPoints;

    if (phase === "waiting" && myLeaderboardPoints === 0) return;

    sync(myLeaderboardPoints);
  }, [
    user,
    playerId,
    currentTheme,
    sessionId,
    phase,
    hasLeaderboard,
    myLeaderboardPoints,
  ]);

  const promptLive =
    (phase === "question" || phase === "results") && Boolean(promptText);
  const showQuestionCard =
    showWaitingCopy ||
    (phase === "ended" && !hasLeaderboard) ||
    promptLive;

  useEffect(() => {
    if (location.state?.fromLeaderboard) return;
    if (phase !== "ended" || !hasLeaderboard) return;
    navigate("/who-most-likely/leaderboard", { replace: true });
  }, [phase, hasLeaderboard, navigate, location.state]);

  if (!adminToken) {
    return null;
  }

  if (themeStatus === "loading" && !currentTheme) {
    return (
      <main
        className={`who-most-likely who-most-likely--centered ${skinClass}`}
      >
        <p className="who-most-likely__status">Loading…</p>
      </main>
    );
  }

  if (!currentTheme) {
    navigate("/login", { replace: true });
    return null;
  }

  if (joinLoading) {
    return (
      <main
        className={`who-most-likely who-most-likely--centered ${skinClass}`}
      >
        <p className="who-most-likely__status">Joining game…</p>
      </main>
    );
  }

  if (joinError) {
    return (
      <main
        className={`who-most-likely who-most-likely--centered ${skinClass}`}
      >
        <p className="who-most-likely__error">{joinError}</p>
      </main>
    );
  }

  return (
    <main
      className={[
        "who-most-likely",
        skinClass,
        inQuestionPhase ? "who-most-likely--voting" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {questionSecondsLeft != null ? (
        <div
          className="who-most-likely__question-timer"
          aria-live="polite"
        >
          {questionSecondsLeft}s
        </div>
      ) : null}
      <div className="who-most-likely__card who-most-likely__card--title">
        <p className="who-most-likely__card-text">Who is most likely to</p>
      </div>

      {showQuestionCard ? (
        <div
          className={[
            "who-most-likely__card who-most-likely__card--question",
            promptLive ? "who-most-likely__card--question--live" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {showWaitingCopy && (
            <div className="who-most-likely__waiting-block">
              <p className="who-most-likely__card-text who-most-likely__card-text--question who-most-likely__waiting-title">
                Waiting for the host…
              </p>
              {lobbyCount != null ? (
                <p className="who-most-likely__lobby-count">
                  Players connected: {lobbyCount}
                </p>
              ) : null}
            </div>
          )}

          {phase === "ended" && !hasLeaderboard && (
            <p className="who-most-likely__card-text who-most-likely__card-text--question">
              Game over. Thanks for playing!
            </p>
          )}

          {promptLive ? (
            <p className="who-most-likely__card-text who-most-likely__card-text--question">
              {promptText}
            </p>
          ) : null}
        </div>
      ) : null}

      {showWinnerBg && winnerInfo ? (
        <div className="who-most-likely__winner-strip">
          <div className="who-most-likely__winner-orbit-wrap">
            <div className="who-most-likely__winner-accent-ring" aria-hidden />
            {winnerVoteCount != null ? (
              <div
                className="who-most-likely__winner-points-bubble"
                aria-label={String(winnerVoteCount)}
              >
                {winnerVoteCount}
              </div>
            ) : null}
            <div className="who-most-likely__winner-avatar-ring">
              <img
                src={avatarSrcForKey(winnerInfo.avatarKey, avatarDisplayUrls)}
                alt=""
              />
            </div>
          </div>
          <p className="who-most-likely__winner-name">{winnerInfo.name}</p>
        </div>
      ) : null}

      {showWinnerBg &&
      runnerUpTallies.length > 0 &&
      !hasLeaderboard ? (
        <div className="who-most-likely__runner-ups">
          {runnerUpTallies.map((t) => {
            const opt = roundOptions.find((o) => o.playerId === t.playerId);
            const src = avatarSrcForKey(opt?.avatarKey, avatarDisplayUrls);
            return (
              <div
                key={t.playerId}
                className="who-most-likely__runner-up"
              >
                <div className="who-most-likely__runner-up-ring">
                  <img src={src} alt="" />
                </div>
                <p className="who-most-likely__runner-up-name">
                  {nameByPlayerId[t.playerId] || opt?.displayName || "—"}
                </p>
                <span className="who-most-likely__runner-up-count">
                  {t.count}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {!inQuestionPhase ? (
        <div className="who-most-likely__spacer" aria-hidden />
      ) : null}

      {inQuestionPhase ? (
        <div className="who-most-likely__vote-block">
          <div className="who-most-likely__vote-column">
            <div
              className="who-most-likely__avatars"
              key={roundId ?? "avatars"}
            >
              {roundOptions.map((opt, idx) => {
                const src = avatarSrcForKey(opt.avatarKey, avatarDisplayUrls);
                const disabled =
                  voteSubmitting || hasVotedThisRound || !opt.playerId;
                const selected =
                  hasVotedThisRound &&
                  lastVoteChoice != null &&
                  opt.playerId === lastVoteChoice;
                return (
                  <div
                    key={opt.playerId}
                    className="who-most-likely__avatar-enter"
                    style={{
                      animationDelay: `${idx * 0.12}s`,
                    }}
                  >
                    <button
                      type="button"
                      className={[
                        "who-most-likely__avatar-slot who-most-likely__avatar-slot--btn",
                        selected
                          ? "who-most-likely__avatar-slot--selected"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      disabled={disabled}
                      onClick={() => handleVote(opt.playerId)}
                    >
                      <div className="who-most-likely__avatar-ring who-most-likely__avatar-ring--pop">
                        <img src={src} alt="" />
                      </div>
                      <p className="who-most-likely__avatar-name">
                        {opt.displayName || "—"}
                      </p>
                    </button>
                  </div>
                );
              })}
            </div>
            {voteError ? (
              <p className="who-most-likely__error who-most-likely__error--inline">
                {voteError}
              </p>
            ) : null}
          </div>
          {hasVotedThisRound ? (
            <p className="who-most-likely__post-vote">
              Waiting for results…
              {votesSummary &&
              typeof votesSummary.submittedCount === "number" &&
              typeof votesSummary.expectedCount === "number" ? (
                <span className="who-most-likely__vote-progress">
                  {" "}
                  ({votesSummary.submittedCount}/{votesSummary.expectedCount}{" "}
                  voted)
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
