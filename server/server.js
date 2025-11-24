const express = require('express');
const cors = require('cors');
const db = require('./database');
const path = require('path'); 

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// GET all items
app.get('/api/items', (req, res) => {
  db.all('SELECT * FROM items;', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// GET meals (read-only)
// If `?item_ids=1,2,3` is provided, return the top 5 meals that best match
// the provided item ids (by number of matched ingredients / fraction).
app.get('/api/meals', (req, res) => {
  const itemIdsParam = req.query.item_ids;

  // helper: attach items for given meals
  function attachItemsToMeals(meals, cb) {
    if (!meals || meals.length === 0) return cb(null, []);
    const mealIds = meals.map(m => m.id);
    const placeholders = mealIds.map(() => '?').join(',');
    const sqlItems = `SELECT mi.meal_id, it.* FROM meal_items mi JOIN items it ON mi.item_id = it.id WHERE mi.meal_id IN (${placeholders})`;
    db.all(sqlItems, mealIds, (err, rows) => {
      if (err) return cb(err);
      const map = {};
      rows.forEach(r => {
        map[r.meal_id] = map[r.meal_id] || [];
        map[r.meal_id].push({ id: r.id, name: r.name });
      });
      const out = meals.map(m => Object.assign({}, m, { items: map[m.id] || [] }));
      cb(null, out);
    });
  }

  // If no item_ids param, default to active inventory item ids
  function runMatchWithItemIds(itemIds) {
    if (!itemIds || itemIds.length === 0) return res.status(200).json([]);
    const placeholders = itemIds.map(() => '?').join(',');
    const sql = `
      SELECT m.*,
        COUNT(mi.item_id) AS total_items,
        SUM(CASE WHEN mi.item_id IN (${placeholders}) THEN 1 ELSE 0 END) AS matched_items
      FROM meals m
      JOIN meal_items mi ON mi.meal_id = m.id
      GROUP BY m.id
      HAVING matched_items > 0
      ORDER BY matched_items DESC, (total_items - matched_items) ASC
      LIMIT 5
    `;

    db.all(sql, itemIds, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows || rows.length === 0) return res.json([]);

      attachItemsToMeals(rows, (err2, mealsWithItems) => {
        if (err2) return res.status(500).json({ error: err2.message });

        const itemIdSet = new Set(itemIds);
        const formatted = mealsWithItems.map(m => {
          const items = m.items || [];
          const total = items.length || m.total_items || 0;
          const matchedList = items.filter(it => itemIdSet.has(it.id));
          const matched = matchedList.length || m.matched_items || 0;
          const missingList = items.filter(it => !itemIdSet.has(it.id));
          return {
            id: m.id,
            name: m.name,
            description: m.description,
            total_items: total,
            matched_items: matched,
            score: total ? (matched / total) : 0,
            missing_count: total - matched,
            items: items,
            matched_item_names: matchedList.map(i => i.name),
            missing_item_names: missingList.map(i => i.name),
          };
        });

        res.json(formatted);
      });
    });
  }

  if (!itemIdsParam) {
    // read active inventory item ids
    db.all('SELECT DISTINCT item_id FROM inventory', (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const itemIds = (rows || []).map(r => r.item_id).filter(n => Number.isFinite(n));
      if (!itemIds || itemIds.length === 0) {
        // fallback: return all meals with items
        return db.all('SELECT * FROM meals ORDER BY name;', (err2, meals) => {
          if (err2) return res.status(500).json({ error: err2.message });
          attachItemsToMeals(meals, (err3, mealsWithItems) => {
            if (err3) return res.status(500).json({ error: err3.message });
            res.json(mealsWithItems);
          });
        });
      }
      // otherwise run matching using inventory item ids
      return runMatchWithItemIds(itemIds);
    });
    return;
  }

  // parse comma-separated ids
  const itemIds = String(itemIdsParam).split(',').map(s => parseInt(s, 10)).filter(n => Number.isFinite(n));
  if (itemIds.length === 0) return res.status(400).json({ error: 'item_ids must be a comma-separated list of numbers' });

  return runMatchWithItemIds(itemIds);
});

// Inventory CRUD
// List inventory with item details
app.get('/api/inventory', (req, res) => {
  const sql = `
    SELECT i.*, it.name AS item_name, it.shelf_life_days, it.photo_path AS item_photo_path
    FROM inventory i
    LEFT JOIN items it ON i.item_id = it.id
    ORDER BY i.id DESC
  `;
  db.all(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get inventory item by id
app.get('/api/inventory/:id', (req, res) => {
  const sql = `
    SELECT i.*, it.name AS item_name, it.shelf_life_days, it.photo_path AS item_photo_path
    FROM inventory i
    LEFT JOIN items it ON i.item_id = it.id
    WHERE i.id = ?
  `;
  db.get(sql, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Inventory item not found' });
    res.json(row);
  });
});

// Create inventory item
app.post('/api/inventory', (req, res) => {
  const { item_id, item_name, expiry_date, quantity } = req.body || {};

  // Helper: resolve or create item by id or name
  const ensureItem = (cb) => {
    if (item_id) {
      // verify that item exists
      return db.get('SELECT id FROM items WHERE id = ?', [item_id], (err, row) => {
        if (err) return cb(err);
        if (!row) return cb(new Error('item_id not found'));
        return cb(null, row.id);
      });
    }
    if (!item_name) return cb(new Error('item_id or item_name required'));
    db.get('SELECT id FROM items WHERE name = ?', [item_name], (err, row) => {
      if (err) return cb(err);
      if (row) return cb(null, row.id);
      // create item with only the name (other columns optional)
      db.run('INSERT INTO items (name) VALUES (?)', [item_name], function (err) {
        if (err) return cb(err);
        cb(null, this.lastID);
      });
    });
  };

  ensureItem((err, resolvedItemId) => {
    if (err) return res.status(400).json({ error: err.message });

    // if expiry_date not provided, compute from shelf_life_days if available
    if (expiry_date) {
      insertInventory(resolvedItemId, expiry_date, quantity);
    } else {
      db.get('SELECT shelf_life_days FROM items WHERE id = ?', [resolvedItemId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        let expiry = null;
        if (row && row.shelf_life_days) {
          const d = new Date();
          d.setDate(d.getDate() + row.shelf_life_days);
          expiry = d.toISOString();
        }
        insertInventory(resolvedItemId, expiry, quantity);
      });
    }

    function insertInventory(resolvedItemId, expiry, quantityValue) {
      const qty = (typeof quantityValue === 'undefined' || quantityValue === null) ? 1 : quantityValue;
      const sql = `INSERT INTO inventory (item_id, expiry_date, quantity) VALUES (?, ?, ?)`;
      db.run(sql, [resolvedItemId, expiry, qty], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        db.get('SELECT * FROM inventory WHERE id = ?', [this.lastID], (err, row) => {
          if (err) return res.status(500).json({ error: err.message });
          res.status(201).json(row);
        });
      });
    }
  });
});

// Update inventory item
app.put('/api/inventory/:id', (req, res) => {
  const id = req.params.id;
  const { expiry_date, quantity } = req.body || {};
  const sql = `UPDATE inventory SET expiry_date = COALESCE(?, expiry_date), quantity = COALESCE(?, quantity) WHERE id = ?`;
  db.run(sql, [expiry_date || null, typeof quantity === 'undefined' ? null : quantity, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Inventory item not found' });
    db.get('SELECT * FROM inventory WHERE id = ?', [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row);
    });
  });
});

// Delete inventory item
app.delete('/api/inventory/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM inventory WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Inventory item not found' });
    res.json({ deleted: id });
  });
});

app.use('/pictures', express.static(path.join(__dirname, 'db', 'pictures')));


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});