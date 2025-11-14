import sqlite3
import os

# Point to the database created by create_db.py
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.normpath(os.path.join(SCRIPT_DIR, '..', '..', 'server', 'db', 'expireassist.db'))

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# Update photo paths for each of the 20 items
updates = [
    ("Milk", "pictures/milk.jpg"),
    ("Eggs", "pictures/eggs.jpg"),
    ("Yogurt", "pictures/yogurt.jpg"),
    ("Bread", "pictures/bread.jpg"),
    ("Bacon", "pictures/bacon.jpg"),
    ("Lettuce", "pictures/lettuce.jpg"),
    ("Tomato", "pictures/tomato.jpg"),
    ("Cheese", "pictures/cheese.jpg"),
    ("Pasta", "pictures/pasta.jpg"),
    ("Tomato Sauce", "pictures/tomato_sauce.jpg"),
    ("Granola", "pictures/granola.jpg"),
    ("Berries", "pictures/berries.jpg"),
    ("Chicken Breast", "pictures/chicken_breast.jpg"),
    ("Rice", "pictures/rice.jpg"),
    ("Olive Oil", "pictures/olive_oil.jpg"),
    ("Garlic", "pictures/garlic.jpg"),
    ("Onion", "pictures/onion.jpg"),
    ("Carrots", "pictures/carrots.jpg"),
    ("Butter", "pictures/butter.jpg"),
    ("Potatoes", "pictures/potatoes.jpg"),
]

for item_name, photo_path in updates:
    cur.execute("UPDATE items SET photo_path = ? WHERE name = ?", (photo_path, item_name))
    print(f"Updated {item_name} → {photo_path}")

conn.commit()

# Show results
cur.execute("SELECT id, name, photo_path FROM items")
rows = cur.fetchall()
print("\nAll items:")
for row in rows:
    print(f"  ID: {row[0]}, Name: {row[1]}, Photo: {row[2]}")

conn.close()
print(f"\nTotal items updated: {cur.rowcount}")