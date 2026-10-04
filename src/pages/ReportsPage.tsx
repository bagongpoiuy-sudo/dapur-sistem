import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Printer, Loader2, Calendar, TrendingUp, ShoppingBag, ChevronLeft, ChevronRight, History, Search, Pencil, Save, X, Plus, Trash2 } from 'lucide-react';
import { supabase, CashierReceipt, ReceiptItem, Kitchen, KITCHEN_LABELS, KITCHEN_COLORS, formatCurrency } from '../lib/supabase';

type ReportType = 'daily' | 'weekly';

interface ProductSummary {
  name: string;
  kitchen: Kitchen;
  quantity: number;
  revenue: number;
}

interface ReceiptEditor {
  id: string;
  tableNumber: string;
  customerName: string;
  waiterName: string;
  items: ReceiptItem[];
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'reports' | 'history'>('reports');
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [receipts, setReceipts] = useState<CashierReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0); // days back for daily, weeks back for weekly
  const [historyReceipts, setHistoryReceipts] = useState<CashierReceipt[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [historySearch, setHistorySearch] = useState('');
  const [receiptEditor, setReceiptEditor] = useState<ReceiptEditor | null>(null);
  const [savingReceipt, setSavingReceipt] = useState(false);
  const historyPageSize = 50;

  const today = new Date();

  function getDateRange(): { start: Date; end: Date; label: string } {
    if (reportType === 'daily') {
      const d = new Date(today);
      d.setDate(d.getDate() - offset);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      return { start: d, end, label: d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) };
    } else {
      const startOfWeek = new Date(today);
      const day = startOfWeek.getDay();
      startOfWeek.setDate(startOfWeek.getDate() - day - offset * 7);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      return {
        start: startOfWeek, end: endOfWeek,
        label: `${startOfWeek.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${endOfWeek.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      };
    }
  }

  const { start, end, label } = getDateRange();

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('cashier_receipts')
      .select('*')
      .gte('paid_at', start.toISOString())
      .lte('paid_at', end.toISOString())
      .order('paid_at', { ascending: true });
    setReceipts(data || []);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start.toISOString(), end.toISOString()]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    const from = historyPage * historyPageSize;
    const { data, count, error } = await supabase
      .from('cashier_receipts')
      .select('*', { count: 'exact' })
      .order('paid_at', { ascending: false })
      .range(from, from + historyPageSize - 1);
    if (error) {
      alert(`Gagal memuat riwayat pesanan: ${error.message}`);
    } else {
      setHistoryReceipts(data || []);
      setHistoryCount(count || 0);
    }
    setHistoryLoading(false);
  }, [historyPage]);

  useEffect(() => {
    if (activeTab === 'history') void fetchHistory();
  }, [activeTab, fetchHistory]);

  function beginReceiptCorrection(receipt: CashierReceipt) {
    setReceiptEditor({
      id: receipt.id,
      tableNumber: receipt.table_number,
      customerName: receipt.customer_name || '',
      waiterName: receipt.waiter_name,
      items: (receipt.items_snapshot || []).map(item => ({ ...item })),
    });
  }

  async function saveReceiptCorrection() {
    if (!receiptEditor) return;
    const items = receiptEditor.items.map(item => ({
      ...item,
      name: item.name.trim(),
      subtotal: item.price * item.quantity,
    }));
    if (!receiptEditor.tableNumber.trim() || !receiptEditor.waiterName.trim()) {
      alert('Nomor meja dan nama pelayan harus diisi.');
      return;
    }
    if (items.length === 0 || items.some(item =>
      !item.name || !Number.isFinite(item.price) || item.price < 0 ||
      !Number.isInteger(item.quantity) || item.quantity < 1
    )) {
      alert('Periksa item nota. Nama harus diisi, harga tidak boleh negatif, dan jumlah minimal satu.');
      return;
    }

    setSavingReceipt(true);
    const { error } = await supabase.from('cashier_receipts').update({
      table_number: receiptEditor.tableNumber.trim(),
      customer_name: receiptEditor.customerName.trim(),
      waiter_name: receiptEditor.waiterName.trim(),
      items_snapshot: items,
      total_amount: items.reduce((total, item) => total + item.subtotal, 0),
    }).eq('id', receiptEditor.id);
    setSavingReceipt(false);
    if (error) {
      alert(`Gagal mengoreksi nota: ${error.message}`);
      return;
    }
    setReceiptEditor(null);
    await Promise.all([fetchHistory(), fetchReceipts()]);
  }

  const visibleHistory = historyReceipts.filter(receipt => {
    const query = historySearch.trim().toLocaleLowerCase();
    return !query || [
      receipt.receipt_number,
      receipt.table_number,
      receipt.customer_name,
      receipt.waiter_name,
    ].some(value => value?.toLocaleLowerCase().includes(query));
  });

  // Aggregate
  const totalRevenue = receipts.reduce((s, r) => s + r.total_amount, 0);
  const totalOrders = receipts.length;

  const productMap: Record<string, ProductSummary> = {};
  receipts.forEach(r => {
    (r.items_snapshot || []).forEach(item => {
      const key = `${item.kitchen}__${item.name}`;
      if (!productMap[key]) productMap[key] = { name: item.name, kitchen: item.kitchen as Kitchen, quantity: 0, revenue: 0 };
      productMap[key].quantity += item.quantity;
      productMap[key].revenue += item.subtotal;
    });
  });

  const products = Object.values(productMap).sort((a, b) => b.revenue - a.revenue);
  const kitchens: Kitchen[] = ['cafe', 'pentri', 'prasmanan', 'restoran'];

  const kitchenStats = kitchens.map(k => ({
    kitchen: k,
    revenue: products.filter(p => p.kitchen === k).reduce((s, p) => s + p.revenue, 0),
    items: products.filter(p => p.kitchen === k),
  }));

  // Daily data for weekly view
  const dailyData: Record<string, number> = {};
  if (reportType === 'weekly') {
    receipts.forEach(r => {
      const d = new Date(r.paid_at).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
      dailyData[d] = (dailyData[d] || 0) + r.total_amount;
    });
  }

  function printReport() {
    const html = `
<!DOCTYPE html><html><head><title>Laporan ${reportType === 'daily' ? 'Harian' : 'Mingguan'} - ${label}</title>
<style>
  body{font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:24px;font-size:13px;color:#333;}
  h1{font-size:20px;margin-bottom:4px;}
  h2{font-size:15px;margin:20px 0 8px;border-bottom:2px solid #eee;padding-bottom:6px;}
  h3{font-size:13px;margin:14px 0 6px;color:#666;}
  table{width:100%;border-collapse:collapse;margin-bottom:12px;}
  th{background:#f5f5f5;padding:8px 10px;text-align:left;font-weight:600;font-size:12px;}
  td{padding:7px 10px;border-bottom:1px solid #f0f0f0;}
  .summary{display:flex;gap:20px;margin-bottom:20px;}
  .stat{background:#f9f9f9;padding:12px 16px;border-radius:8px;flex:1;}
  .stat-val{font-size:18px;font-weight:bold;margin-top:4px;}
  .total-row{font-weight:bold;background:#f5f5f5;}
  .footer{margin-top:24px;text-align:center;font-size:11px;color:#999;}
  @media print{body{padding:10px;}}
</style></head><body>
<h1>Laporan ${reportType === 'daily' ? 'Harian' : 'Mingguan'}</h1>
<p>${label} | Dicetak: ${new Date().toLocaleString('id-ID')}</p>
<div class="summary">
  <div class="stat"><div>Total Transaksi</div><div class="stat-val">${totalOrders}</div></div>
  <div class="stat"><div>Total Pendapatan</div><div class="stat-val">${formatCurrency(totalRevenue)}</div></div>
</div>
${kitchenStats.filter(k => k.items.length).map(ks => `
<h2>${KITCHEN_LABELS[ks.kitchen]}</h2>
<table><thead><tr><th>Menu</th><th>Qty Terjual</th><th>Pendapatan</th></tr></thead>
<tbody>
${ks.items.map(p => `<tr><td>${p.name}</td><td>${p.quantity}</td><td>${formatCurrency(p.revenue)}</td></tr>`).join('')}
<tr class="total-row"><td>Total</td><td>${ks.items.reduce((s, p) => s + p.quantity, 0)}</td><td>${formatCurrency(ks.revenue)}</td></tr>
</tbody></table>
`).join('')}
${reportType === 'weekly' && Object.keys(dailyData).length ? `
<h2>Pendapatan Per Hari</h2>
<table><thead><tr><th>Hari</th><th>Pendapatan</th></tr></thead>
<tbody>
${Object.entries(dailyData).map(([d, v]) => `<tr><td>${d}</td><td>${formatCurrency(v)}</td></tr>`).join('')}
</tbody></table>
` : ''}
<div class="footer">RestoOrder - Laporan Otomatis</div>
</body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 size={24} className="text-violet-500" />
            Laporan
          </h1>
          <p className="text-gray-500 text-sm mt-1">Rekap penjualan harian & mingguan</p>
        </div>
        {activeTab === 'reports' && (
          <button
            onClick={printReport}
            className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            <Printer size={15} />
            Cetak PDF
          </button>
        )}
      </div>

      <div className="mb-5 flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold ${activeTab === 'reports' ? 'border-violet-500 text-violet-700' : 'border-transparent text-gray-500'}`}
        >
          <BarChart3 size={16} /> Laporan
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold ${activeTab === 'history' ? 'border-violet-500 text-violet-700' : 'border-transparent text-gray-500'}`}
        >
          <History size={16} /> Riwayat Pesanan
        </button>
      </div>

      {activeTab === 'history' ? (
        <>
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Riwayat Nota</h2>
              <p className="text-xs text-gray-500">Koreksi nota akan memperbarui detail dan rekap laporan. Menampilkan {historyCount} transaksi.</p>
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
              <Search size={16} className="text-gray-400" />
              <input
                value={historySearch}
                onChange={event => setHistorySearch(event.target.value)}
                placeholder="Cari di halaman ini"
                className="min-w-0 text-sm outline-none"
              />
            </label>
          </div>
          {historyLoading ? (
            <div className="flex justify-center py-20"><Loader2 size={30} className="animate-spin text-gray-400" /></div>
          ) : visibleHistory.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center text-sm text-gray-500">
              {historyReceipts.length ? 'Tidak ada nota yang cocok dengan pencarian.' : 'Belum ada riwayat transaksi.'}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleHistory.map(receipt => (
                <div key={receipt.id} className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold text-gray-900">{receipt.receipt_number}</span>
                      <span className="text-xs text-gray-500">{new Date(receipt.paid_at).toLocaleString('id-ID')}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-700">
                      Meja {receipt.table_number}
                      {receipt.customer_name && ` · ${receipt.customer_name}`}
                      {` · Pelayan ${receipt.waiter_name}`}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">{(receipt.items_snapshot || []).length} jenis item · {formatCurrency(receipt.total_amount)}</p>
                  </div>
                  <button
                    onClick={() => beginReceiptCorrection(receipt)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-violet-200 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50"
                  >
                    <Pencil size={15} /> Koreksi Nota
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex items-center justify-between">
            <button onClick={() => setHistoryPage(page => Math.max(0, page - 1))} disabled={historyPage === 0 || historyLoading} className="flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-sm text-gray-600 disabled:opacity-40">
              <ChevronLeft size={16} /> Lebih baru
            </button>
            <span className="text-xs text-gray-500">Halaman {historyPage + 1} dari {Math.max(1, Math.ceil(historyCount / historyPageSize))}</span>
            <button onClick={() => setHistoryPage(page => page + 1)} disabled={(historyPage + 1) * historyPageSize >= historyCount || historyLoading} className="flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-sm text-gray-600 disabled:opacity-40">
              Lebih lama <ChevronRight size={16} />
            </button>
          </div>
        </>
      ) : (
        <>
      {/* Controls */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => { setReportType('daily'); setOffset(0); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${reportType === 'daily' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            >
              Harian
            </button>
            <button
              onClick={() => { setReportType('weekly'); setOffset(0); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${reportType === 'weekly' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            >
              Mingguan
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setOffset(o => o + 1)} className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg min-w-0">
              <Calendar size={13} className="text-gray-400 flex-shrink-0" />
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">{label}</span>
            </div>
            <button onClick={() => setOffset(o => Math.max(0, o - 1))} disabled={offset === 0} className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:opacity-40 rounded-lg transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingBag size={16} className="text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">Total Transaksi</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{totalOrders}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className="text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">Total Pendapatan</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingBag size={16} className="text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">Rata-rata / Transaksi</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalOrders ? totalRevenue / totalOrders : 0)}</p>
            </div>
          </div>

          {receipts.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
              <BarChart3 size={48} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium">Belum ada data untuk periode ini</p>
            </div>
          ) : (
            <>
              {/* Per Kitchen */}
              <div className="space-y-4">
                {kitchenStats.filter(ks => ks.items.length > 0).map(ks => {
                  const colors = KITCHEN_COLORS[ks.kitchen];
                  return (
                    <div key={ks.kitchen} className={`bg-white rounded-2xl border ${colors.border} shadow-sm overflow-hidden`}>
                      <div className={`${colors.bg} px-5 py-3 flex items-center justify-between`}>
                        <h2 className={`font-bold ${colors.text}`}>{KITCHEN_LABELS[ks.kitchen]}</h2>
                        <span className={`font-bold ${colors.text}`}>{formatCurrency(ks.revenue)}</span>
                      </div>
                      <div className="p-4">
                        <table className="w-full">
                          <thead>
                            <tr className="text-xs text-gray-500 uppercase tracking-wider">
                              <th className="text-left pb-2 font-medium">Menu</th>
                              <th className="text-right pb-2 font-medium">Qty</th>
                              <th className="text-right pb-2 font-medium">Pendapatan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ks.items.map(p => (
                              <tr key={p.name} className="border-t border-gray-50">
                                <td className="py-2 text-sm text-gray-800">{p.name}</td>
                                <td className="py-2 text-sm text-right text-gray-600">{p.quantity}</td>
                                <td className="py-2 text-sm text-right font-medium text-gray-800">{formatCurrency(p.revenue)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-gray-200">
                              <td className="pt-2 text-sm font-bold text-gray-900">Total</td>
                              <td className="pt-2 text-sm font-bold text-right text-gray-900">{ks.items.reduce((s, p) => s + p.quantity, 0)}</td>
                              <td className="pt-2 text-sm font-bold text-right text-gray-900">{formatCurrency(ks.revenue)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Weekly daily breakdown */}
              {reportType === 'weekly' && Object.keys(dailyData).length > 0 && (
                <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <h2 className="font-bold text-gray-900">Pendapatan Per Hari</h2>
                  </div>
                  <div className="p-4">
                    <div className="space-y-2">
                      {Object.entries(dailyData).map(([day, val]) => {
                        const pct = totalRevenue > 0 ? (val / totalRevenue) * 100 : 0;
                        return (
                          <div key={day} className="flex items-center gap-3">
                            <span className="text-sm text-gray-600 w-28 flex-shrink-0">{day}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div className="bg-violet-400 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-sm font-medium text-gray-800 w-28 text-right">{formatCurrency(val)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
        </>
      )}

      {receiptEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Koreksi Nota</h2>
                <p className="text-xs text-gray-500">Nomor nota dan waktu pembayaran tetap, total dihitung ulang saat disimpan.</p>
              </div>
              <button onClick={() => setReceiptEditor(null)} aria-label="Tutup koreksi nota" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-xs text-gray-500">Nomor meja
                <input value={receiptEditor.tableNumber} onChange={event => setReceiptEditor(prev => prev && ({ ...prev, tableNumber: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800" />
              </label>
              <label className="text-xs text-gray-500">Nama pelanggan
                <input value={receiptEditor.customerName} onChange={event => setReceiptEditor(prev => prev && ({ ...prev, customerName: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800" />
              </label>
              <label className="text-xs text-gray-500">Nama pelayan
                <input value={receiptEditor.waiterName} onChange={event => setReceiptEditor(prev => prev && ({ ...prev, waiterName: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800" />
              </label>
            </div>
            <div className="mt-4 space-y-3">
              {receiptEditor.items.map((item, index) => (
                <div key={`${item.name}-${index}`} className="rounded-xl border border-gray-100 p-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <input aria-label="Nama item" value={item.name} onChange={event => setReceiptEditor(prev => prev && ({ ...prev, items: prev.items.map((row, i) => i === index ? { ...row, name: event.target.value } : row) }))} placeholder="Nama item" className="col-span-2 rounded-lg border border-gray-200 px-2 py-2 text-sm sm:col-span-2" />
                    <input aria-label="Harga item" type="number" min="0" value={item.price} onChange={event => setReceiptEditor(prev => prev && ({ ...prev, items: prev.items.map((row, i) => i === index ? { ...row, price: Number(event.target.value) } : row) }))} className="rounded-lg border border-gray-200 px-2 py-2 text-sm" />
                    <input aria-label="Jumlah item" type="number" min="1" step="1" value={item.quantity} onChange={event => setReceiptEditor(prev => prev && ({ ...prev, items: prev.items.map((row, i) => i === index ? { ...row, quantity: Number(event.target.value) } : row) }))} className="rounded-lg border border-gray-200 px-2 py-2 text-sm" />
                    <select aria-label="Kategori dapur" value={item.kitchen} onChange={event => setReceiptEditor(prev => prev && ({ ...prev, items: prev.items.map((row, i) => i === index ? { ...row, kitchen: event.target.value as Kitchen } : row) }))} className="rounded-lg border border-gray-200 px-2 py-2 text-sm">
                      {(['cafe', 'pentri', 'prasmanan', 'restoran'] as Kitchen[]).map(kitchen => <option key={kitchen} value={kitchen}>{KITCHEN_LABELS[kitchen]}</option>)}
                    </select>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Subtotal: {formatCurrency(item.price * item.quantity)}</span>
                    <button onClick={() => setReceiptEditor(prev => prev && ({ ...prev, items: prev.items.filter((_, i) => i !== index) }))} className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700">
                      <Trash2 size={13} /> Hapus item
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setReceiptEditor(prev => prev && ({ ...prev, items: [...prev.items, { name: '', price: 0, quantity: 1, subtotal: 0, kitchen: 'cafe' }] }))}
                className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                <Plus size={15} /> Tambah item
              </button>
            </div>
            <div className="mt-5 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-bold text-gray-900">Total baru: {formatCurrency(receiptEditor.items.reduce((sum, item) => sum + item.price * item.quantity, 0))}</span>
              <div className="flex justify-end gap-2">
                <button onClick={() => setReceiptEditor(null)} disabled={savingReceipt} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600">Batal</button>
                <button onClick={() => void saveReceiptCorrection()} disabled={savingReceipt} className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {savingReceipt ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan Koreksi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
