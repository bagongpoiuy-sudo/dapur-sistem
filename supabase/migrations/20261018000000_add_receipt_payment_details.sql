ALTER TABLE cashier_receipts
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash', 'qris', 'transfer')),
  ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2) NOT NULL DEFAULT 0;

UPDATE cashier_receipts
SET amount_paid = total_amount
WHERE amount_paid = 0;
