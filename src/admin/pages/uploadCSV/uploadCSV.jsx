import React, { useRef, useState } from "react";
import Swal from "sweetalert2";
import { useSelector } from "react-redux";
import { selectAdminToken } from "../../sessionSlice";
import "./uploadCSV.css";

export default function CsvUploadModal({
  isOpen,
  onClose,
  organizationId,
  sessionId,
}) {
  const fileInputRef = useRef(null);
  const [csvFile, setCsvFile] = useState(null);
  const adminToken = useSelector(selectAdminToken);
  const [isUploading, setIsUploading] = useState(false);
  const { currentTheme } = useSelector((state) => state.theme);
  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      Swal.fire("Invalid File", "Please select a CSV file.", "error");
      e.target.value = null;
      setCsvFile(null);
      return;
    }
    setCsvFile(file);
  };

  const handleUpload = async () => {
    if (!csvFile) {
      return Swal.fire("No File", "Please choose a CSV file first.", "warning");
    }

    setIsUploading(true); // start loading

    const formData = new FormData();
    formData.append("csv", csvFile);
    formData.append("currentTheme", currentTheme);

    try {
      const res = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/uploadCSV`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
          body: formData,
        }
      );

      if (!res.ok) {
        const res_data = await res.json();
        console.log(res_data);

        // Stop uploading state immediately
        setIsUploading(false);

        if (res_data.type !== undefined) {
          console.log(res_data.message);

          // Clear file input so selecting the same filename again will trigger onChange
          setCsvFile(null);
          if (fileInputRef.current) fileInputRef.current.value = null;

          // Show server message
          Swal.fire("Failed to save CSV", res_data.message, "info");
        } else {
          throw new Error("CSV Upload failed");
        }
        return true;
      }

      Swal.fire("Success", "CSV imported successfully.", "success");
      window.location.reload();
      onClose();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to upload CSV. Please try again.", "error");
    } finally {
      setIsUploading(false); // stop loading after all
    }
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="csv-modal">
        <h3>Upload Questions CSV</h3>
        <div className="csv-form-group">
          <button
            className="csv-file-btn"
            onClick={() => fileInputRef.current.click()}
          >
            Choose CSV File
          </button>
          <span className="csv-file-name">
            {csvFile?.name || "No file selected"}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="csv-file-input"
            onChange={handleFileChange}
          />
        </div>
        <div className="code">
          * CSV only. Include a <code>question_name</code> column (one prompt per row).
        </div>
        <div className="csv-actions">
          <button className="csv-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="csv-upload-btn"
            onClick={handleUpload}
            disabled={isUploading}
          >
            {isUploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </>
  );
}
