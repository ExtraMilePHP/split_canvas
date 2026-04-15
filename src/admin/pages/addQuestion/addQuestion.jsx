import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { useSelector } from "react-redux";
import { selectAdminToken } from "../../sessionSlice";
import "./qu-add-question-modal.css";

export default function AddQuestionModal({ isOpen, onClose, questionId }) {
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const adminToken = useSelector(selectAdminToken);
  const { currentTheme } = useSelector((state) => state.theme);

  function fixEncoding(value) {
    return value;
  }

  useEffect(() => {
    if (!isOpen) return;
    if (questionId) {
      setLoading(true);
      fetch(`${process.env.REACT_APP_BACKEND_URL}/getQuestionById`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ id: questionId }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.question) {
            setQuestion(data.question.question_name || "");
          } else {
            Swal.fire("Error", "Failed to fetch question", "error");
            onClose();
          }
        })
        .catch(() => {
          Swal.fire("Error", "Failed to fetch question", "error");
          onClose();
        })
        .finally(() => setLoading(false));
    } else {
      setQuestion("");
    }
  }, [isOpen, questionId, adminToken, onClose]);

  const handleQuestionChange = (val) => {
    let newVal = val;
    if (val.length > 300) {
      Swal.fire(
        "Limit Exceeded",
        "Question can be at most 300 characters; extra text has been trimmed.",
        "warning"
      );
      newVal = val.slice(0, 300);
    }
    setQuestion(newVal);
  };

  const handleSubmit = async () => {
    if (!question.trim()) {
      Swal.fire("Error", "Question is required", "error");
      return;
    }

    const formData = new FormData();
    formData.append("question", question);
    formData.append("minimal", "true");
    formData.append("currentTheme", currentTheme);
    if (questionId) formData.append("id", questionId);

    try {
      const res = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/addNewQuestion`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
          body: formData,
        }
      );
      if (!res.ok) throw new Error("Request failed");
      Swal.fire(
        "Success",
        questionId ? "Question updated" : "Question added",
        "success"
      );
      window.location.reload();
      onClose();
    } catch (err) {
      Swal.fire("Error", "Failed to save question", "error");
    }
  };

  if (!isOpen) return null;
  return (
    <>
      <div className="qu-modal-backdrop" onClick={onClose} />
      <div className="qu-modal">
        <h2>
          {loading
            ? "Loading..."
            : questionId
            ? "Edit Question"
            : "Add New Question"}
        </h2>

        {!loading && (
          <>
            <div className="qu-form-group">
              <label>Prompt (Who&apos;s Most Likely)</label>
              <input
                type="text"
                value={fixEncoding(question)}
                onChange={(e) => handleQuestionChange(e.target.value)}
                placeholder="Enter prompt text"
                disabled={loading}
              />
              <div className="code">* Max length 300 characters.</div>
            </div>
            <div className="qu-actions">
              <button
                className="qu-cancel-btn"
                disabled={loading}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="qu-save-btn"
                disabled={loading}
                onClick={handleSubmit}
              >
                {questionId ? "Update" : "Save Question"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
