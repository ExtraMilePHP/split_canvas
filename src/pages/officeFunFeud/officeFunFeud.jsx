import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Swal from "sweetalert2";
import { fetchUserQuestions } from "../../functions/fetchUserQuestions";
import { updateAnswer } from "../../functions/updateAnswer";
import { sendReport } from "../../functions/sendReport";
import { selectAdminToken } from "../../admin/sessionSlice";
import { setBackButtonUrl } from "../uiSlice";
import OfficeFunFeudLayout from "./OfficeFunFeudLayout";
import HowToPlayCard from "../rules/HowToPlayCard";
import { officeFunFeudAssets } from "./assets";
import "./officeFunFeud.css";

function fixEncoding(value) {
  return value;
}

function buildMappedQuestions(qs) {
  return (qs || []).map((q) => {
    const questionText = fixEncoding(q.question || q.question_name || "");
    const explaination = fixEncoding(q.explaination || q.explaination || "");
    const hintText = q.hint ?? q.question_hint ?? "";

    let opts = [];
    if (Array.isArray(q.options) && q.options.length) {
      opts = q.options.map((o) => fixEncoding(o || ""));
      while (opts.length < 4) opts.push("");
    } else {
      opts = [
        fixEncoding(q.option_one || q.option1 || ""),
        fixEncoding(q.option_two || q.option2 || ""),
        fixEncoding(q.option_three || q.option3 || ""),
        fixEncoding(q.option_four || q.option4 || ""),
      ];
    }

    return {
      ...q,
      question: questionText,
      options: opts,
      hint: hintText,
      answer_id: q.answer_id,
      showOption: q.showOption ?? q.show_option ?? "4",
      explaination,
      pointsMap: {
        1: Number(q.p1 || 0),
        2: Number(q.p2 || 0),
        3: Number(q.p3 || 0),
        4: Number(q.p4 || 0),
      },
    };
  });
}

