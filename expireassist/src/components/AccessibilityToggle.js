import React, { useState, useEffect } from 'react';
import './componentStyles.css';

export default function AccessibilityToggle(){
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);

  useEffect(()=>{
    document.body.classList.toggle('high-contrast', highContrast);
  }, [highContrast]);

  useEffect(()=>{
    document.body.classList.toggle('large-text', largeText);
  }, [largeText]);

  return (
    <div className="accessibility-controls" aria-label="Accessibility settings">
      <label><input type="checkbox" checked={highContrast} onChange={(e)=>setHighContrast(e.target.checked)} /> High contrast</label>
      <label><input type="checkbox" checked={largeText} onChange={(e)=>setLargeText(e.target.checked)} /> Large text</label>
    </div>
  );
}
