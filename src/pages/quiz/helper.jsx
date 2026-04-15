import React from "react";

export const Arrow = ({ side, color }) => (
  <div
    className={`quiz-arrow quiz-arrow--${side}`}
    style={
      side === "left"
        ? { borderLeftColor: color }
        : { borderRightColor: color }
    }
  />
);

export const ArrowBar = ({ total = 20, active = 0 }) => {
  const hueFor = (i) => Math.round((1 - i / (total - 1)) * 120);
  const mkArrows = (side) =>
    Array.from({ length: total }).map((_, i) => {
      const idx = side === "left" ? i : total - 1 - i;
      const isActive = side === "left" ? i >= total - active : i < active;
      const color = isActive ? `hsl(${hueFor(idx)},100%,50%)` : "transparent";
      return <Arrow key={`${side}-${i}`} side={side} color={color} />;
    });

  return (
    <div className="quiz-arrows-bar">
      <div className="quiz-arrows-bar__left">{mkArrows("left")}</div>
      <div className="quiz-arrows-bar__divider" />
      <div className="quiz-arrows-bar__right">{mkArrows("right")}</div>
    </div>
  );
};

export const VerticalProgress = ({ total = 10, current = 0 }) => {
  const pct = total > 0 ? (current / total) * 100 : 0;
  let finalpct= (pct<10) ?10 :pct;
  return (
    <div className="quiz-vertical-progress-carrier">
      <div className="quiz-vertical-progress">
        <div className="quiz-vertical-progress__total">{total}</div>
        <div className="quiz-vertical-progress__bar">
          <div
            className="quiz-vertical-progress__fill"
            style={{ height: `${finalpct}%` }}
          >
            <div
              className="quiz-vertical-progress__current"
              style={{ bottom: `${finalpct}%` }}
            >
              {current}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
