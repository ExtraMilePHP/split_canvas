import React,{ useEffect, useState } from "react";
import "./user.css";
import { useDispatch, useSelector } from 'react-redux';
import { fetchThemeData } from '../../admin/themeSlice';
import { useLocation } from "react-router-dom";

function USER({children }) {
  const dispatch = useDispatch();
    const location = useLocation();

    const {companyLogoUrl,backButtonUrl} = useSelector(state => state.ui);
    const [logoUrl,setLogoUrl]=useState("");
    const [backUrl,setBackUrl]=useState("");

    const { status, user, error } = useSelector(state => state.auth);
    const { status: themeStatus, data: themeData } = useSelector(state => state.theme);
 

  const applyCustomTheme = (theme) => {
  if (!theme) return;

  document.documentElement.style.setProperty('--text-color', theme.text_color);
  document.documentElement.style.setProperty('--ui-color-1', theme.ui_color_1);
  document.documentElement.style.setProperty('--ui-color-2', theme.ui_color_2);
  document.documentElement.style.setProperty('--option-color', theme.option_color);
  document.documentElement.style.setProperty('--option-text-color', theme.option_text_color);
};
    
  useEffect(() => {
      if (!/^\/login(?:\/)?$/.test(location.pathname)) {
        console.log("only /login");
        if (themeStatus === "idle") {
          dispatch(fetchThemeData({ themeId: null }));
        }
      }
  }, [themeStatus, dispatch]);

  useEffect(()=>{
    console.log(backButtonUrl);
    console.log(companyLogoUrl);
    setBackUrl(backButtonUrl);
    setLogoUrl(companyLogoUrl);
  },[backButtonUrl,companyLogoUrl])


  useEffect(() => {
    if (themeStatus !== "succeeded" || !themeData) return;

    applyCustomTheme(themeData.colors);

    // WhoMostLikely / leaderboard set their own body background; don't overwrite when theme loads async.
    if (/^\/who-most-likely(?:\/leaderboard)?\/?$/.test(location.pathname)) {
      return;
    }

    const body = document.body;

    const bg =
      window.innerWidth <= 768 ? themeData.background_mob : themeData.background_desk;
      console.log("setting up bg",bg);
    if (body.classList.contains("common-bg")) {
      body.style.backgroundImage = `url(${process.env.REACT_APP_S3_PATH + bg})`;
    }
  }, [themeStatus, themeData, location.pathname]);


  return (
    <>
      <header className="upperaction">
      <a href={process.env.REACT_APP_BASE_URL}><img src={logoUrl} className="logo-holder" /></a>
        <div className="back-holder">
       <a href={backUrl}><button className="back-default">Back</button></a> 
        </div>
       
      </header>
      {children}
    </>
  );
}

export default USER;
