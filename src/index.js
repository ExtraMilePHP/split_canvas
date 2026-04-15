// index.js or main file
import React, {useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import Login from './pages/login/login';
import AdminRedirect from './adminRedirect/admin';
import Admin from './admin/admin';
import Home from './admin/pages/home/home';
import Rules from './admin/pages/rules/rules';
import { Provider } from 'react-redux';
import { store } from './admin/store';
import LoginPage from './admin/pages/login/login';
import UserRules from './pages/rules/rules';
import GetPairing from './pages/getPairing/GetPairing';
import DrawPage from './pages/draw/DrawPage';
import WhoMostLikely from './pages/whoMostLikely/WhoMostLikely';
import WmlLeaderboardPage from './pages/whoMostLikely/WmlLeaderboardPage';
import Lifelines from './pages/lifelines/lifelines';
import QuizUI from './pages/quiz/quizUI';
import OfficeFunFeud from './pages/officeFunFeud/officeFunFeud';
import QuestionsTable from './admin/pages/questions/questions';
import ThankYou from './pages/thankyou/thankyou';
import Gallery from './pages/gallery/Gallery';
import USER from './pages/dddUI/user';
import QuizSettingsPage from './admin/pages/quizSettingPage/quizSettingsPage';


function usePageBackground() {
  const location = useLocation();
  useEffect(() => {
    const body = document.body;
    if (!location.pathname.startsWith("/admin")) {
      body.classList.add("common-bg");
    } else {
      body.classList.remove("common-bg");
    }
    const isWmlGame = location.pathname.startsWith("/who-most-likely");
    if (isWmlGame) {
      body.classList.add("wml-game");
    } else {
      body.classList.remove("wml-game");
    }
  }, [location]);
}


function App() {
  usePageBackground();

   return (
    <Provider store={store}>
      <Routes>
        {/* Admin routes (no DDDUI wrapper) */}
        <Route path="/admin">
          <Route index element={<Admin><Home /></Admin>} />
          <Route path="rules" element={<Admin><Rules /></Admin>} />
          <Route path="questions" element={<Admin><QuestionsTable/></Admin>} />
          <Route path="quiz-settings" element={<Admin><QuizSettingsPage/></Admin>} />
          <Route path="superadmin" element={<LoginPage/>} />
        </Route>

        {/* Public routes wrapped with DDDUI */}
        <Route path="*" element={
          <USER>
            <Routes>
              <Route index element={<Login />} />
              <Route path="/login" element={<Login />} />
              <Route path="/rules" element={<UserRules/>} />
              <Route path="/get-pairing" element={<GetPairing />} />
              <Route path="/draw" element={<DrawPage />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/gallary" element={<Gallery />} />
              <Route path="/who-most-likely" element={<WhoMostLikely />} />
              <Route path="/who-most-likely/leaderboard" element={<WmlLeaderboardPage />} />
              <Route path="/life" element={<Lifelines/>} />
              <Route path="/quiz" element={<QuizUI/>} />
              <Route path="/office-fun-feud" element={<OfficeFunFeud />} />
              <Route path="/AdminRedirect" element={<AdminRedirect />} />
              <Route path="/thankyou" element={<ThankYou/>} />
            </Routes>
          </USER>
        } />
      </Routes>
    </Provider>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

// Performance reporting
reportWebVitals();
