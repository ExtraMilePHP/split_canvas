import React, { useCallback, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Swal from "sweetalert2";
import { fetchThemeData } from "../../themeSlice";
import { selectAdminToken } from "../../sessionSlice";
import { updateThemeData } from "../../functions/updateThemeData";
import { WML_AVATAR_SLOT_COUNT } from "../../../lib/wmlAvatars";
import "./WmlAvatarSettings.css";

function normalizeKeys(raw) {
  const a = Array.isArray(raw) ? [...raw] : [];
  while (a.length < WML_AVATAR_SLOT_COUNT) {
    a.push(null);
  }
  return a.slice(0, WML_AVATAR_SLOT_COUNT).map((v) =>
    v == null || v === "" ? null : String(v)
  );
}

export default function WmlAvatarSettings({ embedded = false }) {
  const dispatch = useDispatch();
  const adminToken = useSelector(selectAdminToken);
  const { currentTheme, data: themeData } = useSelector((s) => s.theme);
  const s3Base = process.env.REACT_APP_S3_PATH || "";
  const fileRefs = useRef({});

  const keys = useMemo(
    () => normalizeKeys(themeData?.wmlAvatarKeys),
    [themeData?.wmlAvatarKeys]
  );

  const [busySlot, setBusySlot] = useState(null);

  const refresh = useCallback(() => {
    if (currentTheme) {
      dispatch(fetchThemeData({ themeId: currentTheme }));
    }
  }, [dispatch, currentTheme]);

  const handleUpload = async (slotIndex, e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !currentTheme || !adminToken) return;
    setBusySlot(slotIndex);
    const formData = new FormData();
    formData.append("themeName", currentTheme);
    formData.append("slotIndex", String(slotIndex));
    formData.append("avatar", file);
    try {
      const res = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/uploadWmlAvatar`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}` },
          body: formData,
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || "Upload failed");
      }
      await Swal.fire({
        icon: "success",
        title: "Uploaded",
        timer: 1200,
        showConfirmButton: false,
      });
      refresh();
    } catch (err) {
      await Swal.fire({
        icon: "error",
        title: "Upload failed",
        text: err.message,
      });
    } finally {
      setBusySlot(null);
    }
  };

  const handleRemove = async (slotIndex) => {
    if (!currentTheme || !adminToken) return;
    const next = normalizeKeys(themeData?.wmlAvatarKeys);
    next[slotIndex] = null;
    setBusySlot(slotIndex);
    try {
      await updateThemeData({
        token: adminToken,
        payload: {
          currentTheme,
          data: { wmlAvatarKeys: next },
        },
      });
      refresh();
    } catch (e) {
      await Swal.fire({
        icon: "error",
        text: e.message || "Remove failed",
      });
    } finally {
      setBusySlot(null);
    }
  };

  if (!themeData) return null;

  return (
    <div
      className={
        embedded
          ? "wml-avatar-settings wml-avatar-settings--embedded"
          : "wml-avatar-settings"
      }
    >
      {!embedded ? (
        <h3 className="wml-avatar-settings__title">
          Who is most likely — character portraits
        </h3>
      ) : null}
      <p className="wml-avatar-settings__hint">
        Up to {WML_AVATAR_SLOT_COUNT} portraits (PNG, JPG, or WebP, max 5 MB).
        Players choose a slot; empty slots use bundled art when any custom
        portrait is set.
      </p>
      <div className="wml-avatar-settings__grid">
        {keys.map((filename, index) => (
          <div key={index} className="wml-avatar-settings__cell">
            <button
              type="button"
              className="wml-avatar-settings__thumb"
              onClick={() => fileRefs.current[index]?.click()}
              disabled={busySlot != null}
              aria-label={`Slot ${index + 1} upload`}
            >
              {filename ? (
                <img src={`${s3Base}${filename}`} alt="" />
              ) : (
                <span className="wml-avatar-settings__placeholder">+</span>
              )}
            </button>
            <span className="wml-avatar-settings__slot-label">{index + 1}</span>
            <input
              ref={(el) => {
                fileRefs.current[index] = el;
              }}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="wml-avatar-settings__file"
              onChange={(e) => handleUpload(index, e)}
              disabled={busySlot != null}
            />
            {filename ? (
              <button
                type="button"
                className="wml-avatar-settings__remove"
                disabled={busySlot != null}
                onClick={() => handleRemove(index)}
              >
                Remove
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
