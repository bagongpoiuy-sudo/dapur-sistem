import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, Printer, Loader2, RefreshCw, CreditCard, Table2, User, ChevronDown, ChevronUp, Lock, Unlock, Pencil, Save, X } from 'lucide-react';
import { supabase, Order, OrderItem, MenuItem, Kitchen, KITCHEN_LABELS, KITCHEN_COLORS, formatCurrency, generateReceiptNumber, getDiscountedPrice } from '../lib/supabase';
import { connectBluetoothPrinter, getBluetoothPrinterName, isBluetoothPrinterConnected, isBluetoothPrinterSupported, printBluetoothReceipt } from '../lib/bluetoothPrinter';

interface OrderItemDraft {
  id?: string;
  menuItemId: string | null;
  name: string;
  price: number;
  quantity: number;
  kitchen: Kitchen;
}

export default function CashierPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [paying, setPaying] = useState<string | null>(null);
  const [cashierName, setCashierName] = useState<string>('');
  const [cashierLocked, setCashierLocked] = useState<boolean>(false);
  const [printerLoading, setPrinterLoading] = useState(false);
  const [printerName, setPrinterName] = useState(getBluetoothPrinterName);
  const [editingTableKey, setEditingTableKey] = useState<string | null>(null);
  const [tableDraft, setTableDraft] = useState('');
  const [updatingTable, setUpdatingTable] = useState(false);
  const [editingOrderKey, setEditingOrderKey] = useState<string | null>(null);
  const [orderItemDraft, setOrderItemDraft] = useState<OrderItemDraft[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [newMenuItemId, setNewMenuItemId] = useState('');
  const [savingOrder, setSavingOrder] = useState(false);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .neq('status', 'paid')
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
    const key = JSON.stringify([o.table_number, o.waiter_name, o.customer_name]);
    if (!acc[key]) acc[key] = [];
    acc[key].push(o);
    return acc;
  }, {});

  async function processPayment(tableKey: string) {
    const tableOrders = tableGroups[tableKey];
    if (tableOrders.some(order => order.status !== 'done')) {
      alert('Pesanan belum selesai diproses oleh semua dapur.');
      return;
    }
    const { table_number: tableNumber, waiter_name: waiterName, customer_name: customerName } = tableOrders[0];
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
        customer_name: customerName,
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
      printReceipt({ receiptNumber, tableNumber, waiterName, customerName, cashierName, items: allItems, total });
  }

  function printReceipt({ receiptNumber, tableNumber, waiterName, customerName, items, total }: {
    receiptNumber: string; tableNumber: string; waiterName: string; customerName: string; cashierName?: string;
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
        ...(customerName ? [line('Pelanggan', customerName)] : []),
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
${customerName ? `<div class="row"><span>Pelanggan</span><span>${customerName}</span></div>` : ''}
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

  async function updateTableNumber(tableKey: string) {
    const tableOrders = tableGroups[tableKey];
    const currentOrder = tableOrders?.[0];
    const newTableNumber = tableDraft.trim();
    if (!currentOrder || !newTableNumber) {
      alert('Masukkan nomor meja yang baru.');
      return;
    }
    if (newTableNumber === currentOrder.table_number) {
      setEditingTableKey(null);
      return;
    }

    setUpdatingTable(true);
    const { error } = await supabase.from('orders')
      .update({ table_number: newTableNumber, updated_at: new Date().toISOString() })
      .eq('table_number', currentOrder.table_number)
      .eq('waiter_name', currentOrder.waiter_name)
      .eq('customer_name', currentOrder.customer_name)
      .neq('status', 'paid');
    setUpdatingTable(false);
    if (error) {
      alert(`Gagal mengubah nomor meja: ${error.message}`);
      return;
    }
    setEditingTableKey(null);
    await fetchOrders();
  }

  function startEditingOrder(tableKey: string, tableOrders: Order[]) {
    setEditingOrderKey(tableKey);
    setOrderItemDraft(tableOrders.flatMap(order => (order.order_items || []).map((item: OrderItem) => ({
      id: item.id,
      menuItemId: item.menu_item_id,
      name: item.menu_item_name,
      price: item.menu_item_price,
      quantity: item.quantity,
      kitchen: item.kitchen,
    }))));
    setNewMenuItemId('');
    if (menuItems.length === 0) {
      void supabase.from('menu_items').select('*').eq('is_available', true).order('name')
        .then(({ data, error }) => {
          if (error) {
            alert(`Gagal memuat menu: ${error.message}`);
            return;
          }
          setMenuItems(data || []);
        });
    }
  }

  async function saveOrderEdits(tableKey: string) {
    const tableOrders = tableGroups[tableKey];
    const mainOrder = tableOrders?.[0];
    if (!mainOrder) return;
    if (orderItemDraft.length === 0) {
      alert('Pesanan harus memiliki minimal satu item. Untuk membatalkan, hubungi administrator.');
      return;
    }

    setSavingOrder(true);
    let failure: string | null = null;
    const originalItems = tableOrders.flatMap(order => order.order_items || []);
    const draftIds = new Set(orderItemDraft.flatMap(item => item.id ? [item.id] : []));
    const removedIds = originalItems.filter(item => !draftIds.has(item.id)).map(item => item.id);

    for (const item of orderItemDraft) {
      if (!item.id) continue;
      const original = originalItems.find(entry => entry.id === item.id);
      if (!original || original.quantity === item.quantity) continue;
      const { error } = await supabase.from('order_items')
        .update({ quantity: item.quantity, subtotal: item.quantity * item.price })
        .eq('id', item.id);
      if (error) {
        failure = error.message;
        break;
      }
    }

    if (!failure && removedIds.length > 0) {
      const { error } = await supabase.from('order_items').delete().in('id', removedIds);
      if (error) failure = error.message;
    }

    const newItemsByKitchen = orderItemDraft.filter(item => !item.id).reduce<Record<string, OrderItemDraft[]>>((groups, item) => {
      (groups[item.kitchen] ||= []).push(item);
      return groups;
    }, {});

    if (!failure) {
      for (const [kitchen, items] of Object.entries(newItemsByKitchen) as [Kitchen, OrderItemDraft[]][]) {
        let order = tableOrders.find(existing => existing.kitchen === kitchen);
        if (!order) {
          const { data, error } = await supabase.from('orders').insert({
            table_number: mainOrder.table_number,
            waiter_name: mainOrder.waiter_name,
            customer_name: mainOrder.customer_name,
            kitchen,
            notes: '',
            status: kitchen === 'pentri' || kitchen === 'prasmanan' ? 'done' : 'pending',
          }).select().single();
          if (error || !data) {
            failure = error?.message || 'Pesanan baru tidak berhasil dibuat.';
            break;
          }
          order = data as Order;
        }

        const { error } = await supabase.from('order_items').insert(items.map(item => ({
          order_id: order!.id,
          menu_item_id: item.menuItemId,
          menu_item_name: item.name,
          menu_item_price: item.price,
          quantity: item.quantity,
          subtotal: item.quantity * item.price,
          kitchen,
        })));
        if (error) {
          failure = error.message;
          break;
        }
      }
    }

    for (const order of tableOrders) {
      const { error } = await supabase.from('orders')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', order.id);
      if (!failure && error) failure = error.message;
    }
    setSavingOrder(false);
    setEditingOrderKey(null);
    await fetchOrders();
    if (failure) alert(`Sebagian perubahan mungkin sudah tersimpan. Muat ulang pesanan dan periksa sebelum mencoba lagi. Detail: ${failure}`);
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
          <p className="text-gray-500 text-sm mt-1">Pesanan aktif dan siap dibayar setelah semua dapur selesai</p>
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
            const { table_number: tableNumber, waiter_name: waiterName, customer_name: customerName } = tableOrders[0];
            const allItems = tableOrders.flatMap(o => o.order_items || []);
            const total = allItems.reduce((s, i) => s + i.subtotal, 0);
            const kitchens = [...new Set(tableOrders.map(o => o.kitchen))] as Kitchen[];
            const isExpanded = expanded[key] ?? true;
            const isReadyToPay = tableOrders.every(order => order.status === 'done');

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
                      {customerName && <p className="text-xs text-gray-500 mt-0.5">Pelanggan: {customerName}</p>}
                    </div>
                    <div className="flex gap-1.5">
                      {kitchens.map(k => (
                        <span key={k} className={`text-xs px-2 py-0.5 rounded-full font-medium ${KITCHEN_COLORS[k].badge}`}>
                          {KITCHEN_LABELS[k].replace('Dapur ', '')}{tableOrders.some(order => order.kitchen === k && order.status !== 'done') ? ' · Diproses' : ''}
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
                        {editingTableKey === key ? (
                          <form
                            onSubmit={e => { e.preventDefault(); void updateTableNumber(key); }}
                            className="flex items-center gap-2"
                            onClick={e => e.stopPropagation()}
                          >
                            <input
                              autoFocus
                              value={tableDraft}
                              onChange={e => setTableDraft(e.target.value)}
                              aria-label="Nomor meja baru"
                              placeholder="Nomor meja baru"
                              className="w-36 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                            <button type="submit" disabled={updatingTable} aria-label="Simpan nomor meja" className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg disabled:opacity-50">
                              {updatingTable ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            </button>
                            <button type="button" onClick={() => setEditingTableKey(null)} aria-label="Batal ubah meja" className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                              <X size={16} />
                            </button>
                          </form>
                        ) : (
                          <button
                            onClick={() => { setEditingTableKey(key); setTableDraft(tableNumber); }}
                            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm"
                          >
                            <Pencil size={15} />
                            Ubah Meja
                          </button>
                        )}
                        <button
                          onClick={() => startEditingOrder(key, tableOrders)}
                          className="flex items-center gap-2 px-4 py-2.5 border border-orange-200 text-orange-700 font-semibold rounded-xl hover:bg-orange-50 transition-colors text-sm"
                        >
                          <Pencil size={15} />
                          Edit Pesanan
                        </button>
                        <button
                          onClick={() => {
                            const items = allItems.map(i => ({
                              name: i.menu_item_name, price: i.menu_item_price,
                              quantity: i.quantity, subtotal: i.subtotal, kitchen: i.kitchen as Kitchen
                            }));
                            printReceipt({ receiptNumber: 'PREVIEW', tableNumber, waiterName, customerName, cashierName, items, total });
                          }}
                          className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm"
                        >
                          <Printer size={15} />
                          Preview
                        </button>
                        <button
                          onClick={() => processPayment(key)}
                          disabled={paying === key || !isReadyToPay}
                          className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white font-semibold rounded-xl transition-colors text-sm"
                        >
                          {paying === key ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                          {isReadyToPay ? 'Bayar & Simpan' : 'Menunggu Dapur'}
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

      {editingOrderKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Edit Pesanan</h2>
                <p className="text-sm text-gray-500">Perubahan item dapat langsung terlihat oleh dapur.</p>
              </div>
              <button onClick={() => setEditingOrderKey(null)} aria-label="Tutup editor pesanan" className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2">
              {orderItemDraft.map((item, index) => (
                <div key={item.id || `${item.menuItemId}-${index}`} className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{item.name}</p>
                    <p className="text-xs text-gray-500">{KITCHEN_LABELS[item.kitchen]} · {formatCurrency(item.price)}</p>
                  </div>
                  <button onClick={() => setOrderItemDraft(prev => prev.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: Math.max(1, row.quantity - 1) } : row))} aria-label={`Kurangi ${item.name}`} className="rounded-full bg-white p-1.5 hover:bg-gray-200">
                    <ChevronDown size={14} />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                  <button onClick={() => setOrderItemDraft(prev => prev.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: row.quantity + 1 } : row))} aria-label={`Tambah ${item.name}`} className="rounded-full bg-white p-1.5 hover:bg-gray-200">
                    <ChevronUp size={14} />
                  </button>
                  <button onClick={() => setOrderItemDraft(prev => prev.filter((_, rowIndex) => rowIndex !== index))} aria-label={`Hapus ${item.name}`} className="rounded-full bg-red-50 p-1.5 text-red-500 hover:bg-red-100">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <select value={newMenuItemId} onChange={e => setNewMenuItemId(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <option value="">Pilih menu untuk ditambahkan</option>
                {menuItems.map(item => <option key={item.id} value={item.id}>{item.name} · {KITCHEN_LABELS[item.category]} · {formatCurrency(item.price)}</option>)}
              </select>
              <button
                onClick={() => {
                  const menuItem = menuItems.find(item => item.id === newMenuItemId);
                  if (!menuItem) return;
                  setOrderItemDraft(prev => [...prev, {
                    menuItemId: menuItem.id,
                    name: menuItem.name,
                    price: getDiscountedPrice(menuItem),
                    quantity: 1,
                    kitchen: menuItem.category,
                  }]);
                  setNewMenuItemId('');
                }}
                disabled={!newMenuItemId}
                className="rounded-lg bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 disabled:opacity-50"
              >
                Tambah Item
              </button>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
              <span className="font-bold text-gray-900">Total baru: {formatCurrency(orderItemDraft.reduce((sum, item) => sum + item.quantity * item.price, 0))}</span>
              <div className="flex gap-2">
                <button onClick={() => setEditingOrderKey(null)} disabled={savingOrder} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600">Batal</button>
                <button onClick={() => void saveOrderEdits(editingOrderKey)} disabled={savingOrder} className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {savingOrder ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
