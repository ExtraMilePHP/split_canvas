import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { selectAdminToken, selectSessionId } from "../../admin/sessionSlice";
import { wmlGetState } from "../../admin/functions/wmlApi";
import { setBackButtonUrl } from "../uiSlice";
import { normalizeFirebaseList, normalizeWml } from "../../lib/wmlSnapshotUtils";
import lbBgDesk from "../../img/assets/parts/leaderboard-background-desk.jpg";
import lbBgMob from "../../img/assets/parts/leaderboard-background-mob.jpg";
import leaderboardTextBackground from "../../img/assets/parts/leaderboard-text-background.png";
import trophyIcon from "../../img/assets/parts/trophy-icon.png";
import "./wmlLeaderboardPage.css";

const TERMINAL = new Set(["final", "ended"]);

export default function WmlLeaderboardPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const adminToken = useSelector(selectAdminToken);
  const sessionId = useSelector(selectSessionId);
  const { currentTheme, status: themeStatus } = useSelector(
    (state) => state.theme
  );

  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState("waiting");
  const [resultsNorm, setResultsNorm] = useState(null);

  useEffect(() => {
    dispatch(setBackButtonUrl("/who-most-likely"));
  }, [dispatch]);

  useLayoutEffect(() => {
    const prev = {
      backgroundImage: document.body.style.backgroundImage,
      backgroundSize: document.body.style.backgroundSize,
      backgroundPosition: document.body.style.backgroundPosition,
      backgroundRepeat: document.body.style.backgroundRepeat,
      backgroundAttachment: document.body.style.backgroundAttachment,
    };

    const apply = () => {
      const isMob = window.innerWidth < 769;
      const url = isMob ? lbBgMob : lbBgDesk;
      document.body.style.backgroundImage = `url(${url})`;
      document.body.style.backgroundSize = "100% 100%";
      document.body.style.backgroundPosition = "center";
      document.body.style.backgroundRepeat = "no-repeat";
      document.body.style.backgroundAttachment = "fixed";
    };

    apply();
    window.addEventListener("resize", apply);

    return () => {
      window.removeEventListener("resize", apply);
      document.body.style.backgroundImage = prev.backgroundImage;
      document.body.style.backgroundSize = prev.backgroundSize;
      document.body.style.backgroundPosition = prev.backgroundPosition;
      document.body.style.backgroundRepeat = prev.backgroundRepeat;
      document.body.style.backgroundAttachment = prev.backgroundAttachment;
    };
  }, []);

  useEffect(() => {
    if (!adminToken) {
      navigate("/login", { replace: true });
    }
  }, [adminToken, navigate]);

  useEffect(() => {
    if (
      !adminToken ||
      !currentTheme ||
      !sessionId ||
      themeStatus === "loading"
    ) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await wmlGetState({
          token: adminToken,
          currentTheme,
          sessionId,
        });
        if (cancelled || !data.success) return;
        setPhase(data.phase || "waiting");
        const norm = normalizeWml({ results: data.results });
        setResultsNorm(norm?.results ?? null);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminToken, currentTheme, sessionId, themeStatus]);

  useEffect(() => {
    if (loading || !currentTheme) return;
    if (!TERMINAL.has(phase)) {
      navigate("/who-most-likely", { replace: true });
    }
  }, [loading, phase, currentTheme, navigate]);

  const rows = useMemo(
    () => normalizeFirebaseList(resultsNorm?.leaderboard),
    [resultsNorm?.leaderboard]
  );

  if (!adminToken) {
    return null;
  }

  if (themeStatus === "loading" && !currentTheme) {
    return (
      <main className="wml-lb-page">
        <p className="wml-lb-status">Loading…</p>
      </main>
    );
  }

  if (!currentTheme) {
    navigate("/login", { replace: true });
    return null;
  }

  if (loading) {
    return (
      <main className="wml-lb-page">
        <p className="wml-lb-status">Loading…</p>
      </main>
    );
  }

  if (!TERMINAL.has(phase)) {
    return null;
  }

  return (
    <main className="wml-lb-page">
      <div className="wml-lb-card">
        <img
          src={trophyIcon}
          alt=""
          className="wml-lb-trophy wml-lb-trophy--left"
          aria-hidden
        />
        <img
          src={trophyIcon}
          alt=""
          className="wml-lb-trophy wml-lb-trophy--right"
          aria-hidden
        />
        <div className="wml-lb-banner">
          <img
            src={leaderboardTextBackground}
            alt="Leaderboard"
            className="wml-lb-banner__img"
          />
        </div>
        {rows.length === 0 ? (
          <p className="wml-lb-empty">No scores recorded yet.</p>
        ) : (
          <ul className="wml-lb-list">
            {rows.map((row, idx) => (
              <li key={row.playerId ?? idx} className="wml-lb-row">
                <span className="wml-lb-rank">{idx + 1}.</span>
                <span className="wml-lb-name">
                  {row.displayName || `Player ${row.playerId}`}
                </span>
                <span className="wml-lb-pts">{row.points ?? 0}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
