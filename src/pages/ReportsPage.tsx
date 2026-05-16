import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Printer, Loader2, Calendar, TrendingUp, ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase, CashierReceipt, Kitchen, KITCHEN_LABELS, KITCHEN_COLORS, formatCurrency } from '../lib/supabase';

type ReportType = 'daily' | 'weekly';

interface ProductSummary {
  name: string;
  kitchen: Kitchen;
  quantity: number;
  revenue: number;
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [receipts, setReceipts] = useState<CashierReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0); // days back for daily, weeks back for weekly

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
  const kitchens: Kitchen[] = ['cafe', 'pentri', 'restoran'];

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
        <button
          onClick={printReport}
          className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          <Printer size={15} />
          Cetak PDF
        </button>
      </div>

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
    </div>
  );
}
