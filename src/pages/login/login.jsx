import React, { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { hydrateUserFromStorage, loginUser } from "../loginSlice";
import "./login.css";
import { setBackButtonUrl } from "../uiSlice";
import Swal from "sweetalert2";
import { leaveToExtramile } from "../mobileAppBridge";

function Login() {
  const dispatch = useDispatch();
  const { status, user, error } = useSelector((state) => state.auth);
  const { status: themeStatus, data: themeData } = useSelector(
    (state) => state.theme
  );

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAdmin = searchParams.get("admin") === "true";

  useEffect(() => {
    dispatch(loginUser());
  }, [dispatch]);

  /** No ?fromMobileApp in URL: clear stale embedded flag in storage + Redux before this login resolves. */
  useEffect(() => {
    if (searchParams.get("fromMobileApp") !== null) return;
    try {
      const raw = localStorage.getItem("userData");
      if (!raw) return;
      const u = JSON.parse(raw);
      if (u.fromMobileApp !== true) return;
      const next = { ...u, fromMobileApp: false };
      localStorage.setItem("userData", JSON.stringify(next));
      dispatch(hydrateUserFromStorage());
    } catch {
      /* ignore */
    }
  }, [searchParams, dispatch]);

  useEffect(() => {
    if (status === "succeeded" && user && isAdmin) {
      navigate("/admin");
    }
  }, [status, user, isAdmin, navigate]);

  useEffect(() => {
    console.log("user",user);
    if (status === "succeeded" && user.backButtonRedirect) {
      dispatch(setBackButtonUrl(user.backButtonRedirect));
    }

  }, [status, user]);



 useEffect(() => {
  if (status !== "failed") return;
  const msg = error ? String(error) : "Session expired";
  const redirect = user && user.backButtonRedirect ? user.backButtonRedirect : "/";
  Swal.fire("Session Expired!", msg, "error").then(() => {
    leaveToExtramile(redirect, user);
  });
}, [status, error, user]);

// show "already played" modal when status is succeeded and userPlayedCount > 0
useEffect(() => {
  if (isAdmin) return;
  if (status !== "succeeded" || !user) return;
  if (Number(user.userPlayedCount) > 0) {
    const msg = error ? String(error) : "You have already played!";
    const redirect = user.backButtonRedirect || "/";
    Swal.fire("You have already played!", "  ", "error").then(() => {
      leaveToExtramile(redirect, user);
    });
  }
}, [status, user, error]);

  if (status === "loading" || themeStatus === "loading") {
    return (
      <div className="login-main-container">
        <div className="quiz-loader-container">
          <div className="quiz-loader"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-main-container">
      {themeData && (
        <img
          src={process.env.REACT_APP_S3_PATH + themeData.logo}
          className="login-logo"
          alt="Game Logo"
        />
      )}
        {user && status === "succeeded" && (
          <div>
            <Link
              to="/get-pairing"
              className="begin-play-btn"
              aria-label="Begin play"
              title="Begin play"
            />
          </div>
        )}
    </div>
  );
}

export default Login;
