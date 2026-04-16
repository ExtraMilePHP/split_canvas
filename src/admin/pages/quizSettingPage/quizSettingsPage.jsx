import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Swal from "sweetalert2";
import "./quizSettingsPage.css";
import { fetchThemeData } from "../../themeSlice";
import { selectAdminToken } from "../../sessionSlice";
import { useNavigate } from "react-router-dom";
import { updateThemeData } from "../../functions/updateThemeData";

const MIN_TIMER_SECONDS = 10;
const MAX_TIMER_SECONDS = 10 * 60;

function clampTimer(totalSec) {
  return Math.min(MAX_TIMER_SECONDS, Math.max(MIN_TIMER_SECONDS, totalSec));
}

function formatTimer(totalSec) {
  const safe = clampTimer(
    Number.isFinite(totalSec) ? totalSec : MIN_TIMER_SECONDS
  );
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function parseTimer(text) {
  const match = String(text || "").trim().match(/^(\d{1,2})\s*:\s*(\d{1,2})$/);
  if (!match) return null;
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  if (seconds < 0 || seconds > 59) return null;
  return minutes * 60 + seconds;
}

const QuizSettingsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const adminToken = useSelector(selectAdminToken);
  const { currentTheme, data: themeData } = useSelector((state) => state.theme);

  const [timerText, setTimerText] = useState(formatTimer(MIN_TIMER_SECONDS));

  useEffect(() => {
    if (!themeData) return;
    const t = parseInt(themeData.wmlQuestionTimerSeconds, 10);
    const total = Number.isNaN(t) ? MIN_TIMER_SECONDS : clampTimer(t);
    setTimerText(formatTimer(total));
  }, [themeData, currentTheme]);

  useEffect(() => {
    dispatch(fetchThemeData({ themeId: currentTheme }));
  }, [dispatch, currentTheme]);

  const handleSubmit = async () => {
    const totalSec = parseTimer(timerText);
    if (totalSec == null) {
      Swal.fire("Invalid time", "Use mm:ss format (example: 02:30).", "warning");
      return;
    }
    if (totalSec < MIN_TIMER_SECONDS || totalSec > MAX_TIMER_SECONDS) {
      Swal.fire("Invalid range", "Timer must be between 00:10 and 10:00.", "warning");
      return;
    }

    const payload = {
      data: {
        wmlQuestionTimerSeconds: String(totalSec),
      },
      currentTheme,
    };

    try {
      await updateThemeData({ payload, token: adminToken });
      Swal.fire("Success", "Settings saved!", "success");
      navigate("/admin/questions");
    } catch (e) {
      Swal.fire("Error", e.message || "Failed to save settings", "error");
    }
  };

  return (
    <>
      <div className="back-button-holder">
        <button
          type="button"
          className="back-button"
          onClick={() => navigate("/admin/questions")}
        >
          <i className="fa-solid fa-arrow-left" /> Back
        </button>
      </div>
      <div className="rules-page-new">
        <div className="blue-tabs-container">
          <div className="blue-tabs" />
          <div className="blue-tabs" />
          <div className="blue-tabs blue-tabs-active" />
        </div>

        <div className="admin-tabs-holder-v2">
          <div className="tabs-main-title">Settings</div>
          <div className="admin-tab-container">
            <div className="admin-tab-title">
              <i className="fa-solid fa-clock" /> Question timer
            </div>
            <div className="timer-fields-row">
              <div className="form-group-v1 timer-single-field">
                <label>Timer (mm:ss)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={timerText}
                  placeholder="00:10"
                  onChange={(e) => setTimerText(e.target.value)}
                  onBlur={() => {
                    const parsed = parseTimer(timerText);
                    if (parsed == null) return;
                    setTimerText(formatTimer(parsed));
                  }}
                />
              </div>
            </div>
            <div className="code">Allowed range: 00:10 to 10:00.</div>
          </div>

          <div className="rules-action-holder">
            <button
              type="button"
              className="save-and-continue"
              onClick={handleSubmit}
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default QuizSettingsPage;
