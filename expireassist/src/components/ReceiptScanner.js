import React, { useState } from 'react';
import './componentStyles.css';

function uid() { return Math.random().toString(36).slice(2,9); }

export default function ReceiptScanner({ onParsedItems }){
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');

  function parse() {
    // naive parser: split lines, take words that look like product names
    const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    const now = new Date();
    const items = lines.map((l, idx)=>{
      const expiry = new Date(); expiry.setDate(now.getDate()+7+idx); // simulate
      return { id: uid(), name: l, expiry: expiry.toISOString().slice(0,10) };
    });
    onParsedItems(items);
    setMessage(`Parsed ${items.length} items and added to inventory.`);
    setText('');
  }

  return (
    <div className="panel" role="region" aria-label="Receipt scanner">
      <h2>Receipt Scanner (prototype)</h2>
      <p className="muted">Paste a receipt’s item lines here; the app will add them as inventory with mock expiry dates.</p>
      <label className="full-width">
        Receipt text
        <textarea value={text} onChange={(e)=>setText(e.target.value)} rows={6} />
      </label>
      <div className="form-actions">
        <button onClick={parse} disabled={!text}>Parse & Add</button>
      </div>
      {message && <div className="notice">{message}</div>}
    </div>
  );
}
