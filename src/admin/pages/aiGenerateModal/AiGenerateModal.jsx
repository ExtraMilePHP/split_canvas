import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import './AiGenerateModal.css';
import { updateAiQuestion } from '../../functions/updateAiQuestion';

export default function AiGenerateModal({ isOpen, onClose, currentTheme, token }) {
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [optionCount, setOptionCount] = useState("4"); // keep string for prompt format
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [questions, setQuestions] = useState([]);
  const [clearExisting, setClearExisting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const statusMessages = [
    "Analyzing topic details...",
    "Generating relevant questions...",
    "Verifying answer accuracy...",
    "Finalizing question set..."
  ];

  // Rotate status messages when loading
  useEffect(() => {
    let interval;
    if (loading) {
      let idx = 0;
      setStatusMessage(statusMessages[idx]);
      interval = setInterval(() => {
        idx = (idx + 1) % statusMessages.length;
        setStatusMessage(statusMessages[idx]);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      Swal.fire("", "Please enter a topic", "warning");
      return;
    }
    setLoading(true);
    setQuestions([]);
    setRetryCount(0);
    await callAIApi();
  };

  function extractJsonArray(rawResponse) {
    let cleaned = rawResponse
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .replace(/\\_/g, "_") // replace escaped underscores (markdown)
      .trim();

    // Try exact match first
    if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
      return cleaned;
    }

    // Fallback: try to extract the first valid JSON array using regex
    const arrayMatch = cleaned.match(/\[[\s\S]*?\]/);
    if (arrayMatch) {
      return arrayMatch[0];
    }

    // If nothing works, throw
    console.error("Failed to extract clean JSON array from:", rawResponse);
    throw new Error("Invalid JSON array format");
  }

  const callAIApi = async () => {
    const prompt =
      `Generate exactly ${questionCount} quiz questions about ${topic} in pure JSON array format. ` +
      `Each item must include these fields: question_name, option_one, option_two` +
      (optionCount == "4" ? `, option_three, option_four` : ``) + `, correct_answer (must exactly match one of the options, not letters like A/B/C/D Or random string), and answer_id (`+(optionCount=="4" ? `1-4` : `1 OR 2 ONLY`)+`, matching correct option). ` +
      `Respond with only the JSON array (no intro, no explanation). ` +
      `Format:\n[` +
      (optionCount == "4"
        ? `{\"question_name\":\"\",\"option_one\":\"\",\"option_two\":\"\",\"option_three\":\"\",\"option_four\":\"\",\"correct_answer\":\"\",\"answer_id\":1}`
        : `{\"question_name\":\"\",\"option_one\":\"\",\"option_two\":\"\",\"correct_answer\":\"\",\"answer_id\":1}`
      ) +
      `]`;

    try {
      console.log(`Prompt sent (Attempt ${retryCount + 1}):`, prompt);

      const response = await fetch('https://ai.extramileplay.com/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: "gemma3n",
          prompt,
          stream: false,
          images: []
        })
      });

      const data = await response.json();
      console.log("[Raw AI Response]:", data.response);

       let jsonString = extractJsonArray(data.response);
     

      const parsedQuestions = JSON.parse(jsonString);

      const validQuestions = parsedQuestions.filter(q =>
        q.question_name && q.option_one && q.option_two && q.correct_answer && q.answer_id
      );

      if (!validQuestions.length) {
        throw new Error("No valid questions generated");
      }

      setQuestions(validQuestions);
      setLoading(false);
    } catch (err) {
      console.warn(`AI Error (Attempt ${retryCount + 1}):`, err.message);

      if (retryCount < 1) {
        setRetryCount(prev => prev + 1);
        console.log("Retrying AI generation...");
        setTimeout(() => callAIApi(), 1500);
      } else {
        setLoading(false);
        Swal.fire("Error", err.message || "AI failed to generate questions", "error");
      }
    }
  };

  const handleModalClose = () => {
    setQuestions([]);
    setLoading(false);
    setRetryCount(0);
    setTopic("");
    setClearExisting(false);
    setStatusMessage("");
    onClose(); // parent-controlled modal visibility
  };

  const handleSave = async () => {
    if (!questions.length) {
      Swal.fire("Error", "No questions to save", "error");
      return;
    }

    // ✅ Close modal immediately
     handleModalClose();

    try {
      Swal.fire({
        title: 'Adding Questions',
        text: 'Please wait while we add the questions...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      await updateAiQuestion({
        questions,
        theme: currentTheme,
        token,
        clearExisting
      });

      Swal.fire("Success", `Added ${questions.length} questions successfully!`, "success")
        .then(() => {
          window.location.reload();
        });
    } catch (err) {
      Swal.fire("Error", err.message || "Failed to save questions", "error");
    }
  };

  const handleRegenerate = () => {
    setQuestions([]);
    setRetryCount(0);
    setLoading(true);
    callAIApi(); // ✅ reuse same topic, count, options
  };

  if (!isOpen) return null;

  return (
    <div className="ai-backdrop">
      <div className={`ai-modal ${questions.length > 0 ? "wide" : "compact"}`}>
        <h2 className="ai-title">Generate Questions with AI</h2>
        <button className="ai-close-btn" onClick={handleModalClose}>
          ✕
        </button>

        {!loading && questions.length === 0 && (
          <div className="ai-form">
            <label>Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="ai-input"
              placeholder="e.g., Solar System"
            />

            <label>Number of Questions</label>
            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="ai-input"
            >
              {[...Array(10)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>

            <label>Options per Question</label>
            <select
              value={optionCount}
              onChange={(e) => setOptionCount(e.target.value)}
              className="ai-input"
            >
              <option value="2">2</option>
              <option value="4">4</option>
            </select>

            <div className="generate-button-holder">
           <button className="ai-generate-btn" onClick={handleGenerate}>
              Generate
            </button>
            </div>
 
          </div>
        )}

        {loading && (
          <div className="ai-loading">
            <div className="ai-spinner"></div>
            <p>{statusMessage}</p>
          </div>
        )}

        {!loading && questions.length > 0 && (
          <div className="ai-preview">
            <h3>Preview</h3>
            <div className="ai-table">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Question</th>
                    <th>Option 1</th>
                    <th>Option 2</th>
                    {optionCount == "4" && <th>Option 3</th>}
                    {optionCount == "4" && <th>Option 4</th>}
                    <th>Correct</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{q.question_name}</td>
                      <td>{q.option_one}</td>
                      <td>{q.option_two}</td>
                      {optionCount == "4" && <td>{q.option_three || "-"}</td>}
                      {optionCount == "4" && <td>{q.option_four || "-"}</td>}
                      <td>
                        {q.answer_id === 1
                          ? q.option_one
                          : q.answer_id === 2
                          ? q.option_two
                          : q.answer_id === 3
                          ? q.option_three
                          : q.answer_id === 4
                          ? q.option_four
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="code" style={{ textAlign: "center" }}>
                * AI can make mistakes — always verify responses before relying
                on them.
              </div>
            </div>

            <div style={{ marginTop: "10px" }}>
              <label>
                <input
                  type="checkbox"
                  checked={clearExisting}
                  onChange={(e) => setClearExisting(e.target.checked)}
                />{" "}
                Clear existing questions before saving
              </label>
            </div>

            <div className="ai-actions">
              <button className="ai-regenerate-btn" onClick={handleRegenerate}>
                Regenerate
              </button>
              <button className="ai-save-btn" onClick={handleSave}>
                Save Questions
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
