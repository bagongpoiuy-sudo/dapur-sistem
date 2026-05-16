
/*
  # Restaurant Order Management System

  1. New Tables
    - `menu_items` - stores all menu items across 3 kitchens
      - `id` (uuid, primary key)
      - `name` (text) - menu item name
      - `price` (numeric) - price
      - `category` (text) - 'cafe', 'pentri', 'restoran'
      - `is_available` (boolean) - whether item is available
      - `created_at` (timestamp)

    - `orders` - stores orders submitted by waiters
      - `id` (uuid, primary key)
      - `table_number` (text) - table or customer identifier
      - `waiter_name` (text)
      - `status` (text) - 'pending', 'processing', 'done', 'paid'
      - `kitchen` (text) - 'cafe', 'pentri', 'restoran'
      - `notes` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `order_items` - items within each order
      - `id` (uuid, primary key)
      - `order_id` (uuid, fk orders)
      - `menu_item_id` (uuid, fk menu_items)
      - `menu_item_name` (text) - snapshot of name at order time
      - `menu_item_price` (numeric) - snapshot of price at order time
      - `quantity` (int)
      - `subtotal` (numeric)
      - `kitchen` (text)
      - `created_at` (timestamp)

    - `cashier_receipts` - finalized receipts saved by cashier
      - `id` (uuid, primary key)
      - `receipt_number` (text, unique)
      - `table_number` (text)
      - `waiter_name` (text)
      - `total_amount` (numeric)
      - `items_snapshot` (jsonb) - full items at time of payment
      - `paid_at` (timestamp)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Policies for authenticated and anon access (restaurant staff use without login)

  3. Seed Data
    - Default menu items for all 3 kitchens
*/

-- Menu Items Table
CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  category text NOT NULL CHECK (category IN ('cafe', 'pentri', 'restoran')),
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read menu items"
  ON menu_items FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert menu items"
  ON menu_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update menu items"
  ON menu_items FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete menu items"
  ON menu_items FOR DELETE
  TO anon, authenticated
  USING (true);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number text NOT NULL DEFAULT '',
  waiter_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'paid')),
  kitchen text NOT NULL CHECK (kitchen IN ('cafe', 'pentri', 'restoran')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read orders"
  ON orders FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert orders"
  ON orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update orders"
  ON orders FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete orders"
  ON orders FOR DELETE
  TO anon, authenticated
  USING (true);

-- Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES menu_items(id) ON DELETE SET NULL,
  menu_item_name text NOT NULL DEFAULT '',
  menu_item_price numeric(10,2) NOT NULL DEFAULT 0,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  kitchen text NOT NULL CHECK (kitchen IN ('cafe', 'pentri', 'restoran')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read order items"
  ON order_items FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert order items"
  ON order_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update order items"
  ON order_items FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete order items"
  ON order_items FOR DELETE
  TO anon, authenticated
  USING (true);

-- Cashier Receipts Table
CREATE TABLE IF NOT EXISTS cashier_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text UNIQUE NOT NULL,
  table_number text NOT NULL DEFAULT '',
  waiter_name text NOT NULL DEFAULT '',
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  items_snapshot jsonb NOT NULL DEFAULT '[]',
  paid_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cashier_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read receipts"
  ON cashier_receipts FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert receipts"
  ON cashier_receipts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update receipts"
  ON cashier_receipts FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Seed default menu items
INSERT INTO menu_items (name, price, category) VALUES
  -- Cafe items (coffee & drinks)
  ('Espresso', 15000, 'cafe'),
  ('Americano', 18000, 'cafe'),
  ('Cappuccino', 22000, 'cafe'),
  ('Latte', 25000, 'cafe'),
  ('Flat White', 25000, 'cafe'),
  ('Cold Brew', 28000, 'cafe'),
  ('Matcha Latte', 28000, 'cafe'),
  ('Teh Tarik', 12000, 'cafe'),
  ('Juice Jeruk', 15000, 'cafe'),
  ('Milkshake Coklat', 30000, 'cafe'),
  -- Pentri items (bread & pastries)
  ('Roti Bakar', 12000, 'pentri'),
  ('Croissant', 18000, 'pentri'),
  ('Sandwich Ayam', 25000, 'pentri'),
  ('Toast Keju', 15000, 'pentri'),
  ('Roti Pisang', 14000, 'pentri'),
  ('Donat', 10000, 'pentri'),
  ('Bruschetta', 20000, 'pentri'),
  ('Club Sandwich', 30000, 'pentri'),
  -- Restoran items (food & drinks)
  ('Nasi Goreng', 30000, 'restoran'),
  ('Mie Goreng', 28000, 'restoran'),
  ('Ayam Bakar', 45000, 'restoran'),
  ('Ikan Bakar', 50000, 'restoran'),
  ('Soto Ayam', 25000, 'restoran'),
  ('Rendang Sapi', 55000, 'restoran'),
  ('Gado-Gado', 22000, 'restoran'),
  ('Es Teh Manis', 8000, 'restoran'),
  ('Air Mineral', 5000, 'restoran'),
  ('Jus Alpukat', 20000, 'restoran')
ON CONFLICT DO NOTHING;
