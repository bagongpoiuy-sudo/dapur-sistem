import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Kitchen = 'cafe' | 'pentri' | 'restoran';
export type OrderStatus = 'pending' | 'processing' | 'done' | 'paid';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: Kitchen;
  is_available: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  table_number: string;
  waiter_name: string;
  status: OrderStatus;
  kitchen: Kitchen;
  notes: string;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  menu_item_name: string;
  menu_item_price: number;
  quantity: number;
  subtotal: number;
  kitchen: Kitchen;
  created_at: string;
}

export interface CashierReceipt {
  id: string;
  receipt_number: string;
  table_number: string;
  waiter_name: string;
  total_amount: number;
  items_snapshot: ReceiptItem[];
  paid_at: string;
  created_at: string;
}

export interface ReceiptItem {
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  kitchen: Kitchen;
}

export const KITCHEN_LABELS: Record<Kitchen, string> = {
  cafe: 'Dapur Cafe',
  pentri: 'Dapur Pentri',
  restoran: 'Dapur Restoran',
};

export const KITCHEN_COLORS: Record<Kitchen, { bg: string; text: string; border: string; badge: string }> = {
  cafe: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  pentri: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  restoran: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
};

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

export function generateReceiptNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.getTime().toString().slice(-6);
  return `RCP-${date}-${time}`;
}
