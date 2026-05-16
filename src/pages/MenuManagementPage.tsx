import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, BookOpen, ToggleLeft, ToggleRight, Save, X } from 'lucide-react';
import { supabase, MenuItem, Kitchen, KITCHEN_LABELS, KITCHEN_COLORS, formatCurrency } from '../lib/supabase';

interface NewItem {
  name: string;
  price: string;
  category: Kitchen;
}

export default function MenuManagementPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newItem, setNewItem] = useState<NewItem>({ name: '', price: '', category: 'cafe' });
  const [filterKitchen, setFilterKitchen] = useState<Kitchen | 'all'>('all');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    setLoading(true);
    const { data } = await supabase.from('menu_items').select('*').order('category').order('name');
    setItems(data || []);
    setLoading(false);
  }

  async function addItem() {
    setError('');
    if (!newItem.name.trim()) return setError('Nama menu harus diisi');
    const price = parseFloat(newItem.price);
    if (isNaN(price) || price < 0) return setError('Harga tidak valid');

    setSaving(true);
    const { error: err } = await supabase.from('menu_items').insert({
      name: newItem.name.trim(),
      price,
      category: newItem.category,
      is_available: true,
    });

    if (err) { setError('Gagal menambah menu'); setSaving(false); return; }

    setNewItem({ name: '', price: '', category: newItem.category });
    setShowForm(false);
    fetchItems();
    setSaving(false);
  }

  async function toggleAvailability(item: MenuItem) {
    await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_available: !i.is_available } : i));
  }

  async function deleteItem(id: string) {
    if (!confirm('Hapus menu ini?')) return;
    setDeleting(id);
    await supabase.from('menu_items').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
    setDeleting(null);
  }

  const kitchens: Kitchen[] = ['cafe', 'pentri', 'restoran'];
  const filtered = items.filter(i => filterKitchen === 'all' || i.category === filterKitchen);

  const grouped = kitchens.reduce<Record<Kitchen, MenuItem[]>>((acc, k) => {
    acc[k] = filtered.filter(i => i.category === k);
    return acc;
  }, {} as Record<Kitchen, MenuItem[]>);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen size={24} className="text-teal-500" />
            Kelola Menu
          </h1>
          <p className="text-gray-500 text-sm mt-1">Tambah, edit ketersediaan, dan hapus menu</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          <Plus size={16} />
          Tambah Menu
        </button>
      </div>

      {/* Add Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Tambah Menu Baru</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Nama Menu</label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                  placeholder="cth: Cappuccino"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Harga (Rp)</label>
                <input
                  type="number"
                  value={newItem.price}
                  onChange={e => setNewItem(p => ({ ...p, price: e.target.value }))}
                  placeholder="cth: 25000"
                  min="0"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Kategori Dapur</label>
                <div className="grid grid-cols-3 gap-2">
                  {kitchens.map(k => {
                    const c = KITCHEN_COLORS[k];
                    return (
                      <button
                        key={k}
                        onClick={() => setNewItem(p => ({ ...p, category: k }))}
                        className={`py-2 rounded-xl text-sm font-medium border transition-all ${
                          newItem.category === k ? `${c.bg} ${c.text} ${c.border}` : 'bg-gray-50 text-gray-500 border-gray-200'
                        }`}
                      >
                        {KITCHEN_LABELS[k].replace('Dapur ', '')}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                  Batal
                </button>
                <button
                  onClick={addItem}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:bg-teal-300 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setFilterKitchen('all')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
            filterKitchen === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
          }`}
        >
          Semua ({items.length})
        </button>
        {kitchens.map(k => {
          const c = KITCHEN_COLORS[k];
          const count = items.filter(i => i.category === k).length;
          return (
            <button
              key={k}
              onClick={() => setFilterKitchen(k)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                filterKitchen === k ? `${c.bg} ${c.text} ${c.border}` : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              {KITCHEN_LABELS[k]} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="space-y-6">
          {kitchens.filter(k => grouped[k]?.length > 0 || filterKitchen === k).map(k => {
            const kItems = grouped[k];
            if (!kItems?.length && filterKitchen !== 'all') return null;
            const colors = KITCHEN_COLORS[k];
            return (
              <div key={k} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className={`${colors.bg} ${colors.border} border-b px-5 py-3 flex items-center justify-between`}>
                  <h2 className={`font-bold ${colors.text}`}>{KITCHEN_LABELS[k]}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>
                    {kItems?.length || 0} menu
                  </span>
                </div>
                {!kItems?.length ? (
                  <div className="p-8 text-center text-gray-400 text-sm">Belum ada menu</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {kItems.map(item => (
                      <div key={item.id} className={`flex items-center px-5 py-3 gap-4 transition-colors ${!item.is_available ? 'opacity-50' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(item.price)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {item.is_available ? 'Tersedia' : 'Habis'}
                          </span>
                          <button
                            onClick={() => toggleAvailability(item)}
                            className={`transition-colors ${item.is_available ? 'text-green-500 hover:text-green-700' : 'text-gray-300 hover:text-gray-500'}`}
                            title="Toggle ketersediaan"
                          >
                            {item.is_available ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                          </button>
                          <button
                            onClick={() => deleteItem(item.id)}
                            disabled={deleting === item.id}
                            className="text-red-300 hover:text-red-500 transition-colors disabled:opacity-50"
                          >
                            {deleting === item.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                          </button>
                        </div>
                      </div>
                    ))}
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
