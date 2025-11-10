import React, { useState } from 'react';
import './componentStyles.css';

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export default function AddItem({ onAdd }) {
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState('');

  function submit(e) {
    e.preventDefault();
    if (!name || !expiry) return;
    onAdd({ id: uid(), name: name.trim(), expiry });
    setName('');
    setExpiry('');
  }

  return (
    <form className="panel add-item" onSubmit={submit} aria-label="Add inventory item">
      <h2>Add item</h2>
      <div className="form-row">
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Milk" />
        </label>
        <label>
          Expiry
          <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </label>
      </div>
      <div className="form-actions">
        <button type="submit">Add to inventory</button>
      </div>
    </form>
  );
}
