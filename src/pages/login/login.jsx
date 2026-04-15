import React, { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { loginUser } from "../loginSlice";
import "./login.css";
import { setBackButtonUrl } from "../uiSlice";
import Swal from "sweetalert2";

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
    window.location.href = redirect;
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
      window.location.href = redirect;
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
              to="/rules"
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
