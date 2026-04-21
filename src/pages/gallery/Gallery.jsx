import React, { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setBackButtonUrl } from "../uiSlice";
import { selectAdminToken } from "../../admin/sessionSlice";
import {
  fetchSplitCanvasGallery,
  postSplitCanvasReaction,
} from "../../functions/splitCanvasApi";
import { sendReport } from "../../functions/sendReport";
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

const MAX_FILENAME_LABEL_LEN = 50;

const PAGE_SIZE = 10;

/** Safe segment for SplitCanvas_left_right filenames (Windows/macOS/Linux). */
function sanitizeFileLabel(name) {
  const raw = String(name ?? "").trim();
  const placeholder = "Player";
  if (!raw || raw === "—") {
    return placeholder;
  }
  const cleaned = raw
    .replace(/[/\\:*?"<>|]+/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  const out = cleaned || placeholder;
  return out.length > MAX_FILENAME_LABEL_LEN
    ? out.slice(0, MAX_FILENAME_LABEL_LEN)
    : out;
}

function splitCanvasDownloadBase(pair) {
  const left = sanitizeFileLabel(pair.left_user_name);
  const right = sanitizeFileLabel(pair.right_user_name);
  return `SplitCanvas_${left}_${right}`;
}

function buildSplitCanvasDownloadName(pair) {
  return `${splitCanvasDownloadBase(pair)}.png`;
}

/** iPhone only (excludes iPad / Android); avoids WKWebView blob navigation trap. */
function isIPhone() {
  return /iPhone/.test(navigator.userAgent || "");
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
    <svg
      className="gallery-reactions__svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="10" r="1.35" fill="currentColor" />
      <circle cx="15" cy="10" r="1.35" fill="currentColor" />
      <line
        x1="8"
        y1="15"
        x2="16"
        y2="15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const REACTIONS = [
  { id: "like", label: "Like", Icon: IconThumbsUp },
  { id: "love", label: "Love", Icon: IconHeart },
  { id: "sad", label: "Sad", Icon: IconSad },
  { id: "neutral", label: "Neutral", Icon: IconNeutral },
  { id: "laugh", label: "Laugh", Icon: IconLaugh },
  { id: "wow", label: "Surprised", Icon: IconSurprised },
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

async function mergePairDownload(pair, showNotice) {
  const lk = pair.left_s3_key;
  const rk = pair.right_s3_key;
  if (!lk || !rk) {
    showNotice({
      title: "Not ready yet",
      message: "Both sides need to be submitted before download.",
    });
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
    const filename = buildSplitCanvasDownloadName(pair);

    if (isIPhone()) {
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: filename });
        } catch (e) {
          if (e?.name === "AbortError") return;
          showNotice({
            title: "Could not share",
            message:
              "Sharing this image did not complete. Try opening the gallery in Safari.",
          });
        }
      } else {
        showNotice({
          title: "Download not available",
          message:
            "This view cannot open the share sheet for images. Try opening the gallery in Safari.",
        });
      }
    } else {
      const objectUrl = URL.createObjectURL(blob);
      triggerDirectDownload(objectUrl, filename);
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    // Frontend-only fallback when canvas export is blocked by CORS.
    const base = splitCanvasDownloadBase(pair);
    triggerDirectDownload(
      withCacheBust(s3u(lk), `${pair.id}-left`),
      `${base}-left.png`
    );
    window.setTimeout(() => {
      triggerDirectDownload(
        withCacheBust(s3u(rk), `${pair.id}-right`),
        `${base}-right.png`
      );
    }, 120);

    showNotice({
      title: "Merged download blocked",
      message:
        "CORS blocked merged export. Downloaded/opened left and right images separately.",
    });
  }
}

function GalleryCard({ pair, onReact, reactBusy, onShowNotice }) {
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
          onClick={() => mergePairDownload(pair, onShowNotice)}
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
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    dispatch(setBackButtonUrl("/get-pairing"));
  }, [dispatch]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(pairs.length / PAGE_SIZE));
    setPage((prev) => Math.min(prev, totalPages));
  }, [pairs.length]);

  const load = useCallback(async (opts) => {
    const silent =
      opts && typeof opts === "object" && opts.silent === true;
    if (!token || !themeName) {
      if (!silent) setLoading(false);
      return;
    }
    if (!silent) {
      setErr(null);
      setLoading(true);
    }
    try {
      const data = await fetchSplitCanvasGallery(
        token,
        String(themeName),
        user?.userId
      );
      setPairs(Array.isArray(data.pairs) ? data.pairs : []);
    } catch (e) {
      if (!silent) setErr(e.message || "Failed to load gallery");
      else console.warn("gallery silent refresh failed", e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token, themeName, user?.userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token || !themeName) return undefined;

    const interval = window.setInterval(() => {
      void load({ silent: true });
    }, 10000);

    return () => {
      window.clearInterval(interval);
    };
  }, [token, themeName, load]);

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

  const totalCount = pairs.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rangeStart = (page - 1) * PAGE_SIZE;
  const visiblePairs = pairs.slice(rangeStart, rangeStart + PAGE_SIZE);
  const pageNumbers = Array.from({ length: totalPages }, (_, idx) => idx + 1);

  return (
    <div className="gallery-page">
      {notice && (
        <div
          className="gallery-notice__overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gallery-notice-title"
          onClick={() => setNotice(null)}
        >
          <div
            className="gallery-notice__box"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="gallery-notice-title" className="gallery-notice__title">
              {notice.title}
            </h2>
            <p className="gallery-notice__text">{notice.message}</p>
            <button
              type="button"
              className="gallery-notice__ok"
              onClick={() => setNotice(null)}
            >
              OK
            </button>
          </div>
        </div>
      )}
      <h1 className="gallery-page__title">GALLERY</h1>
      {loading && <p className="gallery-page__hint">Loading…</p>}
      {err && (
        <p className="gallery-page__hint" style={{ color: "#b91c1c" }}>
          {err}{" "}
          <button type="button" onClick={() => load()}>
            Retry
          </button>
        </p>
      )}
      {!loading && !pairs.length && !err && (
        <p className="gallery-page__hint">No entries yet.</p>
      )}
      <div className="gallery-page__grid">
        {visiblePairs.map((item) => (
          <GalleryCard
            key={item.id}
            pair={item}
            onReact={onReact}
            reactBusy={reactBusy}
            onShowNotice={setNotice}
          />
        ))}
      </div>
      {totalCount > 0 && (
        <nav
          className="gallery-page__pagination"
          aria-label="Gallery pagination"
        >
          <button
            type="button"
            className="gallery-page__page-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <div className="gallery-page__page-numbers" aria-label="Page numbers">
            {pageNumbers.map((num) => (
              <button
                key={num}
                type="button"
                className={
                  num === page
                    ? "gallery-page__page-btn gallery-page__page-btn--number gallery-page__page-btn--active"
                    : "gallery-page__page-btn gallery-page__page-btn--number"
                }
                onClick={() => setPage(num)}
                aria-current={num === page ? "page" : undefined}
              >
                {num}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="gallery-page__page-btn"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
