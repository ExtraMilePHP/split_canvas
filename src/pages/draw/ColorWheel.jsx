import React, { useCallback, useMemo, useRef } from "react";

const DEFAULT_SIZE = 200;
const RING_GAP_REF = 4;

/** Top of wheel (deg from atan2(dx,-dy)); must match conic gradient white wedge. */
const WHITE_SECTOR_CENTER_DEG = 0;
/** Half angular width of the white chip on the outer ring (total span = 2 × this). */
const WHITE_SECTOR_HALF_WIDTH_DEG = 9;

const RING_W_START =
  (WHITE_SECTOR_CENTER_DEG - WHITE_SECTOR_HALF_WIDTH_DEG + 360) % 360;
const RING_W_END =
  (WHITE_SECTOR_CENTER_DEG + WHITE_SECTOR_HALF_WIDTH_DEG + 360) % 360;

/** Inner radius of the hue ring (hole). Matches mask: outerR * 0.52 + gap. */
function ringHoleRadiusPx(side, designSize) {
  const outerR = side / 2;
  const scale = side / designSize;
  return outerR * 0.52 + RING_GAP_REF * scale;
}

/**
 * True if deg (0–360, same convention as atan2(dx,-dy)) lies in the white sector.
 */
function angleInWhiteSector(deg) {
  const c = WHITE_SECTOR_CENTER_DEG;
  const hw = WHITE_SECTOR_HALF_WIDTH_DEG;
  let a = deg - c;
  a = ((a + 540) % 360) - 180;
  return Math.abs(a) <= hw;
}

/**
 * Conic stops aligned with {@link angleInWhiteSector}: white from RING_W_START to RING_W_END clockwise.
 * Built in JS so hit-testing and pixels stay in sync.
 */
function hueRingConicGradient() {
  const wEnd = RING_W_END;
  const wStart = RING_W_START;
  return `conic-gradient(
    hsl(0, 100%, 50%) ${wEnd}deg,
    hsl(60, 100%, 50%) ${wEnd + 60}deg,
    hsl(120, 100%, 50%) ${wEnd + 120}deg,
    hsl(180, 100%, 50%) ${wEnd + 180}deg,
    hsl(240, 100%, 50%) ${wEnd + 240}deg,
    hsl(300, 100%, 50%) ${wEnd + 300}deg,
    hsl(330, 100%, 50%) 330deg,
    #fff ${wStart}deg,
    #fff 360deg
  )`;
}

/**
 * Hue on outer ring; dedicated white sector on the ring (not the center hole).
 *
 * @param {{ h: number, onChange: (next: { h?: number, s?: number, v?: number }) => void, size?: number }} props
 */
export default function ColorWheel({ h, onChange, size = DEFAULT_SIZE }) {
  const wrapRef = useRef(null);
  const draggingRef = useRef(null);

  const ringBackground = useMemo(() => hueRingConicGradient(), []);

  const outerRRef = size / 2;
  const ringInnerRRef = ringHoleRadiusPx(size, size);

  const handlePointer = useCallback(
    (clientX, clientY) => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const side = Math.min(rect.width, rect.height);
      const outerR = side / 2;
      const ringInnerR = ringHoleRadiusPx(side, size);
      const scale = side / size;
      const ringOuterSlop = 4 * scale;

      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy);

      if (dist >= ringInnerR && dist <= outerR + ringOuterSlop) {
        let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
        if (deg < 0) deg += 360;

        if (angleInWhiteSector(deg)) {
          onChange({
            h: WHITE_SECTOR_CENTER_DEG,
            s: 0,
            v: 1,
          });
          return;
        }

        onChange({ h: deg, s: 1, v: 1 });
      }
    },
    [onChange, size]
  );

  const onPointerDown = (e) => {
    e.preventDefault();
    wrapRef.current?.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    handlePointer(e.clientX, e.clientY);
  };

  const onPointerMove = (e) => {
    if (!draggingRef.current) return;
    handlePointer(e.clientX, e.clientY);
  };

  const onPointerUp = (e) => {
    draggingRef.current = false;
    try {
      wrapRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const hueRad = (h * Math.PI) / 180;
  const ringMidR = (ringInnerRRef + outerRRef) / 2;
  const ringDotX = 50 + (ringMidR / outerRRef) * 50 * Math.sin(hueRad);
  const ringDotY = 50 - (ringMidR / outerRRef) * 50 * Math.cos(hueRad);

  const maskInnerPx = size * 0.26;

  return (
    <div
      ref={wrapRef}
      className="draw-color-wheel"
      style={{
        width: size,
        height: size,
        "--cw-mask-inner": `${maskInnerPx}px`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="presentation"
    >
      <div
        className="draw-color-wheel__ring"
        style={{ background: ringBackground }}
        aria-hidden="true"
      />
      <span
        className="draw-color-wheel__dot draw-color-wheel__dot--ring"
        style={{ left: `${ringDotX}%`, top: `${ringDotY}%` }}
      />
    </div>
  );
}
