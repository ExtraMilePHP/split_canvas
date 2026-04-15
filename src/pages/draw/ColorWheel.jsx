import React, { useCallback, useRef } from "react";

const DEFAULT_SIZE = 200;
const RING_GAP_REF = 4;

/**
 * @param {{ h: number, s: number, v: number }} hsv
 * @param {(next: { h: number, s: number, v: number }) => void} onChange
 * @param {number} [size]
 */
export default function ColorWheel({ h, s, v, onChange, size = DEFAULT_SIZE }) {
  const wrapRef = useRef(null);
  const draggingRef = useRef(null);

  const outerRRef = size / 2;
  const innerDiskRRef = outerRRef * 0.52;
  const ringInnerRRef = innerDiskRRef + RING_GAP_REF;

  const handlePointer = useCallback(
    (clientX, clientY) => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const side = Math.min(rect.width, rect.height);
      const outerR = side / 2;
      const innerDiskR = outerR * 0.52;
      const scale = side / size;
      const ringInnerR = innerDiskR + RING_GAP_REF * scale;
      const ringOuterSlop = 2 * scale;

      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy);

      if (dist <= innerDiskR) {
        const inner = el.querySelector(".draw-color-wheel__inner");
        if (!inner) return;
        const ir = inner.getBoundingClientRect();
        let u = (clientX - ir.left) / ir.width;
        let vv = 1 - (clientY - ir.top) / ir.height;
        u = Math.max(0, Math.min(1, u));
        vv = Math.max(0, Math.min(1, vv));
        onChange({ h, s: u, v: vv });
        return;
      }

      if (dist >= ringInnerR && dist <= outerR + ringOuterSlop) {
        let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
        if (deg < 0) deg += 360;
        onChange({ h: deg, s, v });
      }
    },
    [h, s, v, onChange, size]
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

  const innerDotLeft = s * 100;
  const innerDotTop = (1 - v) * 100;

  const innerPx = innerDiskRRef * 2;
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
      <div className="draw-color-wheel__ring" aria-hidden="true" />
      <div
        className="draw-color-wheel__inner"
        style={{ width: innerPx, height: innerPx }}
        aria-hidden="true"
      >
        <div
          className="draw-color-wheel__inner-visual"
          style={{
            background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h}, 100%, 50%))`,
          }}
        />
        <span
          className="draw-color-wheel__dot draw-color-wheel__dot--inner"
          style={{ left: `${innerDotLeft}%`, top: `${innerDotTop}%` }}
        />
      </div>
      <span
        className="draw-color-wheel__dot draw-color-wheel__dot--ring"
        style={{ left: `${ringDotX}%`, top: `${ringDotY}%` }}
      />
    </div>
  );
}
