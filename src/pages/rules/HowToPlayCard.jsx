import React from "react";
import nextButtonAsset from "../../img/assets/next-button.png";
import "./howToPlayCard.css";

/** Rule lines: use "Title: body" so title renders bold yellow; otherwise whole line is body text. */
function splitRule(line) {
  const s = String(line || "").trim();
  const i = s.indexOf(":");
  if (i <= 0 || i === s.length - 1) {
    return { title: null, body: s };
  }
  return {
    title: s.slice(0, i).trim(),
    body: s.slice(i + 1).trim(),
  };
}

export default function HowToPlayCard({ rules = [], onNext, disabled = false }) {
  const list = Array.isArray(rules) ? rules : [];

  return (
    <>
      <h2 className="how-to-play__heading">How to play</h2>
      <div className="how-to-play">
        <div className="how-to-play__card">
          <ul className="how-to-play__list font-fira">
            {list.map((rule, index) => {
              const { title, body } = splitRule(rule);
              return (
                <li key={index} className="how-to-play__item">
                  <span className="how-to-play__star" aria-hidden="true">
                    ★
                  </span>
                  <div className="how-to-play__rule-text">
                    {title ? (
                      <>
                        <strong className="how-to-play__rule-title">{title}:</strong>{" "}
                        <span className="how-to-play__rule-body">{body}</span>
                      </>
                    ) : (
                      <span className="how-to-play__rule-body">{body}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="how-to-play__footer">
          <button
            type="button"
            className="how-to-play__next"
            onClick={onNext}
            disabled={disabled}
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
      </div>
    </>
  );
}
