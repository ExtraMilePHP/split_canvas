import React, { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setBackButtonUrl } from "../uiSlice";
import { selectAdminToken } from "../../admin/sessionSlice";
import {
  fetchSplitCanvasGallery,
  postSplitCanvasReaction,
} from "../../functions/splitCanvasApi";
import { sendReport } from "../../functions/sendReport";
import Swal from "sweetalert2";
import partImg from "../../img/assets/part-2.png";
import "./gallery.css";

function s3u(key) {
  if (!key) return "";
  const base = process.env.REACT_APP_S3_PATH || "";
  return base.endsWith("/") ? `${base}${key}` : `${base}/${key}`;
}

function withCacheBust(url, token) {
  if (!url) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}cb=${encodeURIComponent(String(token))}`;
}

function DownloadIcon() {
  return (
    <svg
      className="gallery-card__download-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"
      />
    </svg>
  );
}

function IconThumbsUp() {
  return (
    <svg className="gallery-reactions__svg" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"
      />
    </svg>
  );
}

function IconHeart() {
  return (
    <svg className="gallery-reactions__svg" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      />
    </svg>
  );
}

function IconLaugh() {
  return (
    <svg className="gallery-reactions__svg" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"
      />
    </svg>
  );
}

function IconSurprised() {
  return (
    <svg
      className="gallery-reactions__svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="10" r="1.35" fill="currentColor" />
      <circle cx="15" cy="10" r="1.35" fill="currentColor" />
      <ellipse
        cx="12"
        cy="15.5"
        rx="2.25"
        ry="3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function IconSad() {
  return (
    <svg className="gallery-reactions__svg" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 3c-2.33 0-4.31 1.46-5.11 3.5h10.22c-.8-2.04-2.78-3.5-5.11-3.5z"
      />
    </svg>
  );
}

function IconNeutral() {
  return (
    <svg className="gallery-reactions__svg" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.75c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5z"
      />
    </svg>
  );
}

const REACTIONS = [
  { id: "like", label: "Like", Icon: IconThumbsUp },
  { id: "love", label: "Love", Icon: IconHeart },
  { id: "laugh", label: "Laugh", Icon: IconLaugh },
  { id: "wow", label: "Surprised", Icon: IconSurprised },
  { id: "sad", label: "Sad", Icon: IconSad },
  { id: "neutral", label: "Neutral", Icon: IconNeutral },
];

function countFor(pair, id) {
  const map = {
    like: "react_like",
    love: "react_love",
    laugh: "react_laugh",
    wow: "react_wow",
    sad: "react_sad",
    neutral: "react_neutral",
  };
  return Number(pair[map[id]] ?? 0) || 0;
}

function ReactionBarFixed({ pair, onReact, disabled }) {
  const mine = pair.my_reaction ? String(pair.my_reaction).toLowerCase() : "";
  return (
    <div className="gallery-reactions" role="group" aria-label="Reactions">
      {REACTIONS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={
            mine === id
              ? "gallery-reactions__btn gallery-reactions__btn--active"
              : "gallery-reactions__btn"
          }
          disabled={disabled || mine === id}
          onClick={() => onReact(pair.id, id)}
          aria-label={label}
          aria-pressed={mine === id}
        >
          <Icon />
          <span className="gallery-reactions__count">{countFor(pair, id)}</span>
        </button>
      ))}
    </div>
  );
}

async function mergePairDownload(pair) {
  const lk = pair.left_s3_key;
  const rk = pair.right_s3_key;
  if (!lk || !rk) {
    Swal.fire(
      "Not ready yet",
      "Both sides need to be submitted before download.",
      "warning"
    );
    return;
  }
  const load = (key) =>
    new Promise((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("image load"));
      i.src = withCacheBust(s3u(key), `${pair.id}-${key}`);
    });

  const triggerDirectDownload = (url, filename) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const toBlob = (canvas) =>
    new Promise((resolve, reject) => {
      try {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("blob unavailable"));
            return;
          }
          resolve(blob);
        }, "image/png");
      } catch (e) {
        reject(e);
      }
    });

  try {
    const [l, r] = await Promise.all([load(lk), load(rk)]);
    const w = l.naturalWidth + r.naturalWidth;
    const h = Math.max(l.naturalHeight, r.naturalHeight);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(l, 0, 0);
    ctx.drawImage(r, l.naturalWidth, 0);
    const blob = await toBlob(c);
    const objectUrl = URL.createObjectURL(blob);
    triggerDirectDownload(objectUrl, `split-canvas-${pair.id}.png`);
    URL.revokeObjectURL(objectUrl);
  } catch {
    // Frontend-only fallback when canvas export is blocked by CORS.
    triggerDirectDownload(
      withCacheBust(s3u(lk), `${pair.id}-left`),
      `split-canvas-${pair.id}-left.png`
    );
    window.setTimeout(() => {
      triggerDirectDownload(
        withCacheBust(s3u(rk), `${pair.id}-right`),
        `split-canvas-${pair.id}-right.png`
      );
    }, 120);

    Swal.fire(
      "Merged download blocked",
      "CORS blocked merged export. Downloaded/opened left and right images separately.",
      "info"
    );
  }
}

function GalleryCard({ pair, onReact, reactBusy }) {
  const leftName = pair.left_user_name || "—";
  const rightName = pair.right_user_name || "—";
  const leftSrc = pair.left_s3_key
    ? withCacheBust(s3u(pair.left_s3_key), `${pair.id}-left-preview`)
    : partImg;
  const rightSrc = pair.right_s3_key
    ? withCacheBust(s3u(pair.right_s3_key), `${pair.id}-right-preview`)
    : partImg;
  const waitingLeft = !pair.left_submitted_at;
  const waitingRight = !pair.right_submitted_at;

  return (
    <article className="gallery-card">
      <div className="gallery-card__frame">
        <span
          className="gallery-card__name gallery-card__name--left"
          title={leftName}
        >
          {leftName}
        </span>
        <span
          className="gallery-card__name gallery-card__name--right"
          title={rightName}
        >
          {rightName}
        </span>
        <div className="gallery-card__split">
          <div className="gallery-card__half gallery-card__half--left">
            {waitingLeft ? (
              <div className="gallery-card__placeholder">Waiting…</div>
            ) : (
              <img src={leftSrc} alt="" draggable={false} crossOrigin="anonymous" />
            )}
          </div>
          <div className="gallery-card__half gallery-card__half--right">
            {waitingRight ? (
              <div className="gallery-card__placeholder">Waiting…</div>
            ) : (
              <img src={rightSrc} alt="" draggable={false} crossOrigin="anonymous" />
            )}
          </div>
        </div>
        <button
          type="button"
          className="gallery-card__download"
          aria-label="Download merged image"
          onClick={() => mergePairDownload(pair)}
        >
          <DownloadIcon />
        </button>
      </div>
      <ReactionBarFixed
        pair={pair}
        onReact={onReact}
        disabled={reactBusy}
      />
    </article>
  );
}

export default function Gallery() {
  const dispatch = useDispatch();
  const token = useSelector(selectAdminToken);
  const { user } = useSelector((s) => s.auth);
  const themeData = useSelector((s) => s.theme.data);
  const themeName =
    themeData?.themename ?? themeData?.themeName ?? themeData?.themename;

  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [reactBusy, setReactBusy] = useState(false);

  useEffect(() => {
    dispatch(setBackButtonUrl("/get-pairing"));
  }, [dispatch]);

  const load = useCallback(async () => {
    if (!token || !themeName) {
      setLoading(false);
      return;
    }
    setErr(null);
    try {
      const data = await fetchSplitCanvasGallery(
        token,
        String(themeName),
        user?.userId
      );
      setPairs(Array.isArray(data.pairs) ? data.pairs : []);
    } catch (e) {
      setErr(e.message || "Failed to load gallery");
    } finally {
      setLoading(false);
    }
  }, [token, themeName, user?.userId]);

  useEffect(() => {
    load();
  }, [load]);

  const syncReport = useCallback(
    (pairRows) => {
      if (!user?.sessionId || !themeName) return;
      const payload = {
        sessionId: user.sessionId,
        role: user.role,
        token: user.token || null,
        name: user.name,
        userId: user.userId,
        gameId: user.gameId || "",
        organizationId: user.organizationId,
        points: 0,
        time: 0,
        reportId: user.reportId || null,
        ans: JSON.stringify({
          splitCanvasGallery: {
            themeName,
            pairs: (pairRows || []).map((p) => ({
              id: p.id,
              react_like: p.react_like,
              react_love: p.react_love,
              react_laugh: p.react_laugh,
              react_wow: p.react_wow,
              react_sad: p.react_sad,
              react_neutral: p.react_neutral,
            })),
          },
        }),
      };
      sendReport(payload).catch(() => {});
    },
    [user, themeName]
  );

  const onReact = async (pairId, reaction) => {
    if (!token || reactBusy || !user?.userId) return;
    setReactBusy(true);
    try {
      const data = await postSplitCanvasReaction(
        token,
        pairId,
        reaction,
        user.userId
      );
      if (data.pair) {
        setPairs((prev) => {
          const next = prev.map((p) =>
            p.id === data.pair.id ? data.pair : p
          );
          syncReport(next);
          return next;
        });
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setReactBusy(false);
    }
  };

  return (
    <div className="gallery-page">
      <h1 className="gallery-page__title">GALLERY</h1>
      {loading && <p className="gallery-page__hint">Loading…</p>}
      {err && (
        <p className="gallery-page__hint" style={{ color: "#b91c1c" }}>
          {err}{" "}
          <button type="button" onClick={load}>
            Retry
          </button>
        </p>
      )}
      {!loading && !pairs.length && !err && (
        <p className="gallery-page__hint">No entries yet.</p>
      )}
      <div className="gallery-page__grid">
        {pairs.map((item) => (
          <GalleryCard
            key={item.id}
            pair={item}
            onReact={onReact}
            reactBusy={reactBusy}
          />
        ))}
      </div>
    </div>
  );
}
