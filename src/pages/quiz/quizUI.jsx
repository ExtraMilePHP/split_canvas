import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchUserQuestions } from "../../functions/fetchUserQuestions";
import { updateLifelines } from "../../functions/updateLifelines";
import { updateAnswer } from "../../functions/updateAnswer";
import { selectAdminToken } from "../../admin/sessionSlice";
import { ArrowBar, VerticalProgress } from "./helper";
import { Lifelines } from "./lifelines";
import "./QuizUI.css";
import { setBackButtonUrl } from "../uiSlice";
import { sendReport } from "../../functions/sendReport";
import Swal from "sweetalert2";
import ConfirmModal from "./ConfirmModal";

export default function QuizUI() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const adminToken = useSelector(selectAdminToken);
  const { data: themeData } = useSelector((state) => state.theme);

  const flipEnabled = themeData?.flip === true || themeData?.flip === "true";
  const wantToShow = Number(
    themeData?.noOfQuestion ?? themeData?.no_of_questions ?? 0
  );
  const totalTime = Number(themeData?.eachTime ?? 60);

  const [questions, setQuestions] = useState([]);
  const [flipQuestion, setFlipQuestion] = useState(null);
  const [lifelinesState, setLifelinesState] = useState([0, 0, 0, 0]);
  const [pointsState, setPointsState] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [seconds, setSeconds] = useState(totalTime);
  const [activeArrows, setActiveArrows] = useState(20);

  const [selected, setSelected] = useState(null);
  const [doubleDipActive, setDoubleDipActive] = useState(false);
  const [doubleSelections, setDoubleSelections] = useState([]);
  const [disabledOptions, setDisabledOptions] = useState([]);
  const [answerFeedback, setAnswerFeedback] = useState(null);

  const [mediaLoaded, setMediaLoaded] = useState(false);

  const [videoEnded, setVideoEnded] = useState(false);

  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [descriptionAccepted, setDescriptionAccepted] = useState(false);

  const [showExplainationModal, setShowExplainationModal] = useState(false);
  const explainationTimeoutRef = useRef(null);
  const pendingNextRef = useRef(null);

  const [usedInThisQuestion, setUsedInThisQuestion] = useState({
    double: false,
    fifty: false,
  });

  useEffect(() => {
    dispatch(setBackButtonUrl("/get-pairing"));
  }, []);

