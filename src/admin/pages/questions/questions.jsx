import React, { useEffect, useState, useCallback, useRef } from "react";
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
/** One row: left 450 + right 450 wide, one 450px-tile tall. */
const FULL_IMAGE_WIDTH = 900;
const FULL_IMAGE_HEIGHT = 450;
/** Each uploaded half matches legacy 450×450 per side. */
const HALF_SIZE = 450;
const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png"];
const ALLOWED_FILE_EXTENSIONS = [".jpg", ".jpeg", ".png"];

function s3Url(filename) {
  if (!filename) return "";
  const base = process.env.REACT_APP_S3_PATH || "";
  return `${base}${filename}`;
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not encode image"));
      },
      mimeType,
      quality
    );
  });
}

/**
 * Validates 900×450 composite, splits into two 450×450 images for S3 (left + right).
 */
async function splitFullImageToLeftRightFiles(file) {
  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED_FILE_TYPES.includes(mime)) {
    throw new Error("Only JPG/JPEG and PNG are allowed.");
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error("Could not read or decode image"));
      image.src = url;
    });

    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (w !== FULL_IMAGE_WIDTH || h !== FULL_IMAGE_HEIGHT) {
      throw new Error(
        `Image must be exactly ${FULL_IMAGE_WIDTH}×${FULL_IMAGE_HEIGHT}px (selected: ${w}×${h}).`
      );
    }

    const leftCanvas = document.createElement("canvas");
    leftCanvas.width = HALF_SIZE;
    leftCanvas.height = HALF_SIZE;
    const rightCanvas = document.createElement("canvas");
    rightCanvas.width = HALF_SIZE;
    rightCanvas.height = HALF_SIZE;

    const lctx = leftCanvas.getContext("2d");
    const rctx = rightCanvas.getContext("2d");
    if (!lctx || !rctx) throw new Error("Canvas unavailable");

    lctx.drawImage(
      img,
      0,
      0,
      HALF_SIZE,
      HALF_SIZE,
      0,
      0,
      HALF_SIZE,
      HALF_SIZE
    );
    rctx.drawImage(
      img,
      HALF_SIZE,
      0,
      HALF_SIZE,
      HALF_SIZE,
      0,
      0,
      HALF_SIZE,
      HALF_SIZE
    );

    const outMime = mime === "image/jpeg" ? "image/jpeg" : "image/png";
    const quality = mime === "image/jpeg" ? 0.92 : undefined;

    const leftBlob = await canvasToBlob(leftCanvas, outMime, quality);
    const rightBlob = await canvasToBlob(rightCanvas, outMime, quality);

    const ext = mime === "image/jpeg" ? "jpg" : "png";
    const leftOut = new File([leftBlob], `split-left.${ext}`, {
      type: outMime,
    });
    const rightOut = new File([rightBlob], `split-right.${ext}`, {
      type: outMime,
    });

    return [leftOut, rightOut];
  } finally {
    URL.revokeObjectURL(url);
  }
}

const QuestionsTable = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const token = useSelector(selectAdminToken);
  const currentTheme = useSelector((state) => state.theme.currentTheme);
  const themeData = useSelector((state) => state.theme.data);

  const [sets, setSets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [fullImageFile, setFullImageFile] = useState(null);
  const fullImageInputRef = useRef(null);

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
    if (!fullImageFile) {
      Swal.fire(
        "Select file",
        `Choose one ${FULL_IMAGE_WIDTH}×${FULL_IMAGE_HEIGHT}px image.`,
        "warning"
      );
      return;
    }
    const t = (fullImageFile.type || "").toLowerCase();
    if (!ALLOWED_FILE_TYPES.includes(t)) {
      Swal.fire(
        "Invalid file type",
        "Only JPG/JPEG and PNG files are allowed.",
        "warning"
      );
      return;
    }
    try {
      setSaving(true);
      const [leftFile, rightFile] = await splitFullImageToLeftRightFiles(
        fullImageFile
      );
      const [leftName, rightName] = await Promise.all([
        uploadSplitCanvasImageFile(leftFile, token),
        uploadSplitCanvasImageFile(rightFile, token),
      ]);
      const next = [...sets, { left: leftName, right: rightName }];
      setFullImageFile(null);
      if (fullImageInputRef.current) fullImageInputRef.current.value = "";
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
              Up to {MAX_SETS} sets per theme. Upload one{" "}
              <strong>
                {FULL_IMAGE_WIDTH}×{FULL_IMAGE_HEIGHT}px
              </strong>{" "}
              composite (two 450×450 panels side by side). It is split into
              left and right <strong>450×450</strong> images and uploaded
              automatically. Allowed: JPG, JPEG, PNG.
            </p>

            <div className="split-sets-add split-sets-add--single">
              <div className="split-sets-field split-sets-field--full">
                <label htmlFor="split-full-file">Full image</label>
                <input
                  ref={fullImageInputRef}
                  id="split-full-file"
                  className="split-sets-file-input"
                  type="file"
                  accept={ALLOWED_FILE_EXTENSIONS.join(",")}
                  onChange={(e) =>
                    setFullImageFile(e.target.files?.[0] || null)
                  }
                />
              </div>
              <button
                type="button"
                className="add-new-question-v1"
                disabled={saving || sets.length >= MAX_SETS}
                onClick={addPair}
              >
                {saving ? "Working…" : "Add"}
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
                        No image sets yet. Add a {FULL_IMAGE_WIDTH}×
                        {FULL_IMAGE_HEIGHT}px image above.
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
