import React, { useState } from "react";
import Swal from "sweetalert2";
import ConfirmModal from "./ConfirmModal";

export function Lifelines({
  lifelinesState,
  flipQuestion,
  currentQuestion,
  answerFeedback,
  onFlipUsed,
  onExpertUsed,
  onDoubleDipUsed,
  onFiftyUsed,
  themeData
}) {
  const {
    lifelines,
    flip,
    expert,
    double: doubleDip,
    fifty_fifty: fiftyFifty
  } = themeData;
  
  
  const [modal, setModal] = useState(null);

  // If lifelines feature is turned off entirely, render nothing
  if (!lifelines) return null;

  const useFlip = () => {
    if (!flipQuestion || lifelinesState[0] || answerFeedback) return;
    setModal({
      title: "Use Flip?",
      text: "Swap this question with your reserved one.",
      confirmText: "Yes, flip it",
      showCancel: true,
      icon: "lifelines/flip.png",
      onConfirm: () => {
        onFlipUsed();
        setModal(null);
      },
      onCancel: () => setModal(null)
    });
  };

const useExpert = () => {
  if (lifelinesState[1] || answerFeedback) return;
  const hint = currentQuestion.options[currentQuestion.answer_id - 1];
  setModal({
    title: "Use Expert Advice?",
    text: "You will see a hint to the correct answer.",
    confirmText: "Yes, show me",
    showCancel: true,
    icon: "lifelines/expert-advice.png",
    onConfirm: () => {
      // show hint modal
      setModal({
        title: "Expert says:",
        text: hint,
        confirmText: "OK",
        showCancel: false,
        onConfirm: () => {
          onExpertUsed();
          setModal(null);
        }
      });
    },
    onCancel: () => setModal(null)
  });
};

const useDoubleDip = () => {
  if (lifelinesState[2] || answerFeedback) return;
  setModal({
    title: "Use Double Dip?",
    text: "Pick two options instead of one.",
    confirmText: "Yes, allow two picks",
    showCancel: true,
    icon: "lifelines/double-dip.png",
    onConfirm: () => {
      onDoubleDipUsed();
      setModal(null);
    },
    onCancel: () => setModal(null)
  });
};

 const useFifty = () => {
  if (lifelinesState[3] || answerFeedback) return;
  setModal({
    title: "Use 50-50?",
    text: "Two wrong answers will be removed.",
    confirmText: "Yes, 50-50 it",
    showCancel: true,
    icon: "lifelines/50.png",
    onConfirm: () => {
      const correct = currentQuestion.answer_id;
      const options = currentQuestion.options.map((_, i) => i + 1);
      const wrongs = options.filter((i) => i !== correct);
      const toRemove = wrongs.sort(() => Math.random() - 0.5).slice(0, 2);
      onFiftyUsed(toRemove);
      setModal(null);
    },
    onCancel: () => setModal(null)
  });
};

  // Define each lifeline with its availability flag and handler
  const lifelineConfigs = [
    { enabled: flip,      handler: useFlip,     used: lifelinesState[0], icon: "flip", text:"flip" },
    { enabled: expert,    handler: useExpert,   used: lifelinesState[1], icon: "expert-advice", text:"expert advice" },
    { enabled: doubleDip, handler: useDoubleDip, used: lifelinesState[2], icon: "double-dip", text:"double dip" },
    { enabled: fiftyFifty,handler: useFifty,    used: lifelinesState[3], icon: "50",text:"50:50" },
  ];

  

  return (
    <div className="quiz-lifelines">
      <div className="quiz-lifelines-title">LIFELINES</div>
      <div className="quiz-question-lifelines-container">
  {lifelineConfigs
        .filter(l => l.enabled)
        .map((l, i) => (
           <div
            className="quiz-lifelines-holder"
           >
           <div
            key={i}
            disabled={l.used === 1 || Boolean(answerFeedback)}
            onClick={l.handler}
          >
            <img
              src={`lifelines/${l.icon}.png`}
              alt={`${l.icon} lifeline`}
              className={l.used ? "quiz-lifeline--used" : "quiz-lifeline"}
            />
           </div>
           <div className="quiz-lifeline-text">{l.text}</div>
           </div>
          
        
        ))
      }
      </div>
    
    <ConfirmModal
  isOpen={!!modal}
  title={modal?.title}
  text={modal?.text}
  confirmText={modal?.confirmText}
  cancelText={modal?.cancelText}
  showCancel={modal?.showCancel ?? true}
  icon={modal?.icon}
  onConfirm={modal?.onConfirm}
  onCancel={modal?.onCancel}
/>
    </div>
  );
}