function fixEncoding(value) {
   return value;
}



  // Fetch questions
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
        console.log(qs);
        const mapped = (qs || []).map((q) => {
          // question text can be in q.question or q.question_name
          const questionText = fixEncoding(q.question || q.question_name || "");
          const explaination = fixEncoding(
            q.explaination || q.explaination || ""
          );

          // hint can be q.hint or q.question_hint
          const hintText = q.hint ?? q.question_hint ?? "";

          // options may be provided as an array q.options OR as separate fields option_one..four
          let opts = [];
          if (Array.isArray(q.options) && q.options.length) {
            opts = q.options.map((o) => fixEncoding(o || ""));
            // ensure length 4
            while (opts.length < 4) opts.push("");
          } else {
            const opt1 = fixEncoding(q.option_one || q.option1 || "");
            const opt2 = fixEncoding(q.option_two || q.option2 || "");
            const opt3 = fixEncoding(q.option_three || q.option3 || "");
            const opt4 = fixEncoding(q.option_four || q.option4 || "");
            opts = [opt1, opt2, opt3, opt4];
          }

          return {
            ...q,
            question: questionText,
            options: opts,
            hint: hintText,
            answer_id: q.answer_id,
            showOption: q.showOption ?? q.show_option ?? "4",
            explaination: explaination,
            pointsMap: {
                1: Number(q.p1 || 0),
                2: Number(q.p2 || 0),
                3: Number(q.p3 || 0),
                4: Number(q.p4 || 0),
              },
          };
        });

        let fq = null;
        if (flipEnabled && mapped.length === wantToShow + 1) {
          fq = mapped.pop();
        }
        console.log("mapped", mapped);

        setQuestions(mapped);
        setFlipQuestion(fq);
        setLifelinesState(data.lifelines);
        setPointsState(data.points);
        setCurrentIndex(data.current);
        if (data.current >= wantToShow) {
          Swal.close();
          navigate("/thankyou");
        }
      })
  .catch((err) => {
  console.error(err);

  // handle no session / no questions
  if (err?.message === "No quiz session found for this user") {
    Swal.fire({
      title: "Questions unavailable!",
      text: "",
      icon: "error",
    });
    return;
  }

  // generic fallback error popup
  Swal.fire({
    title: "Something went wrong!",
    text: "",
    icon: "error",
  });
});
  }, [user, adminToken, flipEnabled, wantToShow, themeData]);

  const currentQ = questions[currentIndex];
  const previousQ = questions[currentIndex - 1];

 useEffect(() => {
  if (!currentQ) return;

  const desc = currentQ.description || "";
  const hasDesc = desc.trim() !== "";

  setShowDescriptionModal(false);
  setDescriptionAccepted(!hasDesc); // If no description → auto-accept

  // 👉 FIX: Only trigger description timeout if explanation modal is NOT open
  if (hasDesc && !showExplainationModal) {
    const t = setTimeout(() => {
      // user hasn't accepted AND explanation is not open
      if (!descriptionAccepted && !showExplainationModal) {
        setShowDescriptionModal(true);
      }
    }, 2000);

    return () => clearTimeout(t);
  }

  // media logic remains untouched
  if (currentQ?.hint) {
    setMediaLoaded(false);
    setVideoEnded(false);
  } else {
    setMediaLoaded(true);
    setVideoEnded(true);
  }
}, [currentIndex, questions, showExplainationModal]);


