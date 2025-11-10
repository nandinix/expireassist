import React from 'react';
import './componentStyles.css';

const MOCK_PRODUCTS = [
  { id: 'p1', name: 'T-Bone Steak' },
  { id: 'p2', name: 'Bread Loaf' },
  { id: 'p3', name: 'Bag of Onions' },
  { id: 'p4', name: 'Garlic' },
  { id: 'p5', name: 'Chicken Breast' },
  { id: 'p6', name: 'Tomatoes' },
];

export default function ShoppingView({ inventory = [], onAddToInventory }) {
  return (
    <div className="panel" role="region" aria-label="Shopping view">
      <h2>Online Store — Browse</h2>
      <div className="shopping-grid">
        {MOCK_PRODUCTS.map((p) => (
          <article key={p.id} className="product-card">
            <div className="product-img" aria-hidden>📦</div>
            <h3>{p.name}</h3>
            <p className="muted">Tap to add to cart & inventory</p>
            <div>
              <button onClick={() => {
                // when adding simulate 10 days expiry
                const expiry = new Date(); expiry.setDate(expiry.getDate()+10);
                onAddToInventory({ id: `${p.id}-${Date.now()}`, name: p.name, expiry: expiry.toISOString().slice(0,10) });
              }}>Add to cart</button>
            </div>
          </article>
        ))}
      </div>

      <section aria-label="Expiring soon" className="expiring-soon">
        <h3>Expiring soon in your home</h3>
        {inventory.length ? (
          <ul>
            {inventory.slice(0,5).map(i=> <li key={i.id}>{i.name} — {new Date(i.expiry).toLocaleDateString()}</li>)}
          </ul>
        ) : <div className="muted">No items at home yet.</div>}
      </section>
    </div>
  );
}