export default function OfficeFunFeud() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const adminToken = useSelector(selectAdminToken);
  const { data: themeData } = useSelector((s) => s.theme);

  const fromRules = location.state?.fromRules === true;

  const flipEnabled = themeData?.flip === true || themeData?.flip === "true";
  const wantToShow = Number(
    themeData?.noOfQuestion ?? themeData?.no_of_questions ?? 0
  );
  const totalTime = Number(themeData?.eachTime ?? 60);
  const useOptionsPoints =
    themeData?.useOptionsPoints === true ||
    themeData?.useOptionsPoints === "true";

  const [phase, setPhase] = useState(() => (fromRules ? "game" : "start"));
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pointsState, setPointsState] = useState(0);
  const [seconds, setSeconds] = useState(totalTime);
  const [selected, setSelected] = useState(null);
  const [answerFeedback, setAnswerFeedback] = useState(null);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);

  const [overlay, setOverlay] = useState(null);
  const [lastEarned, setLastEarned] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const pendingNextRef = useRef(null);

  const currentQ = questions[currentIndex];

  useEffect(() => {
    dispatch(setBackButtonUrl("/rules"));
  }, [dispatch]);

  useEffect(() => {
    if (!user || !themeData) return;
    fetchUserQuestions({
      userId: user.userId,
      organizationId: user.organizationId,
      sessionId: user.sessionId,
      token: adminToken,
    })
      .then((data) => {
        let qs = data.allQuestions;
        const mapped = buildMappedQuestions(qs);
        if (flipEnabled && mapped.length === wantToShow + 1) {
          mapped.pop();
        }
        setQuestions(mapped);
        setPointsState(data.points);
        setCurrentIndex(data.current);
        if (data.current >= wantToShow) {
          navigate("/thankyou");
        }
      })
      .catch((err) => {
        console.error(err);
        if (err?.message === "No quiz session found for this user") {
          Swal.fire({ title: "Questions unavailable!", text: "", icon: "error" });
          return;
        }
        Swal.fire({ title: "Something went wrong!", text: "", icon: "error" });
      });
  }, [user, adminToken, flipEnabled, wantToShow, themeData, navigate]);

  useEffect(() => {
    if (!currentQ) return;
    if (currentQ?.hint) {
      setMediaLoaded(false);
      setVideoEnded(false);
    } else {
      setMediaLoaded(true);
      setVideoEnded(true);
    }
  }, [currentIndex, currentQ]);

  useEffect(() => {
    if (phase !== "game" || !user || !adminToken || !currentQ) return;
    if (overlay || showExplanation || answerFeedback) return;

    const hasMedia = Boolean(currentQ?.hint);
    const isMediaType =
      hasMedia && /\.(mp4|webm|ogg|mp3|wav|m4a|aac)$/i.test(currentQ.hint);

    if (isMediaType && (!mediaLoaded || !videoEnded)) return;

    setSeconds(totalTime);

    const id = setInterval(() => {
      setSeconds((s) => {
        const next = s - 1;
        if (next <= 0) {
          clearInterval(id);
          revealAnswer([]);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [
    phase,
    currentIndex,
    currentQ,
    totalTime,
    user,
    adminToken,
    mediaLoaded,
    videoEnded,
    overlay,
    showExplanation,
    answerFeedback,
  ]);

  const revealAnswer = (selIndices) => {
    if (!currentQ || answerFeedback) return;
    const correct = currentQ.answer_id;
    setAnswerFeedback({ correct, selected: selIndices });

    const timeSpent = totalTime - seconds;
    let earned = 0;

    if (useOptionsPoints) {
      selIndices.forEach((idx) => {
        earned += Number(currentQ.pointsMap?.[idx] || 0);
      });
    } else {
      const isCorrect = selIndices.includes(correct);
      const correctPts = Number(themeData.correctPoints || 0);
      let wrongPts = Number(themeData.wrongPoints || 0);
      if (selIndices.length === 0) wrongPts = 0;
      earned = isCorrect ? correctPts : -wrongPts;
    }

    const newPoints = pointsState + earned;
    const nextIndex = currentIndex + 1;
    const isQuizCompleted = nextIndex >= wantToShow;

    updateAnswer({
      userId: user.userId,
      current: nextIndex,
      timerTime: timeSpent,
      isQuizCompleted,
      token: adminToken,
      points: newPoints,
      userData: user,
    })
      .then((res) => {
        if (isQuizCompleted) {
          const reportData = {
            sessionId: user.sessionId,
            role: user.role,
            token: user.token || null,
            name: user.name,
            userId: user.userId,
            gameId: user.gameId || "",
            organizationId: user.organizationId,
            points: res.points,
            time: res.time,
            reportId: user.reportId || null,
            ans: "",
          };
          sendReport(reportData).catch(console.error);
          setLastEarned(earned);
          setPointsState(res.points ?? newPoints);
          pendingNextRef.current = null;
          setOverlay("final");
          return;
        }

        setPointsState(newPoints);
        setLastEarned(earned);
        pendingNextRef.current = nextIndex;
        setOverlay("result");
      })
      .catch((err) => {
        console.error("Failed to update answer:", err);
        setAnswerFeedback(null);
        setOverlay(null);
        pendingNextRef.current = null;
      });
  };

  const proceedAfterExplanation = () => {
    setShowExplanation(false);
    setOverlay("leaderboard");
  };

  const continueFromResult = () => {
    const hasEx =
      currentQ?.explaination && currentQ.explaination.trim() !== "";
    if (hasEx) {
      setShowExplanation(true);
      setOverlay(null);
    } else {
      setOverlay("leaderboard");
    }
  };

  const closeLeaderboardAndAdvance = () => {
    const pending = pendingNextRef.current;
    setOverlay(null);
    setAnswerFeedback(null);
    setSelected(null);
    setShowExplanation(false);
    if (pending != null) {
      setCurrentIndex(pending);
      pendingNextRef.current = null;
    }
  };

  const handleSelect = (idx1) => {
    if (answerFeedback || overlay) return;
    setSelected(idx1);
  };

  const handleSubmit = () => {
    if (answerFeedback || overlay) return;
    if (selected != null) revealAnswer([selected]);
  };

  const TIME_DOT_COUNT = 20;
  const activeTimeDots =
    totalTime > 0
      ? Math.max(0, Math.round((seconds / totalTime) * TIME_DOT_COUNT))
      : 0;
  const maxScoreEstimate = wantToShow * Math.max(
    1,
    Number(themeData?.correctPoints || 40)
  );
  const scorePct = Math.min(
    100,
    maxScoreEstimate > 0 ? (pointsState / maxScoreEstimate) * 100 : 0
  );

  const optionCount = currentQ?.showOption ? Number(currentQ.showOption) : 4;

  const themeLogoUrl =
    themeData?.logo && process.env.REACT_APP_S3_PATH
      ? `${process.env.REACT_APP_S3_PATH}${themeData.logo}`
      : null;

  const leaderboardInitial =
    (user?.name && String(user.name).trim().charAt(0).toUpperCase()) || "?";

  const renderStart = () => (
    <div className="off-fun-feud-panel">
      {themeLogoUrl ? (
        <img
          src={themeLogoUrl}
          alt="Office Fun Feud"
          className="off-fun-feud-panel__logo"
        />
      ) : (
        <div className="off-fun-feud-panel__logo off-fun-feud-logo-fallback off-fun-feud-logo-fallback--large">
          Office Fun Feud
        </div>
      )}
      <h1 className="off-fun-feud-panel__title">Office Fun Feud</h1>
      <p style={{ opacity: 0.9, marginBottom: "1.25rem" }}>
        Ready when you are.
      </p>
      <button
        type="button"
        className="off-fun-feud-btn"
        onClick={() => setPhase("rules")}
      >
        Begin
      </button>
    </div>
  );

  const renderRules = () => (
    <HowToPlayCard
      rules={themeData?.rules || []}
      onNext={() => setPhase("game")}
    />
  );

  const renderGame = () => {
    if (!questions.length || !currentQ) {
      return (
        <div className="quiz-loader-container">
          <div className="quiz-loader" />
        </div>
      );
    }

    const timerChipLabel =
      totalTime > 99
        ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
        : String(seconds);

    return (
      <div className="off-fun-feud-game">
        <div className="off-fun-feud-question-banner-wrap">
          <div
            className="off-fun-feud-question-banner"
            style={{
              backgroundImage: `url(${officeFunFeudAssets.questionBorder})`,
            }}
          >
            <div className="off-fun-feud-qhead">
              Question {currentIndex + 1} / {wantToShow}
            </div>
            <div className="off-fun-feud-question-text">
              {currentQ.question}
            </div>
          </div>
        </div>

        <div className="off-fun-feud-game__row">
        <div className="off-fun-feud-game__cell off-fun-feud-game__cell--timePillar">
          <div className="off-fun-feud-time-pillar">
            <div className="off-fun-feud-time-pillar__dots" aria-hidden>
              {Array.from({ length: TIME_DOT_COUNT }).map((_, i) => {
                const fromBottom = i;
                const isLit = fromBottom < activeTimeDots;
                const t =
                  TIME_DOT_COUNT > 1 ? i / (TIME_DOT_COUNT - 1) : 0;
                const hue = 320 - t * 125;
                return (
                  <span
                    key={i}
                    className={`off-fun-feud-time-dot${isLit ? " off-fun-feud-time-dot--lit" : ""}`}
                    style={
                      isLit
                        ? {
                            backgroundColor: `hsl(${hue}, 95%, 58%)`,
                            boxShadow: `0 0 8px hsl(${hue}, 100%, 55%)`,
                          }
                        : undefined
                    }
                  />
                );
              })}
            </div>
            <span className="off-fun-feud-pillar-label">TIME</span>
          </div>
        </div>

        <div className="off-fun-feud-frame-wrap off-fun-feud-game__cell off-fun-feud-game__cell--frame">
          <div className="off-fun-feud-frame-stage">
            <div className="off-fun-feud-frame">
              <img
                className="off-fun-feud-frame__img"
                src={officeFunFeudAssets.questionCard}
                alt=""
              />
              <div className="off-fun-feud-frame__inner">
                <div className="off-fun-feud-board">
                  <div className="off-fun-feud-timer-chip" aria-live="polite">
                    {timerChipLabel}
                  </div>
                  {currentQ.hint ? (
                    <div className="off-fun-feud-media">
                      {/\.(mp4|webm|ogg)$/i.test(currentQ.hint) ? (
                        <video
                          src={process.env.REACT_APP_S3_PATH + currentQ.hint}
                          controls
                          onLoadedData={() => setMediaLoaded(true)}
                          onEnded={() => setVideoEnded(true)}
                        />
                      ) : /\.(mp3|wav|m4a|aac|ogg)$/i.test(currentQ.hint) ? (
                        <audio
                          src={process.env.REACT_APP_S3_PATH + currentQ.hint}
                          controls
                          onLoadedMetadata={() => setMediaLoaded(true)}
                          onCanPlay={() => setMediaLoaded(true)}
                          onEnded={() => setVideoEnded(true)}
                        />
                      ) : (
                        <img
                          src={process.env.REACT_APP_S3_PATH + currentQ.hint}
                          alt=""
                          onLoad={() => {
                            setMediaLoaded(true);
                            setVideoEnded(true);
                          }}
                        />
                      )}
                    </div>
                  ) : null}
                  <div className="off-fun-feud-options-panel">
                    <div className="off-fun-feud-grid">
                      {currentQ.options.slice(0, optionCount).map((opt, idx) => {
                        const idx1 = idx + 1;
                        let cls = "off-fun-feud-opt";
                        if (answerFeedback) {
                          if (!useOptionsPoints) {
                            if (idx1 === answerFeedback.correct)
                              cls += " off-fun-feud-opt--correct";
                            else if (answerFeedback.selected.includes(idx1))
                              cls += " off-fun-feud-opt--wrong";
                          }
                        } else if (selected === idx1) {
                          cls += " off-fun-feud-opt--selected";
                        }
                        const pts = currentQ.pointsMap?.[idx1];
                        return (
                          <button
                            key={idx1}
                            type="button"
                            className={cls}
                            onClick={() => handleSelect(idx1)}
                            disabled={Boolean(answerFeedback)}
                          >
                            {/\.(png|jpe?g|jpeg)$/i.test(opt) ? (
                              <img
                                src={process.env.REACT_APP_S3_PATH + opt}
                                alt={`option-${idx1}`}
                                style={{ maxWidth: "100%", display: "block" }}
                              />
                            ) : (
                              opt
                            )}
                            {useOptionsPoints ? (
                              <div className="off-fun-feud-points-hint">
                                {pts > 0 ? `+${pts}` : pts} pts
                              </div>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="off-fun-feud-btn off-fun-feud-submit"
              onClick={handleSubmit}
              disabled={Boolean(answerFeedback) || selected == null}
            >
              Submit
            </button>
          </div>
        </div>

        <div className="off-fun-feud-game__cell off-fun-feud-game__cell--pointsPillar">
          <div className="off-fun-feud-points-pillar">
            <div className="off-fun-feud-points-pillar__inner">
              <div className="off-fun-feud-points-pillar__track-col">
                <div className="off-fun-feud-points-pillar__track">
                  <div
                    className="off-fun-feud-points-pillar__fill"
                    style={{ height: `${scorePct}%` }}
                  />
                </div>
                <div
                  className="off-fun-feud-points-pillar__marker"
                  style={{
                    bottom: `${scorePct}%`,
                    transform: "translateY(50%)",
                  }}
                >
                  <span className="off-fun-feud-points-pillar__thumb" />
                  <span className="off-fun-feud-points-pillar__score">
                    {pointsState}
                  </span>
                </div>
              </div>
            </div>
            <span className="off-fun-feud-pillar-label">POINTS</span>
          </div>
        </div>
        </div>
      </div>
    );
  };

  const correctOptionText = currentQ?.options?.[Number(currentQ?.answer_id) - 1];

  const renderResultOverlay = () => {
    if (overlay !== "result" || showExplanation) return null;
    const pos = lastEarned >= 0;
    return (
      <div className="off-fun-feud-modal-root">
        <div className="off-fun-feud-modal off-fun-feud-modal--result">
          <div className="off-fun-feud-modal__body">
            <h3>Result</h3>
            <div
              className={`off-fun-feud-modal__delta ${
                pos ? "off-fun-feud-modal__delta--pos" : "off-fun-feud-modal__delta--neg"
              }`}
            >
              {pos ? "+" : ""}
              {lastEarned}
            </div>
            {correctOptionText ? (
              <p style={{ fontSize: "0.95rem", opacity: 0.95 }}>
                Correct answer:{" "}
                <strong>
                  {/\.(png|jpe?g|jpeg)$/i.test(correctOptionText)
                    ? "(image)"
                    : correctOptionText}
                </strong>
              </p>
            ) : null}
            <button
              type="button"
              className="off-fun-feud-btn"
              onClick={continueFromResult}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderLeaderboardOverlay = () => {
    if (overlay !== "leaderboard") return null;
    return (
      <div className="off-fun-feud-modal-root">
        <div className="off-fun-feud-modal">
          <div className="off-fun-feud-modal__body">
            <img
              className="off-fun-feud-lb-title"
              src={officeFunFeudAssets.leaderboardText}
              alt="Leaderboard"
            />
            <p style={{ fontSize: "0.9rem", opacity: 0.85, marginBottom: "0.75rem" }}>
              Your standing (live rankings may be shown on the host screen).
            </p>
            <div className="off-fun-feud-lb-row">
              <span className="off-fun-feud-lb-row__rank">1</span>
              <span
                className="off-fun-feud-lb-row__avatar off-fun-feud-avatar-fallback"
                aria-hidden
              >
                {leaderboardInitial}
              </span>
              <div className="off-fun-feud-lb-row__meta">
                <div className="off-fun-feud-lb-row__name">
                  {user?.name || "You"}
                </div>
                <div style={{ fontSize: "0.8rem", opacity: 0.8 }}>Playing</div>
              </div>
              <div className="off-fun-feud-lb-row__score">{pointsState}</div>
            </div>
            <button
              type="button"
              className="off-fun-feud-btn"
              onClick={closeLeaderboardAndAdvance}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderFinalOverlay = () => {
    if (overlay !== "final") return null;
    return (
      <>
        <div className="off-fun-feud-final-confetti" aria-hidden />
        <div className="off-fun-feud-modal-root">
          <div className="off-fun-feud-modal">
            <div className="off-fun-feud-modal__body">
              <h2 style={{ margin: "0 0 0.5rem" }}>Great game!</h2>
              <p style={{ opacity: 0.9 }}>Final score</p>
              <div className="off-fun-feud-modal__delta off-fun-feud-modal__delta--pos">
                {pointsState}
              </div>
              <button
                type="button"
                className="off-fun-feud-btn"
                onClick={() => navigate("/thankyou")}
              >
                Finish
              </button>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderExplanation = () => {
    if (!showExplanation || !currentQ) return null;
    return (
      <div className="off-fun-feud-modal-root">
        <div className="off-fun-feud-modal off-fun-feud-explain">
          <div className="off-fun-feud-modal__body">
            <h3>Let&apos;s understand why</h3>
            <div className="off-fun-feud-explain__body">
              {fixEncoding(currentQ.explaination)}
            </div>
            <button
              type="button"
              className="off-fun-feud-btn"
              onClick={proceedAfterExplanation}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  };

  let body;
  if (phase === "start") body = renderStart();
  else if (phase === "rules") body = renderRules();
  else body = renderGame();

  return (
    <OfficeFunFeudLayout>
      {body}
      {overlay === "result" ? renderResultOverlay() : null}
      {renderExplanation()}
      {renderLeaderboardOverlay()}
      {renderFinalOverlay()}
    </OfficeFunFeudLayout>
  );
}
