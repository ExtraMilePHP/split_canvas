// rules.jsx
import React, { useEffect, useState } from 'react';
import './rules.css';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { initQuestions } from '../../functions/setUserQuestions';
import { selectAdminToken } from '../../admin/sessionSlice';
import { processQuestions } from '../../admin/questionSlice';
import { setBackButtonUrl } from '../uiSlice';
import IntroModal from '../introModal/introModal';
import HowToPlayCard from "./HowToPlayCard";


function UserRules() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { status: themeStatus, data: themeData } = useSelector(
    (state) => state.theme
  );
  const { status, user, error } = useSelector((state) => state.auth);
  const [showIntroModal, setShowIntroModal] = useState(false);
  const adminToken = useSelector(selectAdminToken);
  const [isLoading, setIsLoading] = useState(false);
  
  console.log(themeData);

  useEffect(() => {
    if (!themeData || !user || !adminToken) return;

    setIsLoading(true);
    
    dispatch(processQuestions())
      .unwrap()                               // unwraps the thunk's payload or throws
      .then(() => {
        return initQuestions({
          userId: user.userId,
          email: user.email,
          fullName: user.name,
          themeName: themeData.themename,
          token: adminToken
        });
      })
      .then(data => {
        console.log('Init response:', data);
        // e.g. store insertId or show first question…
      })
      .catch(err => {
        console.error('Error in process→init chain:', err);
      });
  }, [themeData, user, adminToken]);

  useEffect(() => {
    dispatch(setBackButtonUrl("/login?&save=true"));
  }, [status, user]);

const goToNextRoute = () => {
  navigate("/get-pairing");
};

const handleIntroComplete = () => {
  setShowIntroModal(false);
  goToNextRoute();
};


  const handleCloseIntroModal = () => {
    setShowIntroModal(false);
  };

  const handleNextClick = (e) => {
    e.preventDefault();
    
    // If lifelines is false AND intro is enabled, show intro modal first
    if (!themeData.lifelines && themeData?.intro && themeData?.introFile) {
      setShowIntroModal(true);
      return;
    }
    
    goToNextRoute();
  };

  if (!isLoading) {
  return (
      <div className='quiz-loader-container'>
       <div className="quiz-loader"></div>
      </div>
  );
}

  return (
    <>
      <div className="user-rules-page">
        <HowToPlayCard
          rules={themeData?.rules || []}
          onNext={handleNextClick}
        />
      </div>

      {/* Intro Modal */}
      <IntroModal
        isOpen={showIntroModal}
        onClose={handleCloseIntroModal}
        onComplete={handleIntroComplete}
        introFile={themeData?.introFile}
      />
    </>
  )
}

export default UserRules;