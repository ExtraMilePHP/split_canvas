import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Swal from "sweetalert2";
import "./rules.css";
import { fetchThemeData } from "../../themeSlice";
import { processQuestions } from "../../questionSlice";
import { selectAdminToken } from "../../sessionSlice";
import { useNavigate } from "react-router-dom";
import { updateThemeData } from "../../functions/updateThemeData";

const DEFAULT_COLORS = {
  text_color: "#000000",
  ui_color_1: "#222222",
  ui_color_2: "#222222",
  option_color: "#ff9900",
  option_text_color: "#ffffff",
};

const Rules = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const adminToken = useSelector(selectAdminToken);
  const { currentTheme, data } = useSelector((state) => state.theme);

  const [rules, setRules] = useState([""]);

  useEffect(() => {
    dispatch(processQuestions());
    dispatch(fetchThemeData({ themeId: currentTheme }));
  }, [dispatch, currentTheme]);

  useEffect(() => {
    if (!data) return;
    setRules(data.rules || [""]);
  }, [data]);

  const handleRuleChange = (idx, val) => {
    let newVal = val;
    if (val.length > 100) {
      Swal.fire(
        "Limit Exceeded",
        "Rules can be at most 100 characters. extra text has been trimmed.",
        "warning"
      );
      newVal = val.slice(0, 100);
    }
    const arr = [...rules];
    arr[idx] = newVal;
    setRules(arr);
  };

  const handleAddRule = () => {
    if (rules.length >= 6) {
      return Swal.fire(
        "Limit Reached",
        "You can only add up to 6 rules.",
        "warning"
      );
    }
    setRules([...rules, ""]);
  };

  const handleRemoveRule = (idx) => {
    if (rules.length <= 1) {
      return Swal.fire(
        "At Least One Rule Required",
        "You must have at least one rule.",
        "warning"
      );
    }
    setRules(rules.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    const colorsFromTheme =
      data?.colors && typeof data.colors === "object"
        ? { ...DEFAULT_COLORS, ...data.colors }
        : { ...DEFAULT_COLORS };

    const payload = {
      data: {
        rules: rules.filter((r) => r.trim() !== ""),
        main_title: data?.main_title ?? "",
        landing_page_title: data?.landing_page_title ?? "",
        custom_text_thank_you_page: data?.custom_text_thank_you_page ?? "",
        colors: colorsFromTheme,
      },
      currentTheme,
    };

    try {
      await updateThemeData({ payload, token: adminToken });
      setTimeout(() => navigate("/admin/questions"), 500);
    } catch (e) {
      Swal.fire(
        "Error",
        e.message || "Failed to save. Please try again.",
        "error"
      );
    }
  };

  return (
    <>
      <div className="back-button-holder">
        <button
          className="back-button"
          onClick={() => navigate("/admin/")}
        >
          <i className="fa-solid fa-arrow-left"></i> Back
        </button>
      </div>
      <div className="rules-page-new">
        <div className="blue-tabs-container">
          <div className="blue-tabs blue-tabs-active"></div>
          <div className="blue-tabs"></div>
          <div className="blue-tabs"></div>
        </div>

        <div className="admin-tabs-holder">
          <div className="admin-tab-container">
            <div className="admin-tab-title">
              <i className="fa-solid fa-trophy"></i> &nbsp; Game Rules
            </div>
            <h3 className="custom-rules-title">Custom rules</h3>
            {rules.map((rule, i) => (
              <div className="rule-row" key={i}>
                <span className="rule-number">{i + 1}.</span>
                <input
                  className="rule-input"
                  type="text"
                  placeholder="Enter rule"
                  value={rule}
                  onChange={(e) => handleRuleChange(i, e.target.value)}
                />
                <button
                  className="remove-btn"
                  onClick={() => handleRemoveRule(i)}
                >
                  &times;
                </button>
              </div>
            ))}
            <div className="rules-button-container">
              <div>
                <button className="add-btn" onClick={handleAddRule}>
                  + Add New Rule
                </button>
              </div>
              <div className="code">
                * Keep 6 rules at the most. <br></br>* At least 1 rule is
                required.<br></br>* character limit of each rule is 100<br></br>
              </div>
            </div>
          </div>

          <div className="rules-action-holder">
            <button className="save-and-continue" onClick={handleSubmit}>
              Save & Continue
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Rules;
