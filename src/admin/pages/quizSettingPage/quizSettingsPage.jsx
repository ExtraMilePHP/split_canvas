import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Swal from "sweetalert2";
import "./quizSettingsPage.css";
import { fetchThemeData } from "../../themeSlice";
import { selectAdminToken } from "../../sessionSlice";
import { useNavigate } from "react-router-dom";
import { updateThemeData } from "../../functions/updateThemeData";

const QuizSettingsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const adminToken = useSelector(selectAdminToken);
  const { currentTheme, data: themeData } = useSelector((state) => state.theme);

  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!themeData) return;
    const t = parseInt(themeData.wmlQuestionTimerSeconds, 10);
    const total = Number.isNaN(t) ? 0 : Math.max(0, t);
    setMinutes(Math.floor(total / 60));
    setSeconds(total % 60);
  }, [themeData, currentTheme]);

  useEffect(() => {
    dispatch(fetchThemeData({ themeId: currentTheme }));
  }, [dispatch, currentTheme]);

  const handleSubmit = async () => {
    const m = Math.max(0, parseInt(minutes, 10) || 0);
    let s = Math.max(0, parseInt(seconds, 10) || 0);
    if (s > 59) {
      Swal.fire("Invalid seconds", "Use 0–59 for seconds.", "warning");
      return;
    }
    const totalSec = m * 60 + s;

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
              <div className="form-group-v1">
                <label>Minutes</label>
                <input
                  type="number"
                  min="0"
                  value={minutes}
                  onChange={(e) =>
                    setMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))
                  }
                />
              </div>
              <div className="form-group-v1">
                <label>Seconds (0–59)</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={seconds}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    setSeconds(Number.isNaN(n) ? 0 : Math.min(59, Math.max(0, n)));
                  }}
                />
              </div>
            </div>
            <div className="code">
              Total: {Math.max(0, (parseInt(minutes, 10) || 0) * 60 + (parseInt(seconds, 10) || 0))}{" "}
              seconds. Use 0 minutes and 0 seconds to disable countdown.
            </div>
          </div>

          <div className="rules-action-holder">
            <button type="button" className="save-and-continue" onClick={handleSubmit}>
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default QuizSettingsPage;
