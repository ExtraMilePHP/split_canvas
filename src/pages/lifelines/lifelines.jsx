// lifelines.jsx (updated)
import React, { useEffect, useState } from "react";
import "./lifelines.css";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { setBackButtonUrl } from "../uiSlice";
import IntroModal from "../introModal/introModal";

function Lifelines() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { status: themeStatus, data: themeData } = useSelector(
    (state) => state.theme
  );
  
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [canProceedToQuiz, setCanProceedToQuiz] = useState(false);

  useEffect(() => {
    dispatch(setBackButtonUrl("/get-pairing"));
    
    console.log(themeData);
    // Check if intro should be shown
    if (themeData?.intro && themeData?.introFile) {
      setShowIntroModal(true);
      setCanProceedToQuiz(false);
    } else {
      // If no intro is enabled or no file, allow immediate access to quiz
      setCanProceedToQuiz(true);
    }
  }, [themeData]);

  const handleIntroComplete = () => {
    setCanProceedToQuiz(true);
  };

  const handleCloseIntroModal = () => {
    setShowIntroModal(false);
    // If user closes without completing, still allow access
    // (you can change this behavior if needed)
    setCanProceedToQuiz(true);
  };

  const handleNextClick = (e) => {
    if (!canProceedToQuiz) {
      e.preventDefault();
      return;
    }
    navigate("/office-fun-feud", { state: { fromRules: true } });
  };

  return (
    <>
      <div className="lifelines-text">LIFELINES</div>
      <div className="lifelines-container">
        <div
          className="life-container"
          style={!themeData?.flip ? { display: "none" } : {}}
        >
          <img src="lifelines/flip.png" />
          <div className="lifeline-tab-text">Flip</div>
          <div className="lifeline-description">Switch the question to get new one</div>
        </div>

        <div
          className="life-container"
          style={!themeData?.expert ? { display: "none" } : {}}
        >
          <img src="lifelines/expert-advice.png" alt="Expert Advice" />
           <div className="lifeline-tab-text">Expert Advice</div>
          <div className="lifeline-description">
            Let computer ji get right answer for you
          </div>
        </div>

        <div
          className="life-container"
          style={!themeData?.double ? { display: "none" } : {}}
        >
          <img src="lifelines/double-dip.png" alt="Double Dip" />
           <div className="lifeline-tab-text">Double Dip</div>
          <div className="lifeline-description">
            Not sure if your answer is correct? Choose 2 responses
          </div>
        </div>
        
        <div
          className="life-container"
          style={!themeData?.fifty_fifty ? { display: "none" } : {}}
        >
          <img src="lifelines/50.png" alt="50/50" />
            <div className="lifeline-tab-text">50/50</div>
          <div className="lifeline-description">
            Remove two incorrect answers to help you choose
          </div>
        </div>
      </div>


      <div className="next-lifeline-button-container">
        <button 
          className={`next-button ${!canProceedToQuiz ? 'disabled' : ''}`}
          onClick={handleNextClick}
          disabled={!canProceedToQuiz}
        >
          {canProceedToQuiz ? 'Next' : 'Complete Introduction First'}
        </button>
      </div>


      {/* Intro Modal */}
      <IntroModal
        isOpen={showIntroModal}
        onClose={handleCloseIntroModal}
        onComplete={handleIntroComplete}
        introFile={themeData?.introFile}
      />
    </>
  );
}

export default Lifelines;