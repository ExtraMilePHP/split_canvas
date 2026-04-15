// IntroModal.jsx
import React, { useState, useRef, useEffect } from 'react';
import './introModal.css';

const IntroModal = ({ isOpen, onClose, onComplete, introFile }) => {
  const [isVideoCompleted, setIsVideoCompleted] = useState(false);
  const [canProceed, setCanProceed] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(true);
  const videoRef = useRef(null);

  // Reset states when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsVideoCompleted(false);
      setCanProceed(false);
      setPdfError(false);
      setPdfLoading(true);
    } else {
      // Reset PDF loading when modal opens
      if (getFileType(introFile) === 'pdf') {
        setPdfLoading(true);
        setPdfError(false);
      }
    }
  }, [isOpen]);

  // Get file extension and type
  const getFileExtension = (filename) => {
    return filename?.split('.').pop()?.toLowerCase();
  };

  const getFileType = (filename) => {
    const ext = getFileExtension(filename);
    if (['jpg', 'jpeg', 'png'].includes(ext)) return 'image';
    if (['mp4', 'mpeg', 'mov', 'avi'].includes(ext)) return 'video';
    if (ext === 'pdf') return 'pdf';
    return 'unknown';
  };

  const fileType = getFileType(introFile);
  const s3BaseUrl = process.env.REACT_APP_S3_PATH;
  const fileUrl = `${s3BaseUrl}${introFile}`;

  // Handle video events
  const handleVideoEnded = () => {
    setIsVideoCompleted(true);
    setCanProceed(true);
  };

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      const { currentTime, duration } = videoRef.current;
      // Consider video completed if user watched 95% of it
      if (duration && currentTime / duration >= 0.95) {
        setIsVideoCompleted(true);
        setCanProceed(true);
      }
    }
  };

  // For images and PDFs, enable proceed immediately
  useEffect(() => {
    if (fileType === 'image' || fileType === 'pdf') {
      setCanProceed(true);
    }
  }, [fileType]);

  const handleProceed = () => {
    onComplete();
    onClose();
  };

  // Handle PDF iframe error
  const handlePdfError = () => {
    setPdfError(true);
    setPdfLoading(false);
  };

  // Handle PDF iframe load
  const handlePdfLoad = () => {
    setPdfLoading(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="intro-modal-backdrop" onClick={onClose} />
      <div className="intro-modal">
        <div className="intro-modal-header">
          <h3>Introduction</h3>
          <button className="intro-modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="intro-modal-content">
          {fileType === 'image' && (
            <div className="intro-image-container">
              <img 
                src={fileUrl} 
                alt="Introduction" 
                className="intro-image"
              />
            </div>
          )}

          {fileType === 'video' && (
            <div className="intro-video-container">
              <video 
                ref={videoRef}
                className="intro-video"
                controls
                onEnded={handleVideoEnded}
                onTimeUpdate={handleVideoTimeUpdate}
                controlsList="nodownload"
              >
                <source src={fileUrl} type={`video/${getFileExtension(introFile)}`} />
                Your browser does not support the video tag.
              </video>
              {!isVideoCompleted && (
                <p className="intro-video-notice">
                  Please watch the entire video to continue
                </p>
              )}
            </div>
          )}

          {fileType === 'pdf' && (
            <div className="intro-pdf-container">
              {pdfLoading && !pdfError && (
                <div className="pdf-loader">
                  <div className="loader-spinner"></div>
                  <p>Loading PDF...</p>
                </div>
              )}
              
              {!pdfError ? (
                <>
                  {/* Try multiple PDF display methods */}
                  
                  {/* Method 1: Direct iframe with PDF.js */}
                  <iframe
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`}
                    className={`intro-pdf-viewer ${pdfLoading ? 'loading' : ''}`}
                    title="Introduction PDF"
                    onError={handlePdfError}
                    onLoad={handlePdfLoad}
                    style={{ display: pdfLoading ? 'none' : 'block' }}
                  />
                  
                  {/* Fallback: Direct iframe */}
                  {/* 
                  <iframe
                    src={fileUrl}
                    className="intro-pdf-viewer"
                    title="Introduction PDF"
                    onError={handlePdfError}
                    onLoad={handlePdfLoad}
                  />
                  */}
                  
                  {/* Alternative: PDF.js viewer */}
                  {/* 
                  <iframe
                    src={`/pdf.js/web/viewer.html?file=${encodeURIComponent(fileUrl)}`}
                    className="intro-pdf-viewer"
                    title="Introduction PDF"
                    onError={handlePdfError}
                    onLoad={handlePdfLoad}
                  />
                  */}
                </>
              ) : (
                <div className="pdf-fallback">
                  <div className="pdf-icon">📄</div>
                  <h4>PDF Document</h4>
                  <p>Unable to display PDF in browser.</p>
                  <a 
                    href={fileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="pdf-download-btn"
                  >
                    Open PDF in New Tab
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="intro-modal-footer">
          <button 
            className={`intro-next-button ${!canProceed ? 'intro-disabled' : ''}`}
            onClick={handleProceed}
            disabled={!canProceed}
          >
            {fileType === 'video' && !isVideoCompleted ? 'Complete Video to Continue' : 'Next'}
          </button>
        </div>
      </div>
    </>
  );
};

export default IntroModal;