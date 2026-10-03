import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, Printer, Loader2, RefreshCw, CreditCard, Table2, User, ChevronDown, ChevronUp, Lock, Unlock } from 'lucide-react';
import { supabase, Order, Kitchen, KITCHEN_LABELS, KITCHEN_COLORS, formatCurrency, generateReceiptNumber } from '../lib/supabase';
import { connectBluetoothPrinter, getBluetoothPrinterName, isBluetoothPrinterConnected, isBluetoothPrinterSupported, printBluetoothReceipt } from '../lib/bluetoothPrinter';

export default function CashierPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [paying, setPaying] = useState<string | null>(null);
  const [cashierName, setCashierName] = useState<string>('');
  const [cashierLocked, setCashierLocked] = useState<boolean>(false);
  const [printerLoading, setPrinterLoading] = useState(false);
  const [printerName, setPrinterName] = useState(getBluetoothPrinterName);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('status', 'done')
      .order('updated_at', { ascending: false });
    setOrders(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') fetchOrders();
    }, 2000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchOrders();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const channel = supabase.channel('cashier-orders')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => fetchOrders())
      .subscribe();
    return () => {
      window.clearInterval(refreshTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  useEffect(() => {
    const timer = window.setInterval(() => setPrinterName(getBluetoothPrinterName()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('cashier_name');
      const locked = localStorage.getItem('cashier_locked') === 'true';
      if (stored) setCashierName(stored);
      if (locked) setCashierLocked(true);
    } catch (e) {
      // ignore in non-browser environments
    }
  }, []);

  // Group orders by table
  const tableGroups = orders.reduce<Record<string, Order[]>>((acc, o) => {
    const key = `${o.table_number}__${o.waiter_name}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(o);
    return acc;
  }, {});

  async function processPayment(tableKey: string) {
    const tableOrders = tableGroups[tableKey];
    const [tableNumber, waiterName] = tableKey.split('__');
    setPaying(tableKey);

    const allItems = tableOrders.flatMap(o =>
      (o.order_items || []).map(i => ({
        name: i.menu_item_name,
        price: i.menu_item_price,
        quantity: i.quantity,
        subtotal: i.subtotal,
        kitchen: i.kitchen as Kitchen,
      }))
    );

    const total = allItems.reduce((s, i) => s + i.subtotal, 0);
    const receiptNumber = generateReceiptNumber();

      await supabase.from('cashier_receipts').insert({
        receipt_number: receiptNumber,
        table_number: tableNumber,
        waiter_name: waiterName,
        cashier_name: cashierName || '',
        total_amount: total,
        items_snapshot: allItems,
        paid_at: new Date().toISOString(),
      });

    for (const o of tableOrders) {
      await supabase.from('orders').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('id', o.id);
    }

    setPaying(null);
    fetchOrders();

    // Print receipt
      printReceipt({ receiptNumber, tableNumber, waiterName, cashierName, items: allItems, total });
  }

  function printReceipt({ receiptNumber, tableNumber, waiterName, items, total }: {
    receiptNumber: string; tableNumber: string; waiterName: string; cashierName?: string;
    items: { name: string; price: number; quantity: number; subtotal: number; kitchen: Kitchen }[];
    total: number;
  }) {
    const kitchens: Kitchen[] = ['cafe', 'pentri', 'prasmanan', 'restoran'];
    const grouped = kitchens.reduce<Record<string, typeof items>>((acc, k) => {
      acc[k] = items.filter(i => i.kitchen === k);
      return acc;
    }, {} as Record<string, typeof items>);

    if (isBluetoothPrinterSupported()) {
      if (!isBluetoothPrinterConnected()) {
        alert('Hubungkan printer Bluetooth terlebih dahulu sebelum mencetak struk.');
        return;
      }

      const width = 48;
      const line = (left: string, right: string) =>
        `${left.slice(0, Math.max(0, width - right.length)).padEnd(Math.max(0, width - right.length))}${right}`;
      const text = [
        'Resto Kecombrang',
        'Jl. Pakem - Kalasan, Kledoan,',
        'Selomartani, Kec. Kalasan,',
        'Kabupaten Sleman, Daerah Istimewa',
        'Yogyakarta 55571',
        'Struk Pembayaran',
        '-'.repeat(width),
        line('No. Struk', receiptNumber),
        line('Meja', tableNumber),
        line('Pelayan', waiterName),
        line('Kasir', cashierName || ''),
        line('Waktu', new Date().toLocaleString('id-ID')),
        '-'.repeat(width),
        ...kitchens.flatMap(k => grouped[k]?.length
          ? [`[${KITCHEN_LABELS[k]}]`, ...grouped[k].map(i =>
            `${i.quantity}x ${i.name}\n${line('', formatCurrency(i.subtotal))}`
          )]
          : []),
        '-'.repeat(width),
        line('TOTAL', formatCurrency(total)),
        '',
        'Terima kasih atas kunjungan Anda!',
        '',
        '',
      ].join('\n');

      void printBluetoothReceipt(text).catch((error: unknown) => {
        alert(error instanceof Error ? error.message : 'Gagal mengirim struk ke printer.');
      });
      return;
    }

    const html = `
<!DOCTYPE html><html><head><title>Struk #${receiptNumber}</title>
<style>
  body{font-family:monospace;width:100%;max-width:380px;box-sizing:border-box;margin:0 auto;padding:16px;font-size:12px;}
  h2{text-align:center;margin:0;font-size:16px;}
  .address{text-align:center;margin:4px 0;font-size:10px;}
  .divider{border-top:1px dashed #000;margin:8px 0;}
  .row{display:flex;justify-content:space-between;}
  .section-title{font-weight:bold;margin:6px 0 3px;}
  .total{font-weight:bold;font-size:14px;}
  .footer{text-align:center;margin-top:12px;font-size:11px;}
  @media print{body{max-width:380px;}}
</style></head><body>
<h2>Resto Kecombrang</h2>
<p class="address">Jl. Pakem - Kalasan, Kledoan, Selomartani, Kec. Kalasan, Kabupaten Sleman, Daerah Istimewa Yogyakarta 55571</p>
<p style="text-align:center;margin:4px 0;">Struk Pembayaran</p>
<div class="divider"></div>
<div class="row"><span>No. Struk</span><span>${receiptNumber}</span></div>
<div class="row"><span>Meja</span><span>${tableNumber}</span></div>
<div class="row"><span>Pelayan</span><span>${waiterName}</span></div>
<div class="row"><span>Kasir</span><span>${cashierName || ''}</span></div>
<div class="row"><span>Waktu</span><span>${new Date().toLocaleString('id-ID')}</span></div>
<div class="divider"></div>
${kitchens.filter(k => grouped[k]?.length).map(k => `
<p class="section-title">[${KITCHEN_LABELS[k]}]</p>
${grouped[k].map(i => `<div class="row"><span>${i.quantity}x ${i.name}</span><span>${formatCurrency(i.subtotal)}</span></div>`).join('')}
`).join('')}
<div class="divider"></div>
<div class="row total"><span>TOTAL</span><span>${formatCurrency(total)}</span></div>
<div class="footer"><p>Terima kasih atas kunjungan Anda!</p></div>
</body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  async function connectPrinter() {
    setPrinterLoading(true);
    try {
      setPrinterName(await connectBluetoothPrinter());
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Gagal menghubungkan printer Bluetooth.');
    } finally {
      setPrinterLoading(false);
    }
  }

  const tableKeys = Object.keys(tableGroups);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard size={24} className="text-rose-500" />
            Kasir
          </h1>
          <p className="text-gray-500 text-sm mt-1">Pesanan siap dibayar</p>
        </div>
          <div className="flex items-center gap-3">
            {isBluetoothPrinterSupported() && (
              <button
                onClick={connectPrinter}
                disabled={printerLoading}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {printerLoading ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                {isBluetoothPrinterConnected() ? printerName : 'Hubungkan Printer'}
              </button>
            )}
            <input
              value={cashierName}
              onChange={(e) => {
                if (cashierLocked) return;
                setCashierName(e.target.value);
                try { localStorage.setItem('cashier_name', e.target.value); } catch (e) {}
              }}
              placeholder="Nama Kasir"
              disabled={cashierLocked}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm"
            />
            <button
              onClick={() => {
                if (!cashierLocked) {
                  if (!cashierName.trim()) { alert('Masukkan nama kasir sebelum mengunci'); return; }
                  setCashierLocked(true);
                  try { localStorage.setItem('cashier_locked', 'true'); localStorage.setItem('cashier_name', cashierName); } catch (e) {}
                } else {
                  if (!confirm('Lepaskan kunci nama kasir?')) return;
                  setCashierLocked(false);
                  try { localStorage.removeItem('cashier_locked'); } catch (e) {}
                }
              }}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {cashierLocked ? <Lock size={14} /> : <Unlock size={14} />}
              {cashierLocked ? 'Terkunci' : 'Kunci'}
            </button>
            <button onClick={fetchOrders} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-gray-400" />
        </div>
      ) : tableKeys.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <CheckCircle size={48} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">Tidak ada pesanan yang perlu dibayar</p>
          <p className="text-gray-400 text-sm mt-1">Pesanan akan muncul di sini ketika dapur menandai selesai</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tableKeys.map(key => {
            const tableOrders = tableGroups[key];
            const [tableNumber, waiterName] = key.split('__');
            const allItems = tableOrders.flatMap(o => o.order_items || []);
            const total = allItems.reduce((s, i) => s + i.subtotal, 0);
            const kitchens = [...new Set(tableOrders.map(o => o.kitchen))] as Kitchen[];
            const isExpanded = expanded[key] ?? true;

            return (
              <div key={key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpanded(prev => ({ ...prev, [key]: !isExpanded }))}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Table2 size={16} className="text-gray-400" />
                        <span className="font-bold text-gray-900 text-lg">{tableNumber}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <User size={11} className="text-gray-300" />
                        <span className="text-xs text-gray-400">{waiterName}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {kitchens.map(k => (
                        <span key={k} className={`text-xs px-2 py-0.5 rounded-full font-medium ${KITCHEN_COLORS[k].badge}`}>
                          {KITCHEN_LABELS[k].replace('Dapur ', '')}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-900">{formatCurrency(total)}</span>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4">
                    {kitchens.map(k => {
                      const kItems = allItems.filter(i => i.kitchen === k);
                      if (!kItems.length) return null;
                      return (
                        <div key={k} className="mb-3">
                          <p className={`text-xs font-bold uppercase tracking-wider ${KITCHEN_COLORS[k].text} mb-2`}>
                            {KITCHEN_LABELS[k]}
                          </p>
                          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                            {kItems.map(item => (
                              <div key={item.id} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${KITCHEN_COLORS[k].badge}`}>
                                    {item.quantity}x
                                  </span>
                                  <span className="text-sm text-gray-800">{item.menu_item_name}</span>
                                </div>
                                <span className="text-sm text-gray-600">{formatCurrency(item.subtotal)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div>
                        <p className="text-xs text-gray-400">{allItems.reduce((s, i) => s + i.quantity, 0)} item</p>
                        <p className="font-bold text-xl text-gray-900">{formatCurrency(total)}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const items = allItems.map(i => ({
                              name: i.menu_item_name, price: i.menu_item_price,
                              quantity: i.quantity, subtotal: i.subtotal, kitchen: i.kitchen as Kitchen
                            }));
                            printReceipt({ receiptNumber: 'PREVIEW', tableNumber, waiterName, cashierName, items, total });
                          }}
                          className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm"
                        >
                          <Printer size={15} />
                          Preview
                        </button>
                        <button
                          onClick={() => processPayment(key)}
                          disabled={paying === key}
                          className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white font-semibold rounded-xl transition-colors text-sm"
                        >
                          {paying === key ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                          Bayar & Simpan
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
