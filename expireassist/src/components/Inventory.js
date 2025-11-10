import React from 'react';
import './componentStyles.css';

function daysUntil(dateStr) {
  const d = new Date(dateStr);
  const diff = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function Inventory({ items = [], onRemove, onUpdate }) {
  if (!items.length) {
    return <div className="panel" role="region" aria-label="Inventory">No items in inventory — add one to get started.</div>;
  }

  return (
    <div className="panel" role="region" aria-label="Inventory list">
      <h2>Home Inventory</h2>
      <ul className="inventory-list">
        {items.map((it) => {
          const days = daysUntil(it.expiry);
          const urgent = days <= 3;
          return (
            <li key={it.id} className={`inventory-item ${urgent ? 'urgent' : ''}`}>
              <div className="item-main">
                <strong>{it.name}</strong>
                <span className="muted">Expires: {new Date(it.expiry).toLocaleDateString()}</span>
              </div>
              <div className="item-actions">
                <span className="badge">{days}d</span>
                <button onClick={() => onRemove(it.id)} aria-label={`Remove ${it.name}`}>Remove</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
