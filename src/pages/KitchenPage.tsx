import { useState, useEffect, useCallback } from 'react';
import { Clock, CheckCircle, Loader2, RefreshCw, Bell, Table2, User, StickyNote, ChefHat } from 'lucide-react';
import { supabase, Order, Kitchen, KITCHEN_LABELS, KITCHEN_COLORS, formatCurrency } from '../lib/supabase';

interface Props {
  kitchen: Kitchen;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Antri',
  processing: 'Diproses',
  done: 'Selesai',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
};

export default function KitchenPage({ kitchen }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'processing' | 'done'>('all');
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());

  const colors = KITCHEN_COLORS[kitchen];

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('kitchen', kitchen)
      .neq('status', 'paid')
      .order('created_at', { ascending: true });
    setOrders(data || []);
    setLoading(false);
  }, [kitchen]);

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel(`kitchen-${kitchen}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `kitchen=eq.${kitchen}` }, payload => {
        setNewOrderIds(prev => new Set([...prev, payload.new.id]));
        fetchOrders();
        setTimeout(() => {
          setNewOrderIds(prev => { const n = new Set(prev); n.delete(payload.new.id); return n; });
        }, 3000);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `kitchen=eq.${kitchen}` }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [kitchen, fetchOrders]);

  async function updateStatus(orderId: string, status: string) {
    await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId);
  }

  const filtered = orders.filter(o => filter === 'all' || o.status === filter);
  const counts = { pending: orders.filter(o => o.status === 'pending').length, processing: orders.filter(o => o.status === 'processing').length, done: orders.filter(o => o.status === 'done').length };

  function timeAgo(dateStr: string): string {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return 'baru saja';
    if (diff < 60) return `${diff} mnt lalu`;
    return `${Math.floor(diff / 60)} jam lalu`;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${colors.bg} ${colors.border} border rounded-xl flex items-center justify-center`}>
              <ChefHat size={20} className={colors.text} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{KITCHEN_LABELS[kitchen]}</h1>
              <p className="text-gray-500 text-sm">{orders.length} pesanan aktif</p>
            </div>
          </div>
        </div>
        <button onClick={fetchOrders} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {(['pending', 'processing', 'done'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(filter === s ? 'all' : s)}
            className={`p-3 rounded-xl border text-left transition-all ${filter === s ? `${colors.bg} ${colors.border}` : 'bg-white border-gray-200 hover:border-gray-300'}`}
          >
            <p className="text-2xl font-bold text-gray-900">{counts[s]}</p>
            <p className="text-xs text-gray-500 mt-0.5">{STATUS_LABELS[s]}</p>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <CheckCircle size={48} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">Tidak ada pesanan {filter !== 'all' ? STATUS_LABELS[filter].toLowerCase() : ''}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(order => (
            <div
              key={order.id}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                newOrderIds.has(order.id) ? 'border-orange-400 ring-2 ring-orange-200' : 'border-gray-100'
              }`}
            >
              {newOrderIds.has(order.id) && (
                <div className="bg-orange-500 text-white text-xs font-bold px-3 py-1 flex items-center gap-1">
                  <Bell size={11} />
                  PESANAN BARU!
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Table2 size={13} className="text-gray-400" />
                      <span className="font-bold text-gray-900">{order.table_number}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <User size={11} className="text-gray-300" />
                      <span className="text-xs text-gray-400">{order.waiter_name}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                    <div className="flex items-center gap-1 justify-end mt-1">
                      <Clock size={10} className="text-gray-300" />
                      <span className="text-xs text-gray-400">{timeAgo(order.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-1.5">
                  {order.order_items?.map(item => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${colors.badge}`}>{item.quantity}x</span>
                        <span className="text-sm text-gray-800">{item.menu_item_name}</span>
                      </div>
                      <span className="text-xs text-gray-500">{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))}
                  <div className="pt-1.5 border-t border-gray-200 flex justify-between">
                    <span className="text-xs font-semibold text-gray-600">Total</span>
                    <span className="text-xs font-bold text-gray-800">
                      {formatCurrency(order.order_items?.reduce((s, i) => s + i.subtotal, 0) || 0)}
                    </span>
                  </div>
                </div>

                {order.notes && (
                  <div className="flex items-start gap-2 mb-3 p-2 bg-yellow-50 rounded-lg">
                    <StickyNote size={12} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-yellow-700">{order.notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {order.status === 'pending' && (
                    <button
                      onClick={() => updateStatus(order.id, 'processing')}
                      className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                      Proses
                    </button>
                  )}
                  {order.status === 'processing' && (
                    <button
                      onClick={() => updateStatus(order.id, 'done')}
                      className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                      Selesai
                    </button>
                  )}
                  {order.status === 'done' && (
                    <div className="flex-1 py-2 bg-green-50 text-green-600 text-sm font-semibold rounded-xl text-center flex items-center justify-center gap-1">
                      <CheckCircle size={14} /> Sudah Selesai
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
