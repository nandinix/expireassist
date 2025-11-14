"""
Create a simple SQLite database for the prototype (no users).

Generates `expireassist.db` in the project root (one level up from this script).

This version creates:
- items (catalog)
- inventory (what items are currently in the prototype inventory)
- meals + meal_items (hard-coded meal combos used for recommendations)
- recommendations (generated suggestions to complete a meal)

It also includes a simple function that generates recommendations by
checking which meals are partially satisfied by inventory and returning
the missing items needed to complete each meal.

Run:
    python scripts/create_db.py
"""
import json
import os
import sqlite3
from datetime import datetime, timedelta

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.normpath(os.path.join(SCRIPT_DIR, '..', 'expireassist.db'))

SCHEMA = [
    """
    CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        category TEXT,
        photo_path TEXT,
        shelf_life_days INTEGER
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        acquired_at TEXT NOT NULL DEFAULT (datetime('now')),
        expiry_date TEXT,
        quantity INTEGER DEFAULT 1,
        FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS meals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS meal_items (
        meal_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        PRIMARY KEY(meal_id, item_id),
        FOREIGN KEY(meal_id) REFERENCES meals(id) ON DELETE CASCADE,
        FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
    );
    """,
]

INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);",
    "CREATE INDEX IF NOT EXISTS idx_inventory_item ON inventory(item_id);",
]

SAMPLE_CATALOG = [
    # 20 items for the adjusted prototype: (name, brand, category, shelf_life_days)
    ("Milk", "Dairy", 7),
    ("Eggs", "Dairy", 21),
    ("Yogurt", "Dairy", 14),
    ("Bread", "Bakery", 3),
    ("Bacon", "Meat", 7),
    ("Lettuce", "Produce", 7),
    ("Tomato", "Produce", 7),
    ("Cheese", "Dairy", 30),
    ("Pasta", "Pantry", 365),
    ("Tomato Sauce", "Pantry", 365),
    ("Granola", "Pantry", 180),
    ("Berries", "Produce", 5),
    ("Chicken Breast", "Meat", 3),
    ("Rice", "Pantry", 365),
    ("Olive Oil", "Pantry", 365),
    ("Garlic", "Produce", 30),
    ("Onion", "Produce", 30),
    ("Carrots", "Produce", 30),
    ("Butter", "Dairy", 60),
    ("Potatoes", "Produce", 60),
]

# Hard-coded meals (name -> list of required item names)
HARDCODED_MEALS = {
    # 35 meals built only from the 20 SAMPLE_CATALOG items
    "BLT Sandwich": ["Bread", "Bacon", "Lettuce", "Tomato"],
    "Yogurt Parfait": ["Yogurt", "Granola", "Berries"],
    "Pasta with Tomato Sauce": ["Pasta", "Tomato Sauce", "Cheese"],
    "Cheese & Eggs Breakfast": ["Eggs", "Cheese", "Bread"],
    "Chicken Stir Fry": ["Chicken Breast", "Carrots", "Onion", "Garlic", "Rice"],
    "Grilled Cheese Sandwich": ["Bread", "Cheese", "Butter"],
    "Tomato & Cheese Salad": ["Tomato", "Cheese", "Olive Oil"],
    "Chicken Rice Bowl": ["Chicken Breast", "Rice", "Tomato"],
    "Vegetable Pasta": ["Pasta", "Carrots", "Onion", "Garlic", "Olive Oil"],
    "Bacon & Eggs": ["Bacon", "Eggs", "Bread"],
    "Bread & Tomato Toast": ["Bread", "Tomato", "Olive Oil"],
    "Garlic Butter Pasta": ["Pasta", "Garlic", "Butter", "Olive Oil"],
    "Rice & Tomato Sauce": ["Rice", "Tomato Sauce", "Onion"],
    "Cheesy Pasta Bake": ["Pasta", "Cheese", "Tomato Sauce"],
    "Yogurt & Granola": ["Yogurt", "Granola"],
    "Berry Bowl": ["Berries", "Granola", "Yogurt"],
    "Chicken Sandwich": ["Bread", "Chicken Breast", "Lettuce"],
    "Tomato Soup & Grilled Cheese": ["Tomato", "Tomato Sauce", "Bread", "Cheese"],
    "Scrambled Eggs & Toast": ["Eggs", "Bread", "Butter"],
    "Mashed Potatoes": ["Potatoes", "Butter", "Milk"],
    "Chicken & Potatoes": ["Chicken Breast", "Potatoes", "Olive Oil"],
    "Cereal Breakfast": ["Granola", "Milk", "Berries"],
    "Bacon Sandwich": ["Bread", "Bacon", "Butter"],
    "Cheese Plate": ["Cheese", "Bread"],
    "Potato & Onion Roast": ["Potatoes", "Onion", "Olive Oil"],
    "Garlic Rice": ["Rice", "Garlic", "Olive Oil"],
    "Simple Salad": ["Lettuce", "Tomato", "Onion", "Olive Oil"],
    "Carrot Stir Fry": ["Carrots", "Onion", "Garlic", "Olive Oil"],
    "Breakfast Bowl": ["Eggs", "Potatoes", "Bacon"],
    "Tomato Pasta": ["Pasta", "Tomato", "Olive Oil", "Garlic"],
    "Buttered Rice": ["Rice", "Butter"],
    "Chicken Pasta": ["Chicken Breast", "Pasta", "Tomato Sauce"],
    "Roasted Vegetables": ["Carrots", "Potatoes", "Onion", "Olive Oil"],
    "Eggs & Yogurt Combo": ["Eggs", "Yogurt"],
    "Cheesy Potatoes": ["Potatoes", "Cheese", "Butter"],
}


