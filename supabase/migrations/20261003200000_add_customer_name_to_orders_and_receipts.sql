ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_name text NOT NULL DEFAULT '';

ALTER TABLE cashier_receipts
  ADD COLUMN IF NOT EXISTS customer_name text NOT NULL DEFAULT '';
