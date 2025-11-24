import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE = 'http://localhost:5000';

function App() {
  const [inventory, setInventory] = useState([]);
  const [items, setItems] = useState([]);
  const [meals, setMeals] = useState([]);

  const [loading, setLoading] = useState(true);
  const [mealLoading, setMealLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedPantryIds, setSelectedPantryIds] = useState([]);
  const [orderQuantities, setOrderQuantities] = useState({});

  const [pantryCategoryFilter, setPantryCategoryFilter] = useState('All');
  const [newItemsCategory, setNewItemsCategory] = useState('All');

  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [accessibilityMode, setAccessibilityMode] = useState(false);

  const itemsById = useMemo(() => {
    const map = {};
    items.forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, [items]);

  const allCategories = useMemo(() => {
    const set = new Set();
    items.forEach((item) => {
      if (item.category) {
        set.add(item.category);
      }
    });
    return ['All', ...Array.from(set).sort()];
  }, [items]);

  const pantryWithMeta = useMemo(() => {
    return inventory.map((row) => {
      const ref = itemsById[row.item_id] || {};
      return {
        ...row,
        category: ref.category || 'Other',
      };
    });
  }, [inventory, itemsById]);

  const pantryGrouped = useMemo(() => {
    const byKey = new Map();
    pantryWithMeta.forEach((row) => {
      const key = row.item_id ?? row.item_name ?? row.id;
      const existing = byKey.get(key);
      if (existing) {
        const currentQty = Number(existing.quantity) || 0;
        const rowQty = Number(row.quantity) || 0;
        existing.quantity = currentQty + rowQty;
        const existingDate = existing.expiry_date ? new Date(existing.expiry_date) : null;
        const thisDate = row.expiry_date ? new Date(row.expiry_date) : null;
        if (thisDate && (!existingDate || thisDate < existingDate)) {
          existing.expiry_date = row.expiry_date;
        }
        existing.inventoryIds.push(row.id);
      } else {
        byKey.set(key, {
          ...row,
          quantity: Number(row.quantity) || 0,
          inventoryIds: [row.id],
        });
      }
    });
    return Array.from(byKey.values());
  }, [pantryWithMeta]);

  const pantrySorted = useMemo(() => {
    return [...pantryGrouped].sort((a, b) => {
      const aDate = a.expiry_date ? new Date(a.expiry_date) : null;
      const bDate = b.expiry_date ? new Date(b.expiry_date) : null;
      if (aDate && bDate) return aDate - bDate;
      if (aDate) return -1;
      if (bDate) return 1;
      return (a.item_name || '').localeCompare(b.item_name || '');
    });
  }, [pantryGrouped]);

  const pantryFiltered = useMemo(() => {
    return pantrySorted.filter(
      (row) => pantryCategoryFilter === 'All' || row.category === pantryCategoryFilter
    );
  }, [pantrySorted, pantryCategoryFilter]);

  const newItemsFiltered = useMemo(() => {
    return items
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((item) => newItemsCategory === 'All' || item.category === newItemsCategory);
  }, [items, newItemsCategory]);

  function computeSelectedItemIds(selectedInventoryRowIds, orderMap, inventoryRows) {
    const ids = new Set();
    inventoryRows.forEach((row) => {
      if (selectedInventoryRowIds.includes(row.id)) {
        if (Number.isFinite(row.item_id)) {
          ids.add(row.item_id);
        }
      }
    });
    Object.entries(orderMap).forEach(([itemId, qty]) => {
      if (qty > 0) {
        const numeric = Number(itemId);
        if (Number.isFinite(numeric)) {
          ids.add(numeric);
        }
      }
    });
    return Array.from(ids);
  }

  async function loadInventory() {
    const res = await fetch(`${API_BASE}/api/inventory`);
    if (!res.ok) {
      throw new Error(`Inventory HTTP ${res.status}`);
    }
    const data = await res.json();
    setInventory(data);
  }

  async function loadItems() {
    const res = await fetch(`${API_BASE}/api/items`);
    if (!res.ok) {
      throw new Error(`Items HTTP ${res.status}`);
    }
    const data = await res.json();
    setItems(data);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      setLoading(true);
      setError('');
      try {
        await Promise.all([loadInventory(), loadItems()]);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError('Failed to load data from the server.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const selectedIds = computeSelectedItemIds(selectedPantryIds, orderQuantities, inventory);
    if (!selectedIds.length) {
      setMeals([]);
      return;
    }
    let cancelled = false;
    async function loadMeals() {
      setMealLoading(true);
      try {
        const query = selectedIds.join(',');
        const res = await fetch(`${API_BASE}/api/meals?item_ids=${query}`);
        if (!res.ok) {
          throw new Error(`Meals HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) {
          setMeals(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) {
          setMealLoading(false);
        }
      }
    }
    loadMeals();
    return () => {
      cancelled = true;
    };
  }, [selectedPantryIds, orderQuantities, inventory]);

  function togglePantrySelection(rowIds) {
    setSelectedPantryIds((prev) => {
      const allSelected = rowIds.every((id) => prev.includes(id));
      if (allSelected) {
        return prev.filter((id) => !rowIds.includes(id));
      }
      const next = [...prev];
      rowIds.forEach((id) => {
        if (!next.includes(id)) {
          next.push(id);
        }
      });
      return next;
    });
  }

  function adjustOrderQuantity(itemId, delta) {
    const idStr = String(itemId);
    setOrderQuantities((prev) => {
      const current = prev[idStr] || 0;
      const next = Math.max(0, current + delta);
      const copy = { ...prev };
      if (next === 0) {
        delete copy[idStr];
      } else {
        copy[idStr] = next;
      }
      return copy;
    });
  }

  function addMissingItemsToCart(meal) {
    if (!meal.missing_item_names || meal.missing_item_names.length === 0) {
      return;
    }
    setOrderQuantities((prev) => {
      const copy = { ...prev };
      meal.missing_item_names.forEach((missingName) => {
        const foundItem = items.find((item) => item.name === missingName);
        if (foundItem) {
          const idStr = String(foundItem.id);
          const current = copy[idStr] || 0;
          copy[idStr] = current + 1;
        }
      });
      return copy;
    });
  }

  function totalOrderCount(orderMap) {
    return Object.values(orderMap).reduce((sum, qty) => sum + qty, 0);
  }

  async function handleCheckout() {
    const entries = Object.entries(orderQuantities).filter(([, qty]) => qty > 0);
    if (!entries.length) {
      return;
    }
    setCheckoutLoading(true);
    setError('');
    try {
      for (const [itemId, qty] of entries) {
        await fetch(`${API_BASE}/api/inventory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_id: Number(itemId),
            quantity: qty,
          }),
        });
      }
      await loadInventory();
      setOrderQuantities({});
    } catch (err) {
      console.error(err);
      setError('Failed to add new items to your pantry.');
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handleMarkUsed() {
    if (!selectedPantryIds.length) {
      return;
    }
    setCheckoutLoading(true);
    setError('');
    try {
      for (const inventoryId of selectedPantryIds) {
        await fetch(`${API_BASE}/api/inventory/${inventoryId}`, {
          method: 'DELETE',
        });
      }
      await loadInventory();
      setSelectedPantryIds([]);
    } catch (err) {
      console.error(err);
      setError('Failed to remove items from inventory.');
    } finally {
      setCheckoutLoading(false);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) {
      return 'N/A';
    }
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) {
      return 'N/A';
    }
    return d.toLocaleDateString();
  }

  function photoUrl(path) {
    if (!path) {
      return null;
    }
    return `${API_BASE}/${path}`;
  }

  if (loading) {
    return (
      <div className={'App App--centered' + (accessibilityMode ? ' App--high-contrast' : '')}>
        <p className="App-loading">Loading your pantry…</p>
      </div>
    );
  }

  return (
    <div className={'App' + (accessibilityMode ? ' App--high-contrast' : '')}>
      <a href="#main-content" className="Skip-link">
        Skip to main content
      </a>

      <header className="App-header">
        <div className="App-header-inner">
          <div className="App-brand">
            <span className="App-logo-dot" aria-hidden="true" />
            <div>
              <h1>ExpireAssist</h1>
              <p>Use what you have. Waste less food.</p>
            </div>
          </div>

          <div className="App-header-right">
            <div className="App-accessibility" role="group" aria-label="Accessibility display options">
              <button
                type="button"
                className="Secondary-button"
                onClick={() => setAccessibilityMode((prev) => !prev)}
                aria-pressed={accessibilityMode}
                aria-label={
                  accessibilityMode
                    ? 'Switch back to standard view'
                    : 'Enable high contrast and larger text for better visibility'
                }
              >
                {accessibilityMode ? 'Standard view' : 'High contrast & large text'}
              </button>
            </div>

            <nav className="App-nav" aria-label="Sections">
              <a href="#pantry-column">Pantry</a>
              <a href="#new-items-column">New items</a>
              <a href="#meals-column">Meal ideas</a>
            </nav>
          </div>
        </div>
      </header>

      <main id="main-content" className="App-main" aria-label="Grocery layout">
        {error && (
          <div className="App-error" role="alert">
            {error}
          </div>
        )}

        <section className="App-layout">
          <section id="pantry-column" className="Panel Panel--pantry" aria-label="Your pantry">
            <header className="Panel-header">
              <h2>Your pantry</h2>
              <p>Soonest to expire at the top. Select items you want to include in meal ideas.</p>
            </header>

            <div className="Panel-controls">
              <label className="Field">
                <span className="Field-label">Category</span>
                <select
                  value={pantryCategoryFilter}
                  onChange={(e) => setPantryCategoryFilter(e.target.value)}
                >
                  {allCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <ul className="Pantry-list">
              {pantryFiltered.map((row) => {
                const isSelected =
                  row.inventoryIds && row.inventoryIds.length
                    ? row.inventoryIds.every((id) => selectedPantryIds.includes(id))
                    : selectedPantryIds.includes(row.id);
                const img = photoUrl(row.item_photo_path);
                const handlePantryClick = () => {
                  if (row.inventoryIds && row.inventoryIds.length) {
                    togglePantrySelection(row.inventoryIds);
                  } else {
                    togglePantrySelection([row.id]);
                  }
                };
                return (
                  <li key={row.inventoryIds ? row.inventoryIds.join('-') : row.id}>
                    <button
                      type="button"
                      className={'Pantry-row' + (isSelected ? ' Pantry-row--selected' : '')}
                      onClick={handlePantryClick}
                      aria-pressed={isSelected}
                    >
                      <div className="Pantry-row-left">
                        {img && (
                          <img
                            src={img}
                            alt={row.item_name || 'Pantry item'}
                            className="Pantry-thumb"
                          />
                        )}
                        <div className="Pantry-text">
                          <span className="Pantry-name">{row.item_name}</span>
                          <span className="Pantry-meta">
                            {row.category} • qty {row.quantity}
                          </span>
                        </div>
                      </div>
                      <div className="Pantry-end">
                        <span className="Pantry-expiry">{formatDate(row.expiry_date)}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
              {pantryFiltered.length === 0 && (
                <li className="Pantry-empty">No items match this category.</li>
              )}
            </ul>

            <footer className="Pantry-footer">
              <button
                type="button"
                className="Primary-button"
                onClick={handleMarkUsed}
                disabled={checkoutLoading || selectedPantryIds.length === 0}
              >
                {checkoutLoading ? 'Removing from pantry…' : 'Remove selected items from pantry'}
              </button>
            </footer>
          </section>

          <section
            id="new-items-column"
            className="Panel Panel--new"
            aria-label="New items to add"
          >
            <header className="Panel-header Panel-header--split">
              <div>
                <h2>New items</h2>
                <p>
                  Browse the aisles and build your basket. Selected items will be added to your
                  pantry with an estimated expiration date.
                </p>
              </div>
              <div className="Tag Tag--accent" aria-live="polite">
                {totalOrderCount(orderQuantities)} item
                {totalOrderCount(orderQuantities) === 1 ? '' : 's'} in basket
              </div>
            </header>

            <div className="Chips-row" aria-label="Filter items by aisle">
              {allCategories.map((cat) => {
                const selected = newItemsCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    className={'Chip' + (selected ? ' Chip--active Chip--accent' : '')}
                    onClick={() => setNewItemsCategory(cat)}
                    aria-pressed={selected}
                  >
                    {cat === 'All' ? 'All aisles' : cat}
                  </button>
                );
              })}
            </div>

            <div className="Shelf-grid">
              {newItemsFiltered.map((item) => {
                const qty = orderQuantities[String(item.id)] || 0;
                const img = photoUrl(item.photo_path);
                return (
                  <article
                    key={item.id}
                    className={'Shelf-card' + (qty > 0 ? ' Shelf-card--selected' : '')}
                    aria-label={item.name}
                  >
                    <div className="Shelf-card-top">
                      {img && <img src={img} alt={item.name} className="Shelf-thumb" />}
                      <div className="Shelf-text">
                        <h3>{item.name}</h3>
                        <p className="Shelf-meta">
                          <span className="Tag">{item.category}</span>
                          <span>
                            Shelf life:{' '}
                            {item.shelf_life_days ? `${item.shelf_life_days} days` : 'unknown'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="Shelf-controls">
                      <span className="Shelf-qty-label" id={`qty-${item.id}`}>
                        Quantity
                      </span>
                      <div className="Stepper" aria-labelledby={`qty-${item.id}`}>
                        <button
                          type="button"
                          onClick={() => adjustOrderQuantity(item.id, -1)}
                          disabled={qty === 0}
                          aria-label={`Decrease ${item.name} quantity`}
                        >
                          −
                        </button>
                        <span aria-live="polite">{qty}</span>
                        <button
                          type="button"
                          onClick={() => adjustOrderQuantity(item.id, 1)}
                          aria-label={`Increase ${item.name} quantity`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
              {newItemsFiltered.length === 0 && (
                <p className="Shelf-empty">No items in this aisle yet. Try a different category.</p>
              )}
            </div>

            <footer className="Checkout-bar">
              <div aria-live="polite">
                <strong>Basket:</strong> {totalOrderCount(orderQuantities)} item
                {totalOrderCount(orderQuantities) === 1 ? '' : 's'} selected
              </div>
              <button
                type="button"
                className="Primary-button"
                onClick={handleCheckout}
                disabled={checkoutLoading || totalOrderCount(orderQuantities) === 0}
              >
                {checkoutLoading ? 'Adding to pantry…' : 'Add items to pantry'}
              </button>
            </footer>
          </section>

          <section id="meals-column" className="Panel Panel--meals" aria-label="Meal ideas">
            <header className="Panel-header">
              <h2>Meal ideas</h2>
              <p>Select items on the left and center to see recipes that use as much of your food as possible.</p>
            </header>

            {mealLoading && <p className="Meal-loading">Updating suggestions…</p>}

            {!mealLoading && meals.length === 0 && (
              <p className="Meal-empty">
                Select at least one pantry item or new item to see suggested meals.
              </p>
            )}

            <ul className="Meal-list">
              {meals.map((meal) => {
                const matchPct = Math.round((meal.score || 0) * 100);
                const hasMissingItems =
                  meal.missing_item_names && meal.missing_item_names.length > 0;
                return (
                  <li key={meal.id}>
                    <article className="Meal-card">
                      <header className="Meal-card-header">
                        <h3>{meal.name}</h3>
                        <span className="Meal-score">
                          {matchPct}% match • uses {meal.matched_items} of {meal.total_items} items
                        </span>
                      </header>
                      <div className="Meal-body">
                        <p className="Meal-uses">
                          Uses:{' '}
                          {meal.matched_item_names && meal.matched_item_names.length
                            ? meal.matched_item_names.join(', ')
                            : '—'}
                        </p>
                        {hasMissingItems && (
                          <div>
                            <p className="Meal-missing">
                              Missing: <span>{meal.missing_item_names.join(', ')}</span>
                            </p>
                            <br />
                            <button
                              type="button"
                              className="Primary-button"
                              onClick={() => addMissingItemsToCart(meal)}
                              aria-label={`Add missing items for ${meal.name} to cart`}
                            >
                              + Add missing items to cart
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          </section>
        </section>
      </main>
    </div>
  );
}

export default App;
