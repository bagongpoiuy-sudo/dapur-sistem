ALTER TABLE menu_items
  DROP CONSTRAINT IF EXISTS menu_items_category_check;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_kitchen_check;

ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_kitchen_check;

UPDATE menu_items
SET category = 'pastry'
WHERE category = 'pentri';

UPDATE orders
SET kitchen = 'pastry'
WHERE kitchen = 'pentri';

UPDATE order_items
SET kitchen = 'pastry'
WHERE kitchen = 'pentri';

UPDATE cashier_receipts AS receipt
SET items_snapshot = (
  SELECT jsonb_agg(
    CASE
      WHEN item.value->>'kitchen' = 'pentri'
        THEN jsonb_set(item.value, '{kitchen}', '"pastry"'::jsonb)
      ELSE item.value
    END
    ORDER BY item.ordinality
  )
  FROM jsonb_array_elements(receipt.items_snapshot) WITH ORDINALITY AS item(value, ordinality)
)
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements(receipt.items_snapshot) AS item(value)
  WHERE item.value->>'kitchen' = 'pentri'
);

ALTER TABLE menu_items
  ADD CONSTRAINT menu_items_category_check
  CHECK (category IN ('cafe', 'pastry', 'prasmanan', 'restoran'));

ALTER TABLE orders
  ADD CONSTRAINT orders_kitchen_check
  CHECK (kitchen IN ('cafe', 'pastry', 'prasmanan', 'restoran'));

ALTER TABLE order_items
  ADD CONSTRAINT order_items_kitchen_check
  CHECK (kitchen IN ('cafe', 'pastry', 'prasmanan', 'restoran'));
