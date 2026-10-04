ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) NOT NULL DEFAULT 0;

ALTER TABLE menu_items
  DROP CONSTRAINT IF EXISTS menu_items_discount_percent_check;

ALTER TABLE menu_items
  ADD CONSTRAINT menu_items_discount_percent_check
  CHECK (discount_percent >= 0 AND discount_percent <= 100);