def create_db(path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)

    conn = sqlite3.connect(path)
    conn.execute("PRAGMA foreign_keys = ON;")
    cur = conn.cursor()

    for sql in SCHEMA:
        cur.execute(sql)
    for sql in INDEXES:
        cur.execute(sql)


    # seed items (include shelf_life_days)
    for name, category, shelf in SAMPLE_CATALOG:
        cur.execute(
            "INSERT OR IGNORE INTO items (name, category, shelf_life_days) VALUES (?, ?, ?)",
            (name, category, shelf),
        )

    # map item names -> ids and shelf life
    cur.execute("SELECT id, name, shelf_life_days FROM items")
    item_map = {}
    shelf_map = {}
    for iid, name, shelf in cur.fetchall():
        item_map[name] = iid
        shelf_map[name] = shelf if shelf is not None else 0

    # seed meals and meal_items from HARDCODED_MEALS
    for meal_name, req_items in HARDCODED_MEALS.items():
        cur.execute("INSERT OR IGNORE INTO meals (name) VALUES (?)", (meal_name,))
        cur.execute("SELECT id FROM meals WHERE name = ?", (meal_name,))
        meal_id = cur.fetchone()[0]
        for item_name in req_items:
            item_id = item_map.get(item_name)
            if item_id is None:
                # if a required item is missing from catalog, create it with a default shelf life
                default = 7
                cur.execute("INSERT INTO items (name, shelf_life_days) VALUES (?, ?)", (item_name, default))
                item_id = cur.lastrowid
                item_map[item_name] = item_id
                shelf_map[item_name] = default
            cur.execute("INSERT OR IGNORE INTO meal_items (meal_id, item_id) VALUES (?, ?)", (meal_id, item_id))

    # seed a small prototype inventory (no users)
    # We'll populate inventory with a subset of the SAMPLE_CATALOG to demonstrate recommendations.
    now = datetime.utcnow()
    sample_inventory_names = ["Bread", "Eggs", "Yogurt", "Tomato"]
    inventory_rows = []
    for name in sample_inventory_names:
        item_id = item_map.get(name)
        if item_id is None:
            continue
        shelf_days = shelf_map.get(name) or 7
        expiry = (now + timedelta(days=shelf_days)).isoformat()
        inventory_rows.append((item_id, expiry, 1))

    cur.executemany(
        "INSERT INTO inventory (item_id, expiry_date, quantity) VALUES (?, ?, ?)",
        inventory_rows,
    )

    conn.commit()
    return conn


def print_summary(conn: sqlite3.Connection):
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM items")
    items_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM inventory")
    inv_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM meals")
    meals_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM meal_items")
    meal_items_count = cur.fetchone()[0]
    print(f"items: {items_count}, inventory rows: {inv_count}, meals: {meals_count}, meal_items: {meal_items_count}")


if __name__ == "__main__":
    print(f"Creating SQLite DB at: {DB_PATH}")
    conn = create_db(DB_PATH)
    print_summary(conn)

    conn.close()