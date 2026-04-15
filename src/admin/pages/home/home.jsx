import React, { useState, useEffect } from "react";
import CreateTheme from "../createTheme/createTheme";
import { useDispatch, useSelector } from "react-redux";
import { fetchThemeData, selectTheme as setReduxCurrentTheme } from "../../themeSlice";
import { useNavigate } from "react-router-dom";

import Swal from "sweetalert2";
import "./home.css";

import { selectAdminToken, setSession } from "../../sessionSlice";
import UpdateThemeImages from "../updateThemeImage/updateThemeImage";

function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [themes, setThemes] = useState([]);
  const adminToken = useSelector(selectAdminToken);
  const navigate = useNavigate();

  const dispatch = useDispatch();
  const { availableThemes, currentTheme, status, data } = useSelector(
    (state) => state.theme
  );

  console.log(data);

  // Load initial data (admin selected theme)
  useEffect(() => {
    if (!isUpdateModalOpen) {
      dispatch(fetchThemeData({ isAdmin: true }));
    }
  }, [dispatch]);

  const handleThemePreview = (themeId) => {
    // Immediately show the theme without API call
    const theme = availableThemes.find((t) => t.id === themeId);
    dispatch(setReduxCurrentTheme(theme));

    // In background, fetch full theme data
    dispatch(fetchThemeData({ themeId, isAdmin: true }));
  };

  const browseTheme = async (themeName) => {
    console.log("selecting theme:", themeName);
    try {
      // wait until the server responds and state is updated
      await dispatch(fetchThemeData({ themeId: themeName })).unwrap();
      navigate("/admin/rules");
    } catch (err) {
      Swal.fire("Error loading theme", err.message, "error");
    }
  };

  const fetchAllThemes = () => {
    setThemes([]);
    fetch(process.env.REACT_APP_BACKEND_URL + "/fetchAllThemes", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`, // send it like a JWT for now
      },
      body: JSON.stringify({
        test: "test",
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
      .then((json) => {
        if (json.success) {
          console.log(json.data);
          setThemes(json.data);
        } else {
          console.error("API error:", json.message);
        }
      })
      .catch((err) => console.error("Fetch error:", err));
  };

useEffect(() => {
  if (adminToken) {
    fetchAllThemes();
  }
}, [adminToken]);

  const selectTheme = (themeName) => {
    fetch(`${process.env.REACT_APP_BACKEND_URL}/selectTheme`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        themeName,
      }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) {
          console.error("SelectTheme error:", json.message);
        } else {
          Swal.fire({
            title: "Theme Selected",
            text: "",
            icon: "success",
          });
          fetchAllThemes();
          dispatch(fetchThemeData({ isAdmin: true }));
        }
      })
      .catch((err) => console.error("SelectTheme fetch error:", err));
  };

  const deleteTheme = (themeName) => {
    Swal.fire({
      title: "Are you sure?",
      text: `Do you really want to delete the theme ?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "No, keep it",
    }).then((result) => {
      if (result.isConfirmed) {
        fetch(`${process.env.REACT_APP_BACKEND_URL}/deleteTheme`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ themeName }),
        })
          .then((res) => res.json())
          .then((json) => {
            if (!json.success) {
              console.error("deleteTheme error:", json.message);
              Swal.fire("Error", json.message, "error");
            } else {
              Swal.fire("Deleted!", `Theme has been deleted.`, "success").then(
                () => {
                  // refresh or update state
                  window.location.reload();
                }
              );
            }
          })
          .catch((err) => {
            console.error("deleteTheme fetch error:", err);
            Swal.fire("Error", "Network error, please try again.", "error");
          });
      }
      // else: user cancelled, do nothing
    });
  };

  const OpenUpdateModal = (themeName) => {
    console.log("dispatching current theme", themeName);
    dispatch(fetchThemeData({ themeId: themeName }));
    setIsUpdateModalOpen(true);
  };

  if (status === "loading") {
    return (
      <div className="load-theme-container">
        <div className="load-theme-spinner"></div>
        <p>Loading themes...</p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="load-theme-container">
        <p className="load-theme-error">❌ Error loading themes</p>
      </div>
    );
  }

  return (
    <>
      <CreateTheme isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <UpdateThemeImages
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
      />
      <div className="te-container">
        {/* LEFT SIDE (70%) */}
        <div className="te-left">
          <div className="te-image-wrapper">
            {data?.themename ? (
              <img
                src={process.env.REACT_APP_S3_PATH + `${data?.themeImage}`}
                className="te-main-image"
              />
            ) : (
              <>No Theme Found</>
            )}
          </div>

          <div className="te-info">
            <h2 className="te-name">{data?.themeName}</h2>
            <p className="te-desc">{data?.themeDescription}</p>
            {data?.themename ? (
              <div className="te-icons">
                <i
                  className="fa-solid fa-image te-icon"
                  title="Edit Image"
                  onClick={() => OpenUpdateModal(data.themename)}
                ></i>
                <i
                  className="fa-solid fa-gear te-icon"
                  title="Settings"
                  onClick={(e) => {
                    e.stopPropagation(); // ← prevent parent onClick
                    browseTheme(data.themename); // ← your settings action
                  }}
                ></i>
              </div>
            ) : (
              <></>
            )}
          </div>
        </div>

        {/* RIGHT SIDE (30%) */}
        <div className="te-right">
          <div className="te-select-header">
            <h3 className="te-select-title">Select Themes</h3>
            <button
              className="te-create-btn"
              onClick={() => setIsModalOpen(true)}
            >
              + Create Theme
            </button>
          </div>
          <div className="te-themes-list">
            {themes.map((theme) => (
              <div
                key={theme.id}
                className="te-theme-item"
                onClick={() => selectTheme(theme.themename)}
              >
                {/* Theme image */}
                <img
                  src={process.env.REACT_APP_S3_PATH + `${theme.themeImage}`}
                  alt={theme.themename}
                  className="te-theme-image"
                />

                {/* Tick icon when selected === "true" */}
                {theme.selected === "true" && (
                  <i
                    className="fa-solid fa-check te-selected-icon"
                    title="Selected"
                  />
                )}

                {/* Existing action icons */}
                <div className="te-icons">
                  <i
                    className="fa-solid fa-image te-icon"
                    title="Edit Image"
                    onClick={(e) => {
                      e.stopPropagation(); // ← prevent parent onClick
                      // setIsUpdateModalOpen(true);
                      OpenUpdateModal(theme.themename);
                    }}
                  ></i>
                  <i
                    className="fa-solid fa-gear te-icon"
                    title="Settings"
                    onClick={(e) => {
                      e.stopPropagation(); // ← prevent parent onClick
                      browseTheme(theme.themename); // ← your settings action
                    }}
                  />
                  <i
                    className="fa-solid fa-trash te-icon"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation(); // ← prevent parent onClick
                      deleteTheme(theme.themename); // ← your settings action
                    }}
                  ></i>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default Home;
