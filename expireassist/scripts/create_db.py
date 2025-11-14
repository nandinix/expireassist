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
        brand TEXT,
        category TEXT,
        shelf_life_days INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        acquired_at TEXT NOT NULL DEFAULT (datetime('now')),
        expiry_date TEXT,
        cost REAL,
        quantity INTEGER DEFAULT 1,
        unit TEXT,
        bin_name TEXT,
        notes TEXT,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS meals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
    """
    CREATE TABLE IF NOT EXISTS recommendations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        meal_id INTEGER,
        missing_items TEXT, -- JSON array of item names recommended to complete the meal
        score REAL,         -- fraction of meal items already present (0..1)
        notes TEXT,
        FOREIGN KEY(meal_id) REFERENCES meals(id)
    );
    """,
]

INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);",
    "CREATE INDEX IF NOT EXISTS idx_inventory_item ON inventory(item_id);",
    "CREATE INDEX IF NOT EXISTS idx_recommendations_meal ON recommendations(meal_id);",
]

SAMPLE_CATALOG = [
    # 50 items for testing: (name, brand, category, shelf_life_days)
    ("Milk", "Generic", "Dairy", 7),
    ("Eggs", "Generic", "Dairy", 21),
    ("Yogurt", "Generic", "Dairy", 14),
    ("Bread", "Generic", "Bakery", 3),
    ("Bacon", "Generic", "Meat", 7),
    ("Lettuce", "Generic", "Produce", 7),
    ("Tomato", "Generic", "Produce", 7),
    ("Cheese", "Generic", "Dairy", 30),
    ("Pasta", "Generic", "Pantry", 365),
    ("Tomato Sauce", "Generic", "Pantry", 365),
    ("Granola", "Generic", "Pantry", 180),
    ("Berries", "Generic", "Produce", 5),
    ("Chicken Breast", "Generic", "Meat", 3),
    ("Rice", "Generic", "Pantry", 365),
    ("Olive Oil", "Generic", "Pantry", 365),
    ("Garlic", "Generic", "Produce", 30),
    ("Onion", "Generic", "Produce", 30),
    ("Carrots", "Generic", "Produce", 30),
    ("Cucumber", "Generic", "Produce", 7),
    ("Bell Pepper", "Generic", "Produce", 7),
    ("Spinach", "Generic", "Produce", 5),
    ("Avocado", "Generic", "Produce", 5),
    ("Butter", "Generic", "Dairy", 60),
    ("Flour", "Generic", "Pantry", 180),
    ("Sugar", "Generic", "Pantry", 365),
    ("Salt", "Generic", "Pantry", 365),
    ("Black Pepper", "Generic", "Pantry", 365),
    ("Cereal", "Generic", "Pantry", 180),
    ("Orange Juice", "Generic", "Beverages", 7),
    ("Apples", "Generic", "Produce", 30),
    ("Bananas", "Generic", "Produce", 7),
    ("Potatoes", "Generic", "Produce", 60),
    ("Ground Beef", "Generic", "Meat", 2),
    ("Sour Cream", "Generic", "Dairy", 14),
    ("Tortillas", "Generic", "Bakery", 7),
    ("Ham", "Generic", "Meat", 7),
    ("Turkey Slices", "Generic", "Meat", 7),
    ("Mayonnaise", "Generic", "Condiments", 90),
    ("Mustard", "Generic", "Condiments", 365),
    ("Ketchup", "Generic", "Condiments", 365),
    ("Pickles", "Generic", "Condiments", 365),
    ("Coffee", "Generic", "Beverages", 365),
    ("Tea Bags", "Generic", "Beverages", 365),
    ("Chocolate Chips", "Generic", "Pantry", 365),
    ("Nuts Mix", "Generic", "Snacks", 180),
    ("Crackers", "Generic", "Snacks", 90),
    ("Ice Cream", "Generic", "Frozen", 365),
]

