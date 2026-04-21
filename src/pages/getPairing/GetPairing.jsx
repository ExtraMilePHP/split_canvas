import React, { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setBackButtonUrl } from "../uiSlice";
import { selectAdminToken } from "../../admin/sessionSlice";
import { processQuestions } from "../../admin/questionSlice";
import { initQuestions } from "../../functions/setUserQuestions";
import { joinSplitCanvasPair } from "../../functions/splitCanvasApi";
import IntroModal from "../introModal/introModal";
import HowToPlayCard from "../rules/HowToPlayCard";
import nextButtonAsset from "../../img/assets/next-button.png";
import userIconAsset from "../../img/assets/user-icon.png";
import "../rules/howToPlayCard.css";
import "../rules/rules.css";
import "./getPairing.css";

const STORAGE_KEY = "split_canvas_ctx_v1";
const INTRO_SESSION_KEY = "split_canvas_intro_seen";

function parseSets(themeData) {
  let sets = themeData?.splitImageSets;
  if (sets == null) return [];
  if (typeof sets === "string") {
    try {
      sets = JSON.parse(sets);
    } catch {
      return [];
    }
  }
  return Array.isArray(sets) ? sets : [];
}

export default function GetPairing() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const token = useSelector(selectAdminToken);
  const { user } = useSelector((s) => s.auth);
  const themeData = useSelector((s) => s.theme.data);
  const themeName =
    themeData?.themename ?? themeData?.themeName ?? themeData?.themename;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [row, setRow] = useState(null);
  const [showHowToPlayModal, setShowHowToPlayModal] = useState(false);
  const [showIntroModal, setShowIntroModal] = useState(false);

  const numSets = Math.max(1, parseSets(themeData).length);

  useEffect(() => {
    dispatch(setBackButtonUrl("/login?&save=true"));
  }, [dispatch]);

  useEffect(() => {
    if (!themeData || !user || !token) return;

    dispatch(processQuestions())
      .unwrap()
      .then(() => {
        return initQuestions({
          userId: user.userId,
          email: user.email,
          fullName: user.name,
          themeName: themeData.themename,
          token,
        });
      })
      .catch((err) => {
        console.error("Error in process→init chain:", err);
      });
  }, [themeData, user, token, dispatch]);

  useEffect(() => {
    if (!themeData || !user || !token) return;
    if (themeData.lifelines) return;
    if (!themeData?.intro || !themeData?.introFile) return;
    if (sessionStorage.getItem(INTRO_SESSION_KEY)) return;
    setShowIntroModal(true);
  }, [themeData, user, token]);

  const dismissIntro = () => {
    sessionStorage.setItem(INTRO_SESSION_KEY, "1");
    setShowIntroModal(false);
  };

  const runJoin = useCallback(async () => {
    if (!token || !user?.userId || !themeName) {
      setLoading(false);
      setError("Missing session or theme. Try logging in again.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await joinSplitCanvasPair(token, {
        userId: String(user.userId),
        userName: String(user.name || user.email || "Player"),
        themeName: String(themeName),
        numSets,
      });
      if (!res.success) throw new Error(res.error || "Join failed");
      const ctx = {
        pairId: res.pairId,
        side: res.side,
        setIndex: res.setIndex,
        themeName: String(themeName),
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
      const goGallery =
        res.redirectToGallery ||
        (res.side === "left" && res.leftSubmitted) ||
        (res.side === "right" && res.rightSubmitted);
      if (goGallery) {
        navigate("/gallery");
        return;
      }
      setRow({
        pairId: res.pairId,
        side: res.side,
        setIndex: res.setIndex,
        partnerName: res.partnerName,
        leftSubmitted: res.leftSubmitted,
        rightSubmitted: res.rightSubmitted,
        myName: String(user.name || user.email || "You"),
      });
    } catch (e) {
      console.error("[get-pairing] join failed:", e);
      setError(e.message || "Pairing failed");
    } finally {
      setLoading(false);
    }
  }, [token, user, themeName, numSets, navigate]);

  useEffect(() => {
    runJoin();
  }, [runJoin]);

  const goDraw = async () => {
    let raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      await runJoin();
      raw = sessionStorage.getItem(STORAGE_KEY);
    }
    if (raw) {
      navigate("/draw", { state: JSON.parse(raw) });
    }
  };

  const leftLabel = () => {
    if (!row) return "…";
    if (row.side === "left") return row.myName;
    return row.partnerName || "Partner";
  };

  const rightLabel = () => {
    if (!row) return "…";
    if (row.side === "left") return row.partnerName || "Pairing…";
    return row.myName;
  };

  return (
    <div className="get-pairing-page">
      <header className="get-pairing__header">
        <span className="get-pairing__header-spacer" aria-hidden="true" />
        <h1 className="get-pairing__title">Get Pairing</h1>
        <div className="get-pairing__header-actions">
          <button
            type="button"
            className="get-pairing__howto-btn"
            onClick={() => setShowHowToPlayModal(true)}
          >
            How to play
          </button>
        </div>
      </header>

      <div className="get-pairing__cards get-pairing__cards--pair-row">
        <div className="get-pairing__card">
          <div className="get-pairing__avatar-wrap">
            <img
              src={userIconAsset}
              alt=""
              className="get-pairing__avatar-img"
              draggable={false}
            />
          </div>
          <span className="get-pairing__label get-pairing__label--small">
            {loading ? "…" : leftLabel()}
          </span>
          <span className="get-pairing__sublabel">Left canvas</span>
        </div>
        <div className="get-pairing__card">
          <div className="get-pairing__avatar-wrap">
            <img
              src={userIconAsset}
              alt=""
              className="get-pairing__avatar-img"
              draggable={false}
            />
          </div>
          <span className="get-pairing__label get-pairing__label--small">
            {loading ? "…" : rightLabel()}
          </span>
          <span className="get-pairing__sublabel">
            {row?.side === "left" && !row?.partnerName
              ? "Waiting for partner"
              : "Right canvas"}
          </span>
        </div>
      </div>

      <div className="get-pairing__footer">
        <button
          type="button"
          className="how-to-play__next"
          onClick={goDraw}
          disabled={loading || !!error || !row}
          aria-label="Next"
        >
          <span className="how-to-play__next-sr">Next</span>
          <img
            src={nextButtonAsset}
            alt=""
            className="how-to-play__next-img"
            width={220}
            height={56}
          />
        </button>
      </div>

      {showHowToPlayModal && (
        <div className="get-pairing-howto-modal" role="dialog" aria-modal="true">
          <div
            className="get-pairing-howto-modal__backdrop"
            aria-hidden="true"
            onClick={() => setShowHowToPlayModal(false)}
          />
          <div className="get-pairing-howto-modal__panel">
            <button
              type="button"
              className="get-pairing-howto-modal__close"
              onClick={() => setShowHowToPlayModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            <div className="user-rules-page get-pairing-howto-modal__inner">
              <HowToPlayCard
                rules={themeData?.rules || []}
                onNext={() => setShowHowToPlayModal(false)}
                nextAriaLabel="Close"
                nextSrLabel="Close"
              />
            </div>
          </div>
        </div>
      )}

      <IntroModal
        isOpen={showIntroModal}
        onClose={dismissIntro}
        onComplete={dismissIntro}
        introFile={themeData?.introFile}
      />
    </div>
  );
}
