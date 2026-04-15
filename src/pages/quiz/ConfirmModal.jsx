import React from "react";

export default function ConfirmModal({
  isOpen,
  title,
  text,
  confirmText = "Yes",
  cancelText = "Cancel",
  showCancel = true,
  onConfirm,
  onCancel,
  icon // optional: pass path or element for icon
}) {
  if (!isOpen) return null;

  return (
    <div className="cm-backdrop">
      <div className="cm-modal">
        <div className="cm-header">
          {icon && <div className="cm-icon-wrap"><img src={icon} alt="icon" className="cm-icon" /></div>}
          <h3 className="cm-title">{title}</h3>
        </div>
        <div className="cm-body">
          <p className="cm-text">{text}</p>
        </div>
        <div className="cm-actions">
          {showCancel && (
            <button className="cm-btn cm-btn-cancel" onClick={onCancel}>
              {cancelText}
            </button>
          )}
          <button
            className="cm-btn cm-btn-confirm"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