useEffect(() => {
  setUsedInThisQuestion({ double: false, fifty: false });
}, [currentIndex]);

  useEffect(() => {
    if (!user || !adminToken || !currentQ) return;
    if (showExplainationModal) return;
    if (!descriptionAccepted) return;
    const stateKey = `quiz_state_${adminToken}_${user.userId}`;
    const stored = JSON.parse(localStorage.getItem(stateKey) || "{}");

    const hasMedia = Boolean(currentQ?.hint);
    const isMediaType =
      hasMedia && /\.(mp4|webm|ogg|mp3|wav|m4a|aac)$/i.test(currentQ.hint);

    const savedSec =
      stored.timer?.currentIndex === currentIndex ? stored.timer.seconds : null;
    const savedArrows =
      stored.arrows?.currentIndex === currentIndex ? stored.arrows.count : null;

    const hasPreviousProgress = savedSec !== null;

    // If already had progress, resume immediately
    if (isMediaType && !hasPreviousProgress) {
      if (!mediaLoaded || !videoEnded) return;
    }

    setSeconds(savedSec ?? totalTime);
    setActiveArrows(savedArrows ?? 20);

    const id = setInterval(() => {
      setSeconds((s) => {
        const next = s - 1;
        if (next <= 0) {
          clearInterval(id);
          localStorage.removeItem(stateKey);
          revealAnswer([]);
          return 0;
        }

        const nextArrows = Math.round((next / totalTime) * 20);
        setActiveArrows(nextArrows);

        // Save only one JSON object
        const state = {
          timer: { currentIndex, seconds: next },
          arrows: { currentIndex, count: nextArrows },
        };
        localStorage.setItem(stateKey, JSON.stringify(state));

        return next;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [
    currentIndex,
    totalTime,
    adminToken,
    user,
    currentQ,
    mediaLoaded,
    videoEnded,
    descriptionAccepted,
    showExplainationModal,
  ]);

  useEffect(() => {
    return () => {
      if (explainationTimeoutRef.current) {
        clearTimeout(explainationTimeoutRef.current);
        explainationTimeoutRef.current = null;
      }
    };
  }, []);

    const revealAnswer = (selIndices) => {
    if (!currentQ) return;
    const correct = currentQ.answer_id;
    console.log(selIndices);
    setAnswerFeedback({ correct, selected: selIndices });

    // clear any previous show-modal timer
    if (explainationTimeoutRef.current) {
      clearTimeout(explainationTimeoutRef.current);
    }

    console.log(currentQ.explaination);

    // show explanation modal after a short delay IF explanation text exists
    const hasExplaination =
      currentQ.explaination && currentQ.explaination.trim() !== "";

    if (hasExplaination) {
      // schedule showing the explanation modal but DO NOT advance the question yet.
      explainationTimeoutRef.current = setTimeout(() => {
        setShowExplainationModal(true);
      }, 2000);
    }

    const timeSpent = totalTime - seconds;
    // const isCorrect = selIndices.includes(correct);
    // const correctPts = Number(themeData.correctPoints || 0);
    // let wrongPts = Number(themeData.wrongPoints || 0);

    // if (selIndices.length === 0) {
    //   wrongPts = 0;
    // }
    // const earned = isCorrect ? correctPts : -wrongPts;
    // const newPoints = pointsState + earned;
    let earned = 0;

    if (themeData.useOptionsPoints === true || themeData.useOptionsPoints === "true") {
      selIndices.forEach((idx) => {
        earned += Number(currentQ.pointsMap?.[idx] || 0);
      });
    }  else {
      const isCorrect = selIndices.includes(correct);
      const correctPts = Number(themeData.correctPoints || 0);
      let wrongPts = Number(themeData.wrongPoints || 0);

      if (selIndices.length === 0) {
            wrongPts = 0;
      }

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

          sendReport(reportData)
            .then((apiRes) => {
              console.log("✔ Report API SUCCESS:", apiRes);
            })
            .catch((err) => {
              console.error("❌ Report API FAILED:", err);
            })
            .finally(() => {
              console.log("⚠ finally() executed — success OR fail");
              Swal.close();
              navigate("/thankyou");
            });

          return;
        }

        // update points immediately
        setPointsState(newPoints);

        // If there is an explanation, DO NOT auto-advance — store pending index and wait for modal close
        if (hasExplaination) {
          pendingNextRef.current = nextIndex;
          // keep answerFeedback visible; do not change currentIndex here
          return;
        }

        // No explanation → previous behavior: advance after short delay
        setTimeout(() => {
          setAnswerFeedback(null);
          setSelected(null);
          setDoubleDipActive(false);
          setDoubleSelections([]);
          setDisabledOptions([]);
          setUsedInThisQuestion({ double: false, fifty: false });
          setCurrentIndex(nextIndex);
          Swal.close();
        }, 1000);
      })
      .catch((err) => console.error("Failed to update answer:", err));
  };


  const handleExplainNext = () => {
    // close modal first
    setShowExplainationModal(false);

    // if pending next index was stored by revealAnswer, use it
    const pending = pendingNextRef.current;
    if (pending != null) {
      // reset UI state for next question
      setAnswerFeedback(null);
      setSelected(null);
      setDoubleDipActive(false);
      setDoubleSelections([]);
      setDisabledOptions([]);

      // advance to pending index and clear pending
      setUsedInThisQuestion({ double: false, fifty: false });

      setCurrentIndex(pending);
      pendingNextRef.current = null;

      // clear cached timer state so next question timer starts fresh
      const stateKey = `quiz_state_${adminToken}_${user.userId}`;
      localStorage.removeItem(stateKey);

      Swal.close();
      return;
    }

    // fallback: no pending stored — behave like before (final completion handled elsewhere)
    const nextIndex = currentIndex;
    const isQuizCompleted = nextIndex >= wantToShow;
    if (!isQuizCompleted) {
      setAnswerFeedback(null);
      setSelected(null);
      setDoubleDipActive(false);
      setDoubleSelections([]);
      setDisabledOptions([]);
      setUsedInThisQuestion({ double: false, fifty: false });
      setCurrentIndex(nextIndex);
    }
    const stateKey = `quiz_state_${adminToken}_${user.userId}`;
    localStorage.removeItem(stateKey);
  };

  const handleDescriptionNext = () => {
    setShowDescriptionModal(false);
    setDescriptionAccepted(true);

    // If there's no media or media already finished, timer useEffect will start (because descriptionAccepted changed)
    // If there is media, timer will still wait for mediaLoaded & videoEnded as before.
  };

  const handleSelect = (optIdx) => {
    if (answerFeedback) return;
    if (doubleDipActive) {
      if (doubleSelections.includes(optIdx)) {
        setDoubleSelections((prev) => prev.filter((i) => i !== optIdx));
      } else {
        setDoubleSelections((prev) =>
          prev.length < 2 ? [...prev, optIdx] : [prev[1], optIdx]
        );
      }
    } else {
      setSelected(optIdx);
    }
  };

  const handleSubmit = () => {
    if (answerFeedback) return;
    if (doubleDipActive) revealAnswer(doubleSelections);
    else if (selected != null) revealAnswer([selected]);
  };

  // Lifeline handlers restored
  const handleFlipUsed = () => {
    const current = questions[currentIndex];
    const newQs = [...questions];
    newQs[currentIndex] = flipQuestion;
    setQuestions(newQs);
    setFlipQuestion(current);
    const newLifelines = [...lifelinesState];
    newLifelines[0] = 1;
    setLifelinesState(newLifelines);
    updateLifelines({
      userId: user.userId,
      token: adminToken,
      lifelines: newLifelines,
    }).catch((err) => console.error(err));
  };

  const handleExpertUsed = () => {
    const newLifelines = [...lifelinesState];
    newLifelines[1] = 1;
    setLifelinesState(newLifelines);
    updateLifelines({
      userId: user.userId,
      token: adminToken,
      lifelines: newLifelines,
    }).catch((err) => console.error(err));
  };

  const handleDoubleDipUsed = () => {
    setDoubleDipActive(true);
    const newLifelines = [...lifelinesState];
    newLifelines[2] = 1;
    setLifelinesState(newLifelines);
    updateLifelines({
      userId: user.userId,
      token: adminToken,
      lifelines: newLifelines,
    }).catch((err) => console.error(err));
  };

  const handleFiftyUsed = (toRemove) => {
    setDisabledOptions(toRemove);
    const newLifelines = [...lifelinesState];
    newLifelines[3] = 1;
    setLifelinesState(newLifelines);
    updateLifelines({
      userId: user.userId,
      token: adminToken,
      lifelines: newLifelines,
    }).catch((err) => console.error(err));
  };

  if (!questions.length)
    return (
      <div className="quiz-loader-container">
        <div className="quiz-loader"></div>
      </div>
    );

  const optionCount = currentQ.showOption ? Number(currentQ.showOption) : 4;
  const totalQuestions = wantToShow;
  const progress = currentIndex + 1;

  return (
    <div
      className={`quiz-container ${!themeData.lifelines ? "no-lifelines" : ""}`}
    >
      <Lifelines
        lifelinesState={lifelinesState}
        flipQuestion={flipQuestion}
        currentQuestion={currentQ}
        answerFeedback={answerFeedback}
        onFlipUsed={handleFlipUsed}
        onExpertUsed={handleExpertUsed}
        onDoubleDipUsed={() => {
          setUsedInThisQuestion((prev) => ({ ...prev, double: true }));
          handleDoubleDipUsed();
        }}
        onFiftyUsed={(toRemove) => {
          setUsedInThisQuestion((prev) => ({ ...prev, fifty: true }));
          handleFiftyUsed(toRemove);
        }}
        themeData={themeData}
        usedInThisQuestion={{ ...usedInThisQuestion, ...(currentQ?._usedLifelines || {}) }}
        questionIndex={currentIndex}
      />

      {showDescriptionModal && currentQ && (
        <div
          key={`desc-${currentIndex}-${Date.now()}`} // force remount each show
          className="description-modal overlay"
        >
          <div className="description-modal__box">
            <h3 className="description-modal__title">Did you know ?</h3>
            <div className="description-modal__body">
              {fixEncoding(currentQ.description) || "No description available."}
            </div>
            <div className="description-modal__actions">
              <button
                className="description-modal__next"
                onClick={handleDescriptionNext}
              >
                I understand
              </button>
            </div>
          </div>
        </div>
      )}

      {showExplainationModal && currentQ && (
        <div className="explaination-modal overlay">
          <div className="explaination-modal__box">
            <h3 className="explaination-modal__title">
              Let's understand why ?
            </h3>
            <div className="explaination-modal__body">
              {fixEncoding(currentQ.explaination) ||
                "No explanation available."}
            </div>
            <div className="explaination-modal__actions">
              <button
                className="explaination-modal__next"
                onClick={handleExplainNext}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="quiz-main">
        <div className="quiz-timer-container">
          <div className="quiz-seconds-display">{seconds}</div>
          <ArrowBar total={20} active={activeArrows} />
        </div>
        <div className="quiz-main-handler">
          {currentQ.hint && (
            <div className="quiz-media">
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
                  // audio-specific load event - use onLoadedMetadata or onCanPlay
                  onLoadedMetadata={() => setMediaLoaded(true)}
                  onCanPlay={() => setMediaLoaded(true)}
                  onEnded={() => setVideoEnded(true)}
                />
              ) : (
                <img
                  src={process.env.REACT_APP_S3_PATH + currentQ.hint}
                  alt="Question hint"
                  onLoad={() => {
                    setMediaLoaded(true);
                    setVideoEnded(true); // Images are immediately "ended"
                  }}
                />
              )}
            </div>
          )}

          <div className="quiz-question">{currentQ.question}</div>
          <div className="quiz-options-handler">
            <div className="quiz-options">
              {currentQ.options.slice(0, optionCount).map((opt, idx) => {
                const idx1 = idx + 1;
                if (disabledOptions.includes(idx1)) return null;

                let cls = "quiz-option";

// 🔹 AFTER SUBMIT
if (answerFeedback) {
  // ❌ Skip correct/wrong ONLY in option-points mode
  if (
    !(themeData.useOptionsPoints === true || themeData.useOptionsPoints === "true")
  ) {
    if (idx1 === answerFeedback.correct)
      cls += " quiz-option--correct";
    else if (answerFeedback.selected.includes(idx1))
      cls += " quiz-option--wrong";
  }
}

// 🔹 BEFORE SUBMIT (UNCHANGED)
else {
  const selectedCls = doubleDipActive
    ? doubleSelections.includes(idx1)
      ? " quiz-option--selected"
      : ""
    : selected === idx1
    ? " quiz-option--selected"
    : "";

  cls += selectedCls;
}


                return (
                  <button
                    key={idx1}
                    className={cls}
                    onClick={() => handleSelect(idx1)}
                    disabled={Boolean(answerFeedback)}
                  >
                    {/\.(png|jpe?g|jpeg)$/i.test(opt) ? (
                      <img
                        src={
                          opt === "2887d549-a046-4381-bcb1-7d9038c9d217.png"
                            ? "/mnt/data/2887d549-a046-4381-bcb1-7d9038c9d217.png"
                            : process.env.REACT_APP_S3_PATH + opt
                        }
                        alt={`option-${idx1}`}
                        style={{ maxWidth: "100%", display: "block" }}
                      />
                    ) : (
                      opt
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            className="quiz-submit"
            onClick={handleSubmit}
            disabled={
              Boolean(answerFeedback) ||
              (doubleDipActive ? doubleSelections.length < 2 : selected == null)
            }
          >
            Submit
          </button>
        </div>
      </div>

      <div className="quiz-scoreboard">
        <div className="quiz-scoreboard-handler">
          <div className="quiz-score-circle">
            Your Score
            <div className="quiz-score-circle-data">{pointsState}</div>
          </div>
          <VerticalProgress total={totalQuestions} current={progress} />
        </div>
      </div>
    </div>
  );
}
