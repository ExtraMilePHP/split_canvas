import React, { useEffect, useState, useCallback } from "react";
import Swal from "sweetalert2";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { selectAdminToken } from "../../sessionSlice";
import { fetchThemeData } from "../../themeSlice";
import { updateThemeData } from "../../functions/updateThemeData";
import { uploadSplitCanvasImageFile } from "../../functions/splitImageSetsApi";
import "../rules/rules.css";
import "./QuestionsTable.css";

const MAX_SETS = 10;
const REQUIRED_IMAGE_SIZE = 450;
const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png"];
const ALLOWED_FILE_EXTENSIONS = [".jpg", ".jpeg", ".png"];

function s3Url(filename) {
  if (!filename) return "";
  const base = process.env.REACT_APP_S3_PATH || "";
  return `${base}${filename}`;
}

const QuestionsTable = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const token = useSelector(selectAdminToken);
  const currentTheme = useSelector((state) => state.theme.currentTheme);
  const themeData = useSelector((state) => state.theme.data);

  const [sets, setSets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [leftFile, setLeftFile] = useState(null);
  const [rightFile, setRightFile] = useState(null);

  const getImageSize = (file) =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        URL.revokeObjectURL(url);
        resolve({ w, h });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read image dimensions"));
      };
      img.src = url;
    });

  useEffect(() => {
    if (!currentTheme || !token) return;
    dispatch(fetchThemeData({ themeId: currentTheme, isAdmin: true }));
  }, [dispatch, currentTheme, token]);

  useEffect(() => {
    const raw = themeData?.splitImageSets;
    if (Array.isArray(raw)) {
      setSets(
        raw.map((r) => ({
          left: r?.left || "",
          right: r?.right || "",
        }))
      );
    } else {
      setSets([]);
    }
  }, [themeData, currentTheme]);

  const persistSets = useCallback(
    async (nextSets) => {
      if (!currentTheme || !token) return;
      setSaving(true);
      try {
        await updateThemeData({
          payload: {
            data: { splitImageSets: nextSets },
            currentTheme,
          },
          token,
        });
        setSets(nextSets);
        await dispatch(fetchThemeData({ themeId: currentTheme, isAdmin: true })).unwrap();
        Swal.fire("Saved", "Image sets updated.", "success");
      } catch (e) {
        Swal.fire("Error", e.message || "Save failed", "error");
      } finally {
        setSaving(false);
      }
    },
    [currentTheme, token, dispatch]
  );

  const saveAndContinue = () => {
    navigate("/admin/quiz-settings");
  };

  const addPair = async () => {
    if (sets.length >= MAX_SETS) {
      Swal.fire("Limit", `Maximum ${MAX_SETS} image sets per theme.`, "info");
      return;
    }
    if (!leftFile || !rightFile) {
      Swal.fire("Select files", "Choose both a left and a right image.", "warning");
      return;
    }
    const leftType = (leftFile.type || "").toLowerCase();
    const rightType = (rightFile.type || "").toLowerCase();
    if (
      !ALLOWED_FILE_TYPES.includes(leftType) ||
      !ALLOWED_FILE_TYPES.includes(rightType)
    ) {
      Swal.fire(
        "Invalid file type",
        "Only JPG/JPEG and PNG files are allowed for both left and right images.",
        "warning"
      );
      return;
    }
    try {
      setSaving(true);
      const [leftSize, rightSize] = await Promise.all([
        getImageSize(leftFile),
        getImageSize(rightFile),
      ]);
      if (
        leftSize.w !== REQUIRED_IMAGE_SIZE ||
        leftSize.h !== REQUIRED_IMAGE_SIZE
      ) {
        throw new Error(
          `Left image must be exactly ${REQUIRED_IMAGE_SIZE}x${REQUIRED_IMAGE_SIZE}px (selected: ${leftSize.w}x${leftSize.h})`
        );
      }
      if (
        rightSize.w !== REQUIRED_IMAGE_SIZE ||
        rightSize.h !== REQUIRED_IMAGE_SIZE
      ) {
        throw new Error(
          `Right image must be exactly ${REQUIRED_IMAGE_SIZE}x${REQUIRED_IMAGE_SIZE}px (selected: ${rightSize.w}x${rightSize.h})`
        );
      }
      const leftName = await uploadSplitCanvasImageFile(leftFile, token);
      const rightName = await uploadSplitCanvasImageFile(rightFile, token);
      const next = [...sets, { left: leftName, right: rightName }];
      setLeftFile(null);
      setRightFile(null);
      await persistSets(next);
    } catch (e) {
      Swal.fire("Upload failed", e.message || "Error", "error");
    } finally {
      setSaving(false);
    }
  };

  const removeSet = (index) => {
    Swal.fire({
      title: "Remove this set?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Remove",
    }).then((result) => {
      if (!result.isConfirmed) return;
      const next = sets.filter((_, i) => i !== index);
      persistSets(next);
    });
  };

  return (
    <>
      <div className="back-button-holder">
        <button
          type="button"
          className="back-button"
          onClick={() => navigate("/admin/rules")}
        >
          <i className="fa-solid fa-arrow-left" /> Back
        </button>
      </div>

      <div className="rules-page-new">
        <div className="blue-tabs-container">
          <div className="blue-tabs" />
          <div className="blue-tabs blue-tabs-active" />
          <div className="blue-tabs" />
        </div>

        <div className="admin-tabs-holder">
          <div className="rules-action-holder split-questions-action-top">
            <button
              type="button"
              className="save-and-continue"
              onClick={saveAndContinue}
            >
              Continue to Settings
            </button>
          </div>

          <div className="admin-tab-container">
            <div className="admin-tab-title">
              <i className="fa-solid fa-images" /> &nbsp; Split image sets
            </div>
            <p className="split-sets-helper">
              Up to {MAX_SETS} sets (left + right image per set). Same theme for
              all. Each image must be exactly {REQUIRED_IMAGE_SIZE}x
              {REQUIRED_IMAGE_SIZE}px. Allowed files: JPG, JPEG, PNG.
            </p>

            <div className="split-sets-add">
              <div className="split-sets-field">
                <label htmlFor="split-left-file">Left image</label>
                <input
                  id="split-left-file"
                  className="split-sets-file-input"
                  type="file"
                  accept={ALLOWED_FILE_EXTENSIONS.join(",")}
                  onChange={(e) => setLeftFile(e.target.files?.[0] || null)}
                />
              </div>
              <div className="split-sets-field">
                <label htmlFor="split-right-file">Right image</label>
                <input
                  id="split-right-file"
                  className="split-sets-file-input"
                  type="file"
                  accept={ALLOWED_FILE_EXTENSIONS.join(",")}
                  onChange={(e) => setRightFile(e.target.files?.[0] || null)}
                />
              </div>
              <button
                type="button"
                className="add-new-question-v1"
                disabled={saving || sets.length >= MAX_SETS}
                onClick={addPair}
              >
                {saving ? "Working…" : "Add set"}
              </button>
            </div>

            <div className="split-sets-table-wrap">
              <table className="split-sets-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Left</th>
                    <th>Right</th>
                    <th className="split-sets-col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sets.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="split-sets-empty-cell">
                        No image sets yet. Upload a left and right image above.
                      </td>
                    </tr>
                  ) : (
                    sets.map((row, i) => (
                      <tr key={`${row.left}-${row.right}-${i}`}>
                        <td>{i + 1}</td>
                        <td>
                          {row.left ? (
                            <img
                              className="split-sets-thumb"
                              src={s3Url(row.left)}
                              alt=""
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {row.right ? (
                            <img
                              className="split-sets-thumb"
                              src={s3Url(row.right)}
                              alt=""
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="split-sets-col-actions">
                          <button
                            type="button"
                            className="delete-btn"
                            onClick={() => removeSet(i)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default QuestionsTable;
