import React, { useCallback, useRef } from "react";

const DEFAULT_SIZE = 200;

/** Inner edge of hue ring, as fraction of outer radius (center to wheel edge). */
const RING_INNER_FRAC = 0.76;
/** Inner shade disc radius, as fraction of outer radius (matches inset (1-INNER)/2). */
const INNER_DISC_FRAC = 0.68;

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

/**
 * shade: 0 = top/white, 0.5 = pure hue, 1 = bottom/black
 * Returns { s, v } in [0,1] matching the vertical gradient.
 */
function shadeToHsv(shade) {
  if (shade <= 0.5) {
    return { s: shade * 2, v: 1 };
  }
  return { s: 1, v: (1 - shade) * 2 };
}

/**
 * Inverse: given current HSV, return the shade position (0–1).
 * v < 1  → lower (dim) branch: shade = 1 − v/2
 * v == 1 → upper (tint) branch: shade = s/2
 */
function hsvToShade(s, v) {
  return v < 1 ? 1 - v / 2 : s / 2;
}

function pointerToMetrics(el, clientX, clientY) {
  const rect = el.getBoundingClientRect();
  const side = Math.min(rect.width, rect.height);
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const dist = Math.hypot(dx, dy);
  const outerR = side / 2;
  const ringInnerR = RING_INNER_FRAC * outerR;
  const innerR = INNER_DISC_FRAC * outerR;
  return { dx, dy, dist, outerR, ringInnerR, innerR };
}

function innerIndicatorPct(s, v) {
  const shade = hsvToShade(clamp01(s), clamp01(v));
  return {
    innerDotX: 50,
    innerDotY: 50 + INNER_DISC_FRAC * 50 * (2 * shade - 1),
  };
}

export default function ColorWheel({ h, s, v, onChange, size = DEFAULT_SIZE }) {
  const wrapRef = useRef(null);
  const dragModeRef = useRef(null);

  const ringInnerPct = RING_INNER_FRAC * 100;
  const innerInsetPct = ((1 - INNER_DISC_FRAC) / 2) * 100;

  const updateHue = useCallback(
    (dx, dy) => {
      let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
      if (deg < 0) deg += 360;
      onChange({ h: deg });
    },
    [onChange]
  );

  const updateInnerShade = useCallback(
    (dy, innerR) => {
      const shade = clamp01((dy + innerR) / (2 * innerR));
      onChange(shadeToHsv(shade));
    },
    [onChange]
  );

  const handlePointer = useCallback(
    (clientX, clientY) => {
      const el = wrapRef.current;
      if (!el) return;
      const m = pointerToMetrics(el, clientX, clientY);

      const ringHit = m.dist >= m.ringInnerR && m.dist <= m.outerR * 1.03;
      const innerHit = m.dist <= m.innerR;

      const mode = dragModeRef.current;
      if (mode === "ring") {
        updateHue(m.dx, m.dy);
        return;
      }
      if (mode === "inner") {
        updateInnerShade(m.dy, m.innerR);
        return;
      }

      if (ringHit) {
        dragModeRef.current = "ring";
        updateHue(m.dx, m.dy);
      } else if (innerHit) {
        dragModeRef.current = "inner";
        updateInnerShade(m.dy, m.innerR);
      }
    },
    [updateHue, updateInnerShade]
  );

  const onPointerDown = (e) => {
    e.preventDefault();
    wrapRef.current?.setPointerCapture(e.pointerId);
    dragModeRef.current = null;
    handlePointer(e.clientX, e.clientY);
  };

  const onPointerMove = (e) => {
    if (!dragModeRef.current) return;
    handlePointer(e.clientX, e.clientY);
  };

  const onPointerUp = (e) => {
    dragModeRef.current = null;
    try {
      wrapRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const hueRad = (((h % 360) + 360) % 360) * (Math.PI / 180);
  const ringMidFrac = (RING_INNER_FRAC + 1) / 2;
  const ringDotX = 50 + ringMidFrac * 50 * Math.sin(hueRad);
  const ringDotY = 50 - ringMidFrac * 50 * Math.cos(hueRad);
  const { innerDotX, innerDotY } = innerIndicatorPct(s, v);

  return (
    <div
      ref={wrapRef}
      className="draw-color-wheel"
      style={{
        width: size,
        height: size,
        "--cw-hue": `${((h % 360) + 360) % 360}`,
        "--cw-ring-inner-pct": `${ringInnerPct}%`,
        "--cw-inner-inset-pct": `${innerInsetPct}%`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="presentation"
    >
      <div className="draw-color-wheel__ring" aria-hidden="true" />
      <div className="draw-color-wheel__inner" aria-hidden="true" />
      <span
        className="draw-color-wheel__dot draw-color-wheel__dot--ring"
        style={{ left: `${ringDotX}%`, top: `${ringDotY}%` }}
      />
      <span
        className="draw-color-wheel__dot draw-color-wheel__dot--inner"
        style={{ left: `${innerDotX}%`, top: `${innerDotY}%` }}
      />
    </div>
  );
}
