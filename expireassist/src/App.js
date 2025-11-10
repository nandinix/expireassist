import React, { useEffect, useState } from 'react';
import './App.css';
import Inventory from './components/Inventory';
import AddItem from './components/AddItem';
import Recommendations from './components/Recommendations';
import ShoppingView from './components/ShoppingView';
import ReceiptScanner from './components/ReceiptScanner';
import AccessibilityToggle from './components/AccessibilityToggle';
import { loadInventory, saveInventory } from './utils/storage';

const VIEWS = {
  INVENTORY: 'inventory',
  SHOPPING: 'shopping',
  RECOMMEND: 'recommend',
  RECEIPT: 'receipt',
};

function App() {
  const [view, setView] = useState(VIEWS.INVENTORY);
  const [inventory, setInventory] = useState(() => loadInventory());

  useEffect(() => {
    saveInventory(inventory);
  }, [inventory]);

  function addItem(item) {
    setInventory((prev) => [item, ...prev]);
  }

  function removeItem(id) {
    setInventory((prev) => prev.filter((i) => i.id !== id));
  }

  function updateItem(updated) {
    setInventory((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  return (
    <div className="App app-container" aria-live="polite">
      <header className="app-header">
        <h1>ExpireAssist</h1>
        <p className="subtitle">Reduce food waste — plan smarter grocery trips</p>
        <AccessibilityToggle />
        <nav className="main-nav" aria-label="Main navigation">
          <button onClick={() => setView(VIEWS.INVENTORY)} aria-pressed={view===VIEWS.INVENTORY}>Inventory</button>
          <button onClick={() => setView(VIEWS.SHOPPING)} aria-pressed={view===VIEWS.SHOPPING}>Shopping</button>
          <button onClick={() => setView(VIEWS.RECOMMEND)} aria-pressed={view===VIEWS.RECOMMEND}>Recommendations</button>
          <button onClick={() => setView(VIEWS.RECEIPT)} aria-pressed={view===VIEWS.RECEIPT}>Receipt</button>
        </nav>
      </header>

      <main className="main-content">
        {view === VIEWS.INVENTORY && (
          <section>
            <AddItem onAdd={addItem} />
            <Inventory items={inventory} onRemove={removeItem} onUpdate={updateItem} />
          </section>
        )}

        {view === VIEWS.SHOPPING && (
          <ShoppingView inventory={inventory} onAddToInventory={addItem} />
        )}

        {view === VIEWS.RECOMMEND && (
          <Recommendations inventory={inventory} />
        )}

        {view === VIEWS.RECEIPT && (
          <ReceiptScanner onParsedItems={(items) => setInventory((p)=>[...items,...p])} />
        )}
      </main>

      <footer className="app-footer">
        <small>Accessibility Armadillos — ExpireAssist prototype</small>
      </footer>
    </div>
  );
}

export default App;
