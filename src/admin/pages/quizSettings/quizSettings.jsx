import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { useDispatch, useSelector } from "react-redux";
import { selectAdminToken } from "../../sessionSlice";
import { fetchThemeData } from "../../themeSlice";
import "./quizSettings.css";
import { updateThemeData } from "../../functions/updateThemeData";
import WmlAvatarSettings from "../wmlAvatarSettings/WmlAvatarSettings";

export default function QuizSettings({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const adminToken = useSelector(selectAdminToken);
  const { currentTheme, data } = useSelector((state) => state.theme);

  const [correctPoints, setCorrectPoints] = useState(1);
  const [wmlQuestionTimerSeconds, setWmlQuestionTimerSeconds] = useState(0);

  useEffect(() => {
    if (!isOpen || !data) return;

    setCorrectPoints(data.correctPoints ?? 1);
    const t = parseInt(data.wmlQuestionTimerSeconds, 10);
    setWmlQuestionTimerSeconds(Number.isNaN(t) ? 0 : Math.max(0, t));
  }, [isOpen, data, currentTheme]);

  useEffect(() => {
    dispatch(fetchThemeData({ themeId: currentTheme }));
  }, [dispatch, currentTheme]);

  const handleSubmit = async () => {
    const n = parseInt(correctPoints, 10);
    const correctPointsToSend =
      Number.isNaN(n) || n < 1 ? 1 : n;
    const ts = parseInt(wmlQuestionTimerSeconds, 10);
    const timerSec = Number.isNaN(ts) ? 0 : Math.max(0, ts);
    const payload = {
      data: {
        correctPoints: correctPointsToSend,
        wmlQuestionTimerSeconds: String(timerSec),
      },
      currentTheme,
    };

    try {
      await updateThemeData({ payload, token: adminToken });
      Swal.fire("Success", "Settings saved!", "success");
      window.location.reload();
      onClose();
    } catch (e) {
      Swal.fire("Error", e.message || "Failed to save settings", "error");
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="quiz-settings-modal">
        <h2>Settings</h2>

        <div className="setting-row">
          <div className="setting-input">
            <label>Points per vote</label>
            <input
              type="number"
              min="1"
              value={correctPoints}
              onChange={(e) =>
                setCorrectPoints(parseInt(e.target.value, 10) || 1)
              }
            />
            <div className="code">WML: points for the round winner</div>
          </div>
          <div className="setting-input">
            <label>Question timer (seconds)</label>
            <input
              type="number"
              min="0"
              value={wmlQuestionTimerSeconds}
              onChange={(e) => {
                const x = parseInt(e.target.value, 10);
                setWmlQuestionTimerSeconds(
                  Number.isNaN(x) ? 0 : Math.max(0, x)
                );
              }}
            />
            <div className="code">0 = off. Countdown per question; auto show result at 0.</div>
          </div>
        </div>

        <div className="quiz-settings-modal__wml-avatars">
          <h3 className="quiz-settings-modal__wml-title">Characters</h3>
          <WmlAvatarSettings embedded />
        </div>

        <div className="actions">
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="save-btn" onClick={handleSubmit}>
            Save
          </button>
        </div>
      </div>
    </>
  );
}
