import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useLocation } from "react-router-dom";
import { setBackButtonUrl } from "../uiSlice";
import { selectAdminToken } from "../../admin/sessionSlice";
import {
  getSplitCanvasPair,
  uploadSplitCanvasDrawing,
} from "../../functions/splitCanvasApi";
import part2Img from "../../img/assets/part-2.png";
import brushIcon from "../../img/assets/brush.png";
import eraserIcon from "../../img/assets/eraser.png";
import pencilIcon from "../../img/assets/pencil.png";
import ColorWheel from "./ColorWheel";
import { hsvToHex } from "./colorUtils";
import "./drawPage.css";

const SPLIT_CTX_KEY = "split_canvas_ctx_v1";

function s3PublicUrl(filename) {
  if (!filename) return "";
  const base = process.env.REACT_APP_S3_PATH || "";
  return base.endsWith("/") ? `${base}${filename}` : `${base}/${filename}`;
}

function parseSplitSets(themeData) {
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
const MAX_HISTORY = 50;
const PENCIL_THICKNESS_MAX = 8;
const BRUSH_THICKNESS_MAX = 24;
const TARGET_CANVAS = 450;
const MIN_CANVAS = 48;

function formatTime(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function strokeWidthForTool(tool, pencilThickness, brushThickness) {
  if (tool === "pencil") return pencilThickness;
  if (tool === "eraser" || tool === "brush") return brushThickness;
  return brushThickness;
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    m.addEventListener("change", onChange);
    setMatches(m.matches);
    return () => m.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export default function DrawPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const token = useSelector(selectAdminToken);
  const { user } = useSelector((s) => s.auth);
  const themeData = useSelector((s) => s.theme.data);

  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const imgRef = useRef(null);
  const submitOnceRef = useRef(false);
  const [baseSize, setBaseSize] = useState(null);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [mobileHighlightDone, setMobileHighlightDone] = useState(false);

  const [splitCtx, setSplitCtx] = useState(null);
  const [pairBlocked, setPairBlocked] = useState(false);
  const [ctxError, setCtxError] = useState(null);
  const [baseImageUrl, setBaseImageUrl] = useState(part2Img);
  const [submitting, setSubmitting] = useState(false);

  const timerEnabled = useMemo(() => {
    const t = parseInt(themeData?.wmlQuestionTimerSeconds, 10);
    return Number.isFinite(t) && t > 0;
  }, [themeData]);

  const [secondsLeft, setSecondsLeft] = useState(0);
  const [tool, setTool] = useState("brush");
  const [hsv, setHsvState] = useState({ h: 0, s: 0, v: 0 });
  const { h, s, v } = hsv;
  const [pencilThickness, setPencilThickness] = useState(3);
  const [brushThickness, setBrushThickness] = useState(8);
  const [ready, setReady] = useState(false);

  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const drawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });

  const color = useMemo(() => hsvToHex(h, s, v), [h, s, v]);

  const setHsv = useCallback((next) => {
    setHsvState((prev) => ({ ...prev, ...next }));
  }, []);

  const onMobileAwareColorChange = useCallback(
    (patch) => {
      setHsv(patch);
      if (isMobile) setMobileHighlightDone(true);
    },
    [setHsv, isMobile]
  );

  const closeMobileTools = useCallback(() => {
    setMobileToolsOpen(false);
    setMobileHighlightDone(false);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobileToolsOpen(false);
      setMobileHighlightDone(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (mobileToolsOpen) setMobileHighlightDone(false);
  }, [mobileToolsOpen]);

  useEffect(() => {
    dispatch(setBackButtonUrl("/get-pairing"));
  }, [dispatch]);

  useEffect(() => {
    if (!themeData) return;
    const t = parseInt(themeData.wmlQuestionTimerSeconds, 10);
    const sec = Number.isNaN(t) ? 0 : Math.max(0, t);
    if (sec > 0) setSecondsLeft(sec);
  }, [themeData]);

  useEffect(() => {
    let raw = location.state;
    if (!raw) {
      try {
        const s = sessionStorage.getItem(SPLIT_CTX_KEY);
        if (s) raw = JSON.parse(s);
      } catch {
        raw = null;
      }
    }
    if (!raw?.pairId || !raw?.side || raw.setIndex == null || !raw?.themeName) {
      setCtxError("missing_context");
      return;
    }
    setSplitCtx({
      pairId: raw.pairId,
      side: raw.side,
      setIndex: Number(raw.setIndex),
      themeName: String(raw.themeName),
    });
  }, [location.state]);

  useEffect(() => {
    if (!splitCtx || !token || !user?.userId) return;
    let cancelled = false;
    (async () => {
      try {
        const { pair } = await getSplitCanvasPair(token, splitCtx.pairId);
        if (cancelled || !pair) return;
        const uid = String(user.userId);
        const mine =
          splitCtx.side === "left"
            ? pair.left_submitted_at
            : pair.right_submitted_at;
        if (mine) {
          setPairBlocked(true);
          navigate("/gallery", { replace: true });
        }
      } catch (e) {
        console.warn("[draw] pair check", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [splitCtx, token, user, navigate]);

  useEffect(() => {
    if (!splitCtx || !themeData) return;
    const sets = parseSplitSets(themeData);
    const row = sets[splitCtx.setIndex];
    if (!row) {
      setCtxError("no_image_set");
      return;
    }
    const key = splitCtx.side === "left" ? row.left : row.right;
    if (!key) {
      setCtxError("no_side_image");
      return;
    }
    setBaseImageUrl(s3PublicUrl(key));
  }, [splitCtx, themeData]);

  useEffect(() => {
    if (!timerEnabled) return undefined;
    if (secondsLeft <= 0) return undefined;
    const id = window.setTimeout(() => {
      setSecondsLeft((t) => (t <= 1 ? 0 : t - 1));
    }, 1000);
    return () => clearTimeout(id);
  }, [timerEnabled, secondsLeft]);

  const buildCompositeBlob = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img?.complete) return Promise.reject(new Error("not ready"));
    return new Promise((resolve, reject) => {
      const w = canvas.width;
      const h = canvas.height;
      const out = document.createElement("canvas");
      out.width = w;
      out.height = h;
      const ctx = out.getContext("2d");
      if (!ctx) {
        reject(new Error("no ctx"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      ctx.drawImage(canvas, 0, 0);
      out.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("blob"));
        },
        "image/png",
        0.92
      );
    });
  }, []);

  const handleSubmitDrawing = useCallback(async () => {
    if (!splitCtx || !token || !user?.userId || submitting || pairBlocked)
      return;
    if (submitOnceRef.current) return;
    submitOnceRef.current = true;
    setSubmitting(true);
    try {
      const blob = await buildCompositeBlob();
      const fd = new FormData();
      fd.append("file", blob, `draw-${splitCtx.pairId}-${splitCtx.side}.png`);
      fd.append("pairId", String(splitCtx.pairId));
      fd.append("side", splitCtx.side);
      fd.append("userId", String(user.userId));
      await uploadSplitCanvasDrawing(token, fd);
      navigate("/gallery", { replace: true });
    } catch (e) {
      console.error(e);
      submitOnceRef.current = false;
      alert(e.message || "Save failed");
    } finally {
      setSubmitting(false);
    }
  }, [
    splitCtx,
    token,
    user,
    submitting,
    pairBlocked,
    buildCompositeBlob,
    navigate,
  ]);

  const submitFnRef = useRef(handleSubmitDrawing);
  submitFnRef.current = handleSubmitDrawing;

  useEffect(() => {
    if (!timerEnabled || !splitCtx || pairBlocked) return;
    if (secondsLeft !== 0) return;
    if (!ready) return;
    submitFnRef.current();
  }, [secondsLeft, timerEnabled, splitCtx, pairBlocked, ready]);

  const [historyUi, setHistoryUi] = useState(0);

  const commitState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    const snap = ctx.getImageData(0, 0, width, height);
    const idx = historyIndexRef.current;
    const hist = historyRef.current;
    let next = [...hist.slice(0, idx + 1), snap];
    while (next.length > MAX_HISTORY) {
      next.shift();
    }
    historyRef.current = next;
    historyIndexRef.current = next.length - 1;
    setHistoryUi((n) => n + 1);
  }, []);

  const restoreHistoryIndex = useCallback((i) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const snap = historyRef.current[i];
    if (!snap) return;
    ctx.putImageData(snap, 0, 0);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    restoreHistoryIndex(historyIndexRef.current);
    setHistoryUi((n) => n + 1);
  }, [restoreHistoryIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    restoreHistoryIndex(historyIndexRef.current);
    setHistoryUi((n) => n + 1);
  }, [restoreHistoryIndex]);

  const layoutCanvasSquare = useCallback(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!wrap || !canvas || !img?.complete || !img.naturalWidth) return;
    const style = getComputedStyle(wrap);
    const pl = parseFloat(style.paddingLeft) || 0;
    const pr = parseFloat(style.paddingRight) || 0;
    const pt = parseFloat(style.paddingTop) || 0;
    const pb = parseFloat(style.paddingBottom) || 0;
    const contentW = wrap.clientWidth - pl - pr;
    const contentH = wrap.clientHeight - pt - pb;
    let raw = Math.min(contentW, contentH);
    if (raw <= 0) {
      if (contentW > 0) raw = contentW;
      else if (contentH > 0) raw = contentH;
      else return;
    }
    const size = Math.round(
      Math.min(
        TARGET_CANVAS,
        Math.max(MIN_CANVAS, raw > 0 ? raw : TARGET_CANVAS)
      )
    );
    if (canvas.width === size && canvas.height === size) return;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, size, size);
    historyRef.current = [ctx.getImageData(0, 0, size, size)];
    historyIndexRef.current = 0;
    setHistoryUi((n) => n + 1);
    setBaseSize({ cw: size, ch: size });
  }, []);

  const handleBaseImgLoad = useCallback(
    (e) => {
      const img = e.currentTarget;
      imgRef.current = img;
      const wrap = wrapRef.current;
      if (!wrap || !img.naturalWidth) return;
      const run = () => {
        layoutCanvasSquare();
        setReady(true);
      };
      if (wrap.clientWidth === 0) {
        requestAnimationFrame(run);
        return;
      }
      run();
    },
    [layoutCanvasSquare]
  );

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      layoutCanvasSquare();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [layoutCanvasSquare]);

  const canvasCoords = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const handlePointerDown = useCallback(
    (e) => {
      if (!ready) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);

      const { x, y } = canvasCoords(e);

      drawingRef.current = true;
      lastPointRef.current = { x, y };

      const w = strokeWidthForTool(tool, pencilThickness, brushThickness);
      const ctx = canvas.getContext("2d");
      ctx.save();
      if (tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.fillStyle = "rgba(0,0,0,1)";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
      }
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
    },
    [ready, tool, color, canvasCoords, pencilThickness, brushThickness]
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (!drawingRef.current || !ready) return;
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { x, y } = canvasCoords(e);
      const w = strokeWidthForTool(tool, pencilThickness, brushThickness);
      const ctx = canvas.getContext("2d");
      const last = lastPointRef.current;
      ctx.save();
      if (tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
      }
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
      lastPointRef.current = { x, y };
    },
    [ready, tool, color, canvasCoords, pencilThickness, brushThickness]
  );

  const endStroke = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.globalCompositeOperation = "source-over";
    commitState();
  }, [commitState]);

  const handlePointerUp = useCallback(
    (e) => {
      endStroke();
      try {
        canvasRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [endStroke]
  );

  const handlePointerLeave = useCallback(() => {
    endStroke();
  }, [endStroke]);

  const undoDisabled = useMemo(
    () => historyIndexRef.current <= 0,
    [historyUi]
  );
  const redoDisabled = useMemo(
    () => historyIndexRef.current >= historyRef.current.length - 1,
    [historyUi]
  );

  const usePencilThicknessRange = tool === "pencil";
  const thicknessValue = usePencilThicknessRange
    ? pencilThickness
    : brushThickness;
  const thicknessMax = usePencilThicknessRange
    ? PENCIL_THICKNESS_MAX
    : BRUSH_THICKNESS_MAX;

  const onThicknessChange = (n) => {
    if (usePencilThicknessRange) {
      setPencilThickness(
        Math.min(PENCIL_THICKNESS_MAX, Math.max(1, Math.round(n)))
      );
    } else {
      setBrushThickness(
        Math.min(BRUSH_THICKNESS_MAX, Math.max(1, Math.round(n)))
      );
    }
  };

  const showToolbar = !isMobile || mobileToolsOpen;

  if (ctxError === "missing_context") {
    return (
      <div className="draw-page draw-page--center-msg">
        <p className="draw-page__msg">Start from pairing to draw.</p>
        <button
          type="button"
          className="draw-page__msg-btn"
          onClick={() => navigate("/get-pairing")}
        >
          Go to pairing
        </button>
      </div>
    );
  }

  if (!splitCtx) {
    return (
      <div className="draw-page draw-page--center-msg">
        <p className="draw-page__msg">Loading…</p>
      </div>
    );
  }

  if (ctxError === "no_image_set" || ctxError === "no_side_image") {
    return (
      <div className="draw-page draw-page--center-msg">
        <p className="draw-page__msg">
          No split image is configured for this slot.
        </p>
        <button
          type="button"
          className="draw-page__msg-btn"
          onClick={() => navigate("/get-pairing")}
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="draw-page">
      <div className="draw-page__timer" aria-live="polite">
        <span className="draw-page__timer-label">Timer</span>
        <span className="draw-page__timer-value">
          {timerEnabled ? formatTime(secondsLeft) : "—"}
        </span>
      </div>

      {isMobile && mobileToolsOpen && (
        <button
          type="button"
          className="draw-page__backdrop"
          aria-label="Close tools"
          onClick={closeMobileTools}
        />
      )}

      <div className="draw-page__frame">
        {showToolbar && (
          <aside
            className={`draw-page__toolbar${
              isMobile ? " draw-page__toolbar--sheet" : ""
            }`}
            aria-label="Drawing tools"
          >
            {isMobile && (
              <div className="draw-page__sheet-header">
                <span className="draw-page__sheet-title">Tools</span>
                <button
                  type="button"
                  className={`draw-page__sheet-done${
                    mobileHighlightDone
                      ? " draw-page__sheet-done--highlight"
                      : ""
                  }`}
                  onClick={closeMobileTools}
                >
                  Done
                </button>
              </div>
            )}
            <div className="draw-page__toolbar-top">
              <button
                type="button"
                className="draw-page__pill draw-page__pill--undo"
                onClick={handleUndo}
                disabled={undoDisabled || submitting}
              >
                undo
              </button>
              <button
                type="button"
                className="draw-page__pill draw-page__pill--redo"
                onClick={handleRedo}
                disabled={redoDisabled || submitting}
              >
                redo
              </button>
              <button
                type="button"
                className="draw-page__pill draw-page__pill--save"
                onClick={handleSubmitDrawing}
                disabled={!ready || submitting || pairBlocked}
              >
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>

            <div className="draw-page__wheel-area">
              <div className="draw-page__wheel-row">
                <div className="draw-page__wheel-stack">
                  <ColorWheel
                    h={h}
                    s={s}
                    v={v}
                    onChange={onMobileAwareColorChange}
                    size={176}
                  />
                  <span
                    className="draw-page__color-swatch"
                    style={{ backgroundColor: color }}
                    title={color}
                    aria-label={`Current brush color ${color}`}
                  />
                </div>
                <div
                  className="draw-page__tool-icons"
                  role="toolbar"
                  aria-label="Tools"
                >
                  <button
                    type="button"
                    className={`draw-page__tool-icon${
                      tool === "eraser" ? " draw-page__tool-icon--active" : ""
                    }`}
                    aria-pressed={tool === "eraser"}
                    onClick={() => {
                      setTool("eraser");
                      if (isMobile) setMobileHighlightDone(true);
                    }}
                    aria-label="Eraser"
                  >
                    <img src={eraserIcon} alt="" />
                  </button>
                  <button
                    type="button"
                    className={`draw-page__tool-icon${
                      tool === "pencil" ? " draw-page__tool-icon--active" : ""
                    }`}
                    aria-pressed={tool === "pencil"}
                    onClick={() => {
                      setTool("pencil");
                      if (isMobile) setMobileHighlightDone(true);
                    }}
                    aria-label="Pencil"
                  >
                    <img src={pencilIcon} alt="" />
                  </button>
                  <button
                    type="button"
                    className={`draw-page__tool-icon${
                      tool === "brush" ? " draw-page__tool-icon--active" : ""
                    }`}
                    aria-pressed={tool === "brush"}
                    onClick={() => {
                      setTool("brush");
                      if (isMobile) setMobileHighlightDone(true);
                    }}
                    aria-label="Brush"
                  >
                    <img src={brushIcon} alt="" />
                  </button>
                </div>
              </div>
            </div>

            <div className="draw-page__thickness">
              <span className="draw-page__thickness-label">
                {thicknessValue}px
              </span>
              <input
                type="range"
                className="draw-page__range draw-page__range--compact"
                min={1}
                max={thicknessMax}
                value={thicknessValue}
                onChange={(e) => {
                  onThicknessChange(Number(e.target.value));
                  if (isMobile) setMobileHighlightDone(true);
                }}
                aria-label={
                  usePencilThicknessRange
                    ? "Pencil thickness"
                    : "Brush and eraser thickness"
                }
              />
            </div>
          </aside>
        )}

        <div className="draw-page__canvas-wrap" ref={wrapRef}>
          {isMobile && !mobileToolsOpen && (
            <button
              type="button"
              className="draw-page__edit-fab"
              onClick={() => setMobileToolsOpen(true)}
              aria-label="Edit colors and tools"
            >
              <svg
                className="draw-page__edit-fab-icon"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.41l-2.34-2.34a1.003 1.003 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                />
              </svg>
            </button>
          )}
          <div className="draw-page__canvas-stack">
            {/* crossOrigin + S3 CORS (GET) for this app origin keeps the canvas exportable (toBlob). */}
            <img
              ref={imgRef}
              key={baseImageUrl}
              src={baseImageUrl}
              crossOrigin="anonymous"
              alt=""
              draggable={false}
              className="draw-page__base-img"
              onLoad={handleBaseImgLoad}
              style={
                baseSize
                  ? {
                      width: baseSize.cw,
                      height: baseSize.ch,
                      objectFit: "contain",
                    }
                  : undefined
              }
            />
            <canvas
              ref={canvasRef}
              className="draw-page__canvas draw-page__canvas--overlay"
              style={
                baseSize
                  ? { width: baseSize.cw, height: baseSize.ch }
                  : { width: 0, height: 0 }
              }
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handlePointerLeave}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
