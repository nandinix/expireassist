import React, { useState } from 'react';
import './componentStyles.css';

// Simple recommendation engine: match desired item to inventory items by naive string includes
export default function Recommendations({ inventory = [] }) {
  const [desired, setDesired] = useState('');
  const [results, setResults] = useState([]);

  function find() {
    const text = desired.toLowerCase();
    // Prefer items that expire soon
    const soon = inventory
      .map((i) => ({ ...i, days: Math.ceil((new Date(i.expiry) - new Date()) / (1000*60*60*24)) }))
      .filter((i) => i.days >= -30) // ignore very old
      .sort((a,b)=>a.days-b.days);

    // naive matching: suggest any inventory item that pairs with desired (includes/contains)
    const suggestions = soon.filter((i) => i.name.toLowerCase().includes(text) === false).slice(0,6);

    // produce meal ideas mixing desired + top 3 soon-expiring
    const meals = suggestions.slice(0,3).map((s) => ({
      title: `${desired || 'Your item'} + ${s.name}`,
      uses: [desired || 'New item', s.name],
      expiresIn: s.days,
    }));

    setResults(meals.length ? meals : [{ title: 'No paired suggestions found. Try a different item.', uses: [] }]);
  }

  return (
    <div className="panel" role="region" aria-label="Recommendations">
      <h2>Meal Recommendations</h2>
      <label className="full-width">
        Desired item (what you plan to buy)
        <input placeholder="e.g., steak" value={desired} onChange={(e)=>setDesired(e.target.value)} />
      </label>
      <div className="form-actions">
        <button onClick={find}>Get suggestions</button>
      </div>

      <ul className="recommend-list">
        {results.map((r, idx) => (
          <li key={idx} className="recommend-item">
            <strong>{r.title}</strong>
            {r.uses && r.uses.length>0 && (
              <div className="muted">Uses: {r.uses.join(', ')} — expires in {r.expiresIn}d</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