# Hard-coded meals (name -> list of required item names)
HARDCODED_MEALS = {
    # 100 meals for testing. Each SAMPLE_CATALOG item appears in at least one meal.
    "BLT Sandwich": ["Bread", "Bacon", "Lettuce", "Tomato"],
    "Yogurt Parfait": ["Yogurt", "Granola", "Berries"],
    "Pasta with Tomato Sauce": ["Pasta", "Tomato Sauce", "Cheese"],
    "Cheese & Eggs Breakfast": ["Eggs", "Cheese", "Bread"],
    "Chicken Stir Fry": ["Chicken Breast", "Bell Pepper", "Onion", "Garlic", "Rice"],
    "Grilled Cheese Sandwich": ["Bread", "Cheese", "Butter"],
    "Caprese Salad": ["Tomato", "Mozzarella", "Basil", "Olive Oil"],
    "Chicken Caesar Salad": ["Chicken Breast", "Romaine Lettuce", "Caesar Dressing", "Croutons"],
    "Vegetable Stir Fry": ["Bell Pepper", "Onion", "Garlic", "Soy Sauce", "Rice"],
    "Beef Tacos": ["Ground Beef", "Tortillas", "Lettuce", "Cheese", "Sour Cream"],
    "Ham & Cheese Sandwich": ["Bread", "Ham", "Cheese", "Mustard"],
    "Turkey Wrap": ["Tortillas", "Turkey Slices", "Lettuce", "Tomato", "Mayonnaise"],
    "Chicken Fajitas": ["Chicken Breast", "Bell Pepper", "Onion", "Tortillas", "Sour Cream"],
    "Veggie Omelette": ["Eggs", "Spinach", "Tomato", "Cheese"],
    "Fruit Smoothie": ["Yogurt", "Berries", "Bananas", "Orange Juice"],
    "Pancakes": ["Flour", "Milk", "Eggs", "Sugar", "Butter"],
    "Scrambled Eggs & Toast": ["Eggs", "Bread", "Butter"],
    "Chicken Sandwich": ["Bread", "Chicken Breast", "Lettuce", "Mayonnaise"],
    "Tomato Soup & Grilled Cheese": ["Tomato", "Tomato Sauce", "Bread", "Cheese"],
    "Bacon & Eggs": ["Bacon", "Eggs", "Toast"],
    "Avocado Toast": ["Bread", "Avocado", "Salt", "Black Pepper"],
    "Garlic Butter Pasta": ["Pasta", "Garlic", "Butter", "Olive Oil"],
    "Rice & Beans": ["Rice", "Tomato Sauce", "Onion"],
    "Cheesy Pasta Bake": ["Pasta", "Cheese", "Tomato Sauce", "Breadcrumbs"],
    "Yogurt & Granola": ["Yogurt", "Granola", "Honey"],
    "Berry Bowl": ["Berries", "Granola", "Yogurt"],
    "Chicken Rice Bowl": ["Chicken Breast", "Rice", "Avocado", "Tomato"],
    "Fish-less Veggie Bowl": ["Rice", "Spinach", "Bell Pepper", "Cucumber"],
    "Breakfast Cereal": ["Cereal", "Milk", "Bananas"],
    "Peanut Butter Toast": ["Bread", "Peanut Butter", "Jam"],
    "Banana Smoothie": ["Bananas", "Milk", "Yogurt"],
    "Apple Slices & Peanut Butter": ["Apples", "Peanut Butter"],
    "Mashed Potatoes": ["Potatoes", "Butter", "Salt", "Black Pepper"],
    "Beef Burger": ["Ground Beef", "Bread", "Cheese", "Pickles"],
    "Chicken Nuggets & Fries": ["Chicken Breast", "Potatoes", "Ketchup"],
    "Veggie Tacos": ["Tortillas", "Avocado", "Tomato", "Lettuce"],
    "Ham Breakfast Sandwich": ["Ham", "Eggs", "Bread"],
    "Turkey & Cheese": ["Turkey Slices", "Cheese", "Bread"],
    "BLT Wrap": ["Tortillas", "Bacon", "Lettuce", "Tomato", "Mayonnaise"],
    "Cheese Quesadilla": ["Tortillas", "Cheese", "Butter"],
    "Chocolate Chip Cookies": ["Flour", "Sugar", "Butter", "Chocolate Chips", "Eggs"],
    "Trail Mix Snack": ["Nuts Mix", "Chocolate Chips", "Dried Fruit"],
    "Crackers & Cheese": ["Crackers", "Cheese"],
    "Ice Cream Sundae": ["Ice Cream", "Chocolate Chips", "Nuts Mix", "Syrup"],
    "Oven Roasted Vegetables": ["Carrots", "Potatoes", "Onion", "Olive Oil"],
    "Tomato & Cucumber Salad": ["Tomato", "Cucumber", "Olive Oil", "Salt"],
    "Stir Fry Noodles": ["Pasta", "Bell Pepper", "Onion", "Soy Sauce"],
    "Chicken Salad": ["Chicken Breast", "Lettuce", "Mayonnaise", "Croutons"],
    "Egg Salad Sandwich": ["Eggs", "Mayonnaise", "Bread", "Lettuce"],
    "Ham & Egg Omelette": ["Ham", "Eggs", "Cheese"],
    "Sour Cream Dip": ["Sour Cream", "Onion", "Garlic", "Salt"],
    "Breakfast Burrito": ["Tortillas", "Eggs", "Cheese", "Sausage"],
    "Veggie Pizza": ["Flour", "Tomato Sauce", "Cheese", "Bell Pepper", "Onion"],
    "Spicy Pasta": ["Pasta", "Tomato Sauce", "Black Pepper", "Garlic"],
    "Chicken & Potatoes": ["Chicken Breast", "Potatoes", "Olive Oil", "Salt"],
    "Avocado Salad": ["Avocado", "Tomato", "Onion", "Lettuce"],
    "Cereal with Berries": ["Cereal", "Milk", "Berries"],
    "Hot Coffee": ["Coffee", "Sugar", "Milk"],
    "Tea & Biscuits": ["Tea Bags", "Crackers", "Sugar"],
    "Chocolate Chip Pancakes": ["Flour", "Chocolate Chips", "Milk", "Eggs"],
    "Nutty Granola Bowl": ["Granola", "Nuts Mix", "Yogurt"],
    "Stuffed Peppers": ["Bell Pepper", "Ground Beef", "Rice", "Tomato Sauce"],
    "Turkey Sandwich": ["Bread", "Turkey Slices", "Lettuce", "Mustard"],
    "Ham & Egg Wrap": ["Tortillas", "Ham", "Eggs", "Cheese"],
    "Pickle & Cheese Snack": ["Pickles", "Cheese", "Crackers"],
    "Ketchup Fries": ["Potatoes", "Ketchup", "Salt"],
    "Mayonnaise Salad": ["Lettuce", "Tomato", "Mayonnaise"],
    "Mustard Ham Bites": ["Ham", "Mustard", "Crackers"],
    "Iced Tea": ["Tea Bags", "Sugar", "Ice"],
    "Coffee & Donut": ["Coffee", "Sugar", "Milk", "Donut"],
    "Banana Bread": ["Bananas", "Flour", "Sugar", "Eggs"],
    "Apple Pie": ["Apples", "Flour", "Sugar", "Butter"],
    "Rice Pudding": ["Rice", "Milk", "Sugar", "Cinnamon"],
    "Masala Potatoes": ["Potatoes", "Onion", "Garlic", "Salt", "Black Pepper"],
    "Tuna Sandwich": ["Bread", "Mayonnaise", "Pickles", "Tuna"],
    "Sausage Platter": ["Ham", "Bacon", "Turkey Slices", "Mustard"],
    "Vegetarian Wrap": ["Tortillas", "Spinach", "Avocado", "Tomato", "Cucumber"],
    "Chicken & Rice Soup": ["Chicken Breast", "Carrots", "Onion", "Rice"],
    "Creamy Pasta": ["Pasta", "Butter", "Cream", "Cheese"],
    "Sweet Breakfast Bowl": ["Cereal", "Milk", "Bananas", "Berries"],
    "Chocolate Chip Muffins": ["Flour", "Sugar", "Chocolate Chips", "Eggs"],
    "Nuts & Chocolate Snack": ["Nuts Mix", "Chocolate Chips", "Crackers"],
    "Ice Cream Sandwich": ["Ice Cream", "Cookies", "Chocolate Chips"],
    "Simple Salad": ["Lettuce", "Tomato", "Cucumber", "Olive Oil", "Salt"],
    "Spicy Beans": ["Tomato Sauce", "Onion", "Garlic", "Salt", "Black Pepper"],
    "Cheese Plate": ["Cheese", "Crackers", "Nuts Mix", "Pickles"],
    "Egg & Cheese Bagel": ["Eggs", "Cheese", "Bread", "Butter"],
    "Berries & Cream": ["Berries", "Cream", "Sugar"],
    "Toast with Jam": ["Bread", "Jam", "Butter"],
    "Garlic Bread": ["Bread", "Garlic", "Butter"],
    "Stuffed Tomatoes": ["Tomato", "Rice", "Cheese"],
    "Avocado Smoothie": ["Avocado", "Milk", "Honey"],
    "Tomato Bruschetta": ["Bread", "Tomato", "Basil", "Olive Oil"],
    "Potato Salad": ["Potatoes", "Mayonnaise", "Onion", "Salt"],
    "Chicken Quesadilla": ["Tortillas", "Chicken Breast", "Cheese", "Sour Cream"],
    "BBQ Beef": ["Ground Beef", "Ketchup", "Sugar", "Black Pepper"],
    "Honey Butter Toast": ["Bread", "Butter", "Honey"],
    "Granola Snack Bar": ["Granola", "Nuts Mix", "Honey", "Chocolate Chips"],
    "Veggie Plate": ["Carrots", "Cucumber", "Bell Pepper", "Pickles"],
    "Cheesy Potatoes": ["Potatoes", "Cheese", "Butter"],
    "Cereal & Milk": ["Cereal", "Milk"],
    "Hot Chocolate": ["Chocolate Chips", "Milk", "Sugar"],
    "Avocado & Egg Salad": ["Avocado", "Eggs", "Mayonnaise", "Salt"],
    "Spicy Chicken": ["Chicken Breast", "Chili Powder", "Garlic", "Salt"],
    "Sweet Ice Cream Treat": ["Ice Cream", "Berries", "Chocolate Chips"],
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
    for name, brand, category, shelf in SAMPLE_CATALOG:
        cur.execute(
            "INSERT OR IGNORE INTO items (name, brand, category, shelf_life_days) VALUES (?, ?, ?, ?)",
            (name, brand, category, shelf),
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
        cur.execute("INSERT OR IGNORE INTO meals (name, description) VALUES (?, ?)", (meal_name, None))
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
        inventory_rows.append((item_id, expiry, 3.0, 1, "each", "Fridge", f"sample {name}"))

    cur.executemany(
        "INSERT INTO inventory (item_id, expiry_date, cost, quantity, unit, bin_name, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
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