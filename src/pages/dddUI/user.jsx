import React, { useEffect, useState } from "react";
import "./user.css";
import { useDispatch, useSelector } from "react-redux";
import { fetchThemeData } from "../../admin/themeSlice";
import { useLocation } from "react-router-dom";
import { leaveToExtramile } from "../mobileAppBridge";

function USER({ children }) {
  const dispatch = useDispatch();
  const location = useLocation();

  const user = useSelector((state) => state.auth.user);
  const fromMobileApp = user?.fromMobileApp === true;

  const { companyLogoUrl, backButtonUrl } = useSelector((state) => state.ui);
  const [logoUrl, setLogoUrl] = useState("");
  const [backUrl, setBackUrl] = useState("");

  const { status: themeStatus, data: themeData } = useSelector(
    (state) => state.theme
  );

  const applyCustomTheme = (theme) => {
    if (!theme) return;

    document.documentElement.style.setProperty("--text-color", theme.text_color);
    document.documentElement.style.setProperty("--ui-color-1", theme.ui_color_1);
    document.documentElement.style.setProperty("--ui-color-2", theme.ui_color_2);
    document.documentElement.style.setProperty("--option-color", theme.option_color);
    document.documentElement.style.setProperty(
      "--option-text-color",
      theme.option_text_color
    );
  };

  useEffect(() => {
    if (!/^\/login(?:\/)?$/.test(location.pathname)) {
      console.log("only /login");
      if (themeStatus === "idle") {
        dispatch(fetchThemeData({ themeId: null }));
      }
    }
  }, [themeStatus, dispatch, location.pathname]);

  useEffect(() => {
    console.log(backButtonUrl);
    console.log(companyLogoUrl);
    setBackUrl(backButtonUrl);
    setLogoUrl(companyLogoUrl);
  }, [backButtonUrl, companyLogoUrl]);

  useEffect(() => {
    if (themeStatus !== "succeeded" || !themeData) return;

    applyCustomTheme(themeData.colors);

    if (/^\/who-most-likely(?:\/leaderboard)?\/?$/.test(location.pathname)) {
      return;
    }

    const body = document.body;

    const bg =
      window.innerWidth <= 768
        ? themeData.background_mob
        : themeData.background_desk;
    console.log("setting up bg", bg);
    if (body.classList.contains("common-bg")) {
      body.style.backgroundImage = `url(${process.env.REACT_APP_S3_PATH + bg})`;
    }
  }, [themeStatus, themeData, location.pathname]);

  const isLoginPath = /^\/(?:login)?\/?$/.test(location.pathname);

  const basePublicUrl = process.env.REACT_APP_BASE_URL || "";

  const onLogoNavigate = (e) => {
    if (!basePublicUrl) return;
    e.preventDefault();
    leaveToExtramile(basePublicUrl, user);
  };

  const onBackNavigate = (e) => {
    if (!backUrl) return;
    e.preventDefault();
    leaveToExtramile(backUrl, user);
  };

  return (
    <>
      <header className="upperaction">
        <a
          href={basePublicUrl || "#"}
          className="logo-holder-link"
          onClick={onLogoNavigate}
        >
          <img src={logoUrl} className="logo-holder" alt="" />
        </a>
        {!fromMobileApp && (
          <div className="back-holder">
            <a href={backUrl || "#"} onClick={onBackNavigate}>
              <button type="button" className="back-default">
                Back
              </button>
            </a>
          </div>
        )}
      </header>
      <main className={isLoginPath ? undefined : "font-anti-gravity"}>{children}</main>
    </>
  );
}

export default USER;
