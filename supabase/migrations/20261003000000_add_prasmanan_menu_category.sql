ALTER TABLE menu_items
  DROP CONSTRAINT IF EXISTS menu_items_category_check;

ALTER TABLE menu_items
  ADD CONSTRAINT menu_items_category_check
  CHECK (category IN ('cafe', 'pentri', 'prasmanan', 'restoran'));

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_kitchen_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_kitchen_check
  CHECK (kitchen IN ('cafe', 'pentri', 'prasmanan', 'restoran'));

ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_kitchen_check;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_kitchen_check
  CHECK (kitchen IN ('cafe', 'pentri', 'prasmanan', 'restoran'));
