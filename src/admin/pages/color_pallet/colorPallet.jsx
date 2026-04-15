/* QuizPallet.jsx */
import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { useDispatch, useSelector } from 'react-redux';
import { selectAdminToken } from '../../sessionSlice';
import { fetchThemeData, selectTheme } from '../../themeSlice';
import './colorPallet.css';
import { updateThemeData } from '../../functions/updateThemeData';

export default function ColorPallet({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const adminToken = useSelector(selectAdminToken);
  const { currentTheme, data } = useSelector((state) => state.theme);
  const [colors, setColors] = useState({
    text_color: '#000000',
    ui_color_1: '#222222',
    ui_color_2: '#222222',
    option_color: '#ff9900',
    option_text_color: '#ffffff',
  });

  useEffect(() => {
    dispatch(fetchThemeData({ themeId: currentTheme }));
  }, [dispatch]);

  useEffect(() => {
    if (!isOpen || !data?.colors) return;
    setColors(data.colors);
  }, [isOpen, data]);

  const handleColorChange = (key) => (e) => {
    setColors((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = async () => {
    const payload = { data: { colors }, currentTheme };
    
    try {
      // use the shared helper instead of inlining fetch
      await updateThemeData({ payload, token: adminToken });

      Swal.fire("Success", "Pallet saved!", "success");
      window.location.reload();
      onClose();
    } catch (e) {
      Swal.fire("Error", e.message || "Failed to save pallet", "error");
    }
  };







  if (!isOpen) return null;

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="quiz-pallet-modal quiz-pallet-modal--small">
        <h2>Quiz Pallet</h2>
        <div className="pallet-row">
          <div className="pallet-input">
            <label>Text Color</label>
            <input
              type="color"
              className="pallet-swatch"
              value={colors.text_color}
              onChange={handleColorChange('text_color')}
            />
          </div>
        </div>
        <div className="pallet-row">
          <div className="pallet-input">
            <label>Question Color</label>
            <input
              type="color"
              className="pallet-swatch"
              value={colors.ui_color_1}
              onChange={handleColorChange('ui_color_1')}
            />
          </div>
          <div className="pallet-input">
            <label>Progress bar Color</label>
            <input
              type="color"
              className="pallet-swatch"
              value={colors.ui_color_2}
              onChange={handleColorChange('ui_color_2')}
            />
          </div>
        </div>
        <div className="pallet-row">
          <div className="pallet-input">
            <label>Option Color</label>
            <input
              type="color"
              className="pallet-swatch"
              value={colors.option_color}
              onChange={handleColorChange('option_color')}
            />
          </div>
          <div className="pallet-input">
            <label>Option Text Color</label>
            <input
              type="color"
              className="pallet-swatch"
              value={colors.option_text_color}
              onChange={handleColorChange('option_text_color')}
            />
          </div>
        </div>
        <div className="actions">
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="save-btn" onClick={handleSubmit}>
            Save
          </button>
        </div>
      </div>
    </>
  );
}