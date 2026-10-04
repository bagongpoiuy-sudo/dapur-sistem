import { useState, useEffect } from 'react';
import { Plus, Minus, Trash2, Send, ShoppingCart, User, Table2, StickyNote, RefreshCw } from 'lucide-react';
import { supabase, MenuItem, Kitchen, KITCHEN_LABELS, KITCHEN_COLORS, formatCurrency } from '../lib/supabase';

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

interface WaiterDraft {
  cart: CartItem[];
  selectedKitchen: Kitchen;
  tableNumber: string;
  waiterName: string;
  customerName: string;
  foodNotes: string;
  drinkNotes: string;
  foodNotesKitchen: Kitchen | '';
  drinkNotesKitchen: Kitchen | '';
}

const waiterDraftKey = 'waiter_order_draft';
const orderCategories: Kitchen[] = ['cafe', 'pentri', 'prasmanan', 'restoran'];
const kitchens: Kitchen[] = ['cafe', 'restoran'];

function isKitchen(value: unknown): value is Kitchen {
  return value === 'cafe' || value === 'pentri' || value === 'prasmanan' || value === 'restoran';
}

function loadWaiterDraft(): WaiterDraft {
  const emptyDraft: WaiterDraft = {
    cart: [],
    selectedKitchen: 'cafe',
    tableNumber: '',
    waiterName: '',
    customerName: '',
    foodNotes: '',
    drinkNotes: '',
    foodNotesKitchen: '',
    drinkNotesKitchen: '',
  };

  try {
    const rawDraft = localStorage.getItem(waiterDraftKey);
    if (!rawDraft) return emptyDraft;
    const parsed: unknown = JSON.parse(rawDraft);
    if (!parsed || typeof parsed !== 'object') return emptyDraft;
    const draft = parsed as Record<string, unknown>;
    const cart: CartItem[] = [];

    if (Array.isArray(draft.cart)) {
      for (const entry of draft.cart) {
        if (!entry || typeof entry !== 'object') continue;
        const item = entry as Record<string, unknown>;
        if (!item.menuItem || typeof item.menuItem !== 'object') continue;
        const menuItem = item.menuItem as Record<string, unknown>;
        if (
          typeof menuItem.id !== 'string' ||
          typeof menuItem.name !== 'string' ||
          typeof menuItem.price !== 'number' ||
          !Number.isFinite(menuItem.price) ||
          !isKitchen(menuItem.category) ||
          typeof menuItem.is_available !== 'boolean' ||
          typeof menuItem.created_at !== 'string' ||
          typeof item.quantity !== 'number' ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1
        ) continue;
        cart.push({
          menuItem: {
            id: menuItem.id,
            name: menuItem.name,
            price: menuItem.price,
            category: menuItem.category,
            is_available: menuItem.is_available,
            created_at: menuItem.created_at,
          },
          quantity: item.quantity,
        });
      }
    }

    return {
      cart,
      selectedKitchen: isKitchen(draft.selectedKitchen) ? draft.selectedKitchen : 'cafe',
      tableNumber: typeof draft.tableNumber === 'string' ? draft.tableNumber : '',
      waiterName: typeof draft.waiterName === 'string' ? draft.waiterName : '',
      customerName: typeof draft.customerName === 'string' ? draft.customerName : '',
      foodNotes: typeof draft.foodNotes === 'string' ? draft.foodNotes : '',
      drinkNotes: typeof draft.drinkNotes === 'string' ? draft.drinkNotes : '',
      foodNotesKitchen: draft.foodNotesKitchen === '' || isKitchen(draft.foodNotesKitchen) ? draft.foodNotesKitchen : '',
      drinkNotesKitchen: draft.drinkNotesKitchen === '' || isKitchen(draft.drinkNotesKitchen) ? draft.drinkNotesKitchen : '',
    };
  } catch (error) {
    console.warn('Gagal memulihkan draft pesanan pelayan.', error);
    return emptyDraft;
  }
}

export default function WaiterPage() {
  const [draft] = useState<WaiterDraft>(loadWaiterDraft);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>(draft.cart);
  const [selectedKitchen, setSelectedKitchen] = useState<Kitchen>(draft.selectedKitchen);
  const [tableNumber, setTableNumber] = useState(draft.tableNumber);
  const [waiterName, setWaiterName] = useState(draft.waiterName);
  const [customerName, setCustomerName] = useState(draft.customerName);
  const [foodNotes, setFoodNotes] = useState(draft.foodNotes);
  const [drinkNotes, setDrinkNotes] = useState(draft.drinkNotes);
  const [foodNotesKitchen, setFoodNotesKitchen] = useState<Kitchen | ''>(draft.foodNotesKitchen);
  const [drinkNotesKitchen, setDrinkNotesKitchen] = useState<Kitchen | ''>(draft.drinkNotesKitchen);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchMenu();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(waiterDraftKey, JSON.stringify({
        cart,
        selectedKitchen,
        tableNumber,
        waiterName,
        customerName,
        foodNotes,
        drinkNotes,
        foodNotesKitchen,
        drinkNotesKitchen,
      }));
    } catch (error) {
      console.warn('Gagal menyimpan draft pesanan pelayan.', error);
    }
  }, [cart, selectedKitchen, tableNumber, waiterName, customerName, foodNotes, drinkNotes, foodNotesKitchen, drinkNotesKitchen]);

  async function fetchMenu() {
    setLoading(true);
    const { data } = await supabase.from('menu_items').select('*').eq('is_available', true).order('name');
    setMenuItems(data || []);
    setLoading(false);
  }

  const filteredMenu = menuItems.filter(i => i.category === selectedKitchen);

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === item.id);
      if (existing) return prev.map(c => c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart(prev => prev.map(c => c.menuItem.id === id ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c));
  }

  function removeFromCart(id: string) {
    setCart(prev => prev.filter(c => c.menuItem.id !== id));
  }

  const cartByKitchen = cart.reduce<Record<Kitchen, CartItem[]>>((acc, item) => {
    const k = item.menuItem.category;
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<Kitchen, CartItem[]>);

  const total = cart.reduce((sum, c) => sum + c.menuItem.price * c.quantity, 0);

  async function submitOrder() {
    if (!tableNumber.trim()) return alert('Masukkan nomor meja!');
    if (!waiterName.trim()) return alert('Masukkan nama pelayan!');
    if (cart.length === 0) return alert('Keranjang masih kosong!');
    if (foodNotes.trim() && !foodNotesKitchen) return alert('Pilih dapur tujuan catatan makanan!');
    if (drinkNotes.trim() && !drinkNotesKitchen) return alert('Pilih dapur tujuan catatan minuman!');

    setSubmitting(true);
    const orderKitchens = new Set<Kitchen>(Object.keys(cartByKitchen) as Kitchen[]);
    if (foodNotes.trim() && foodNotesKitchen) orderKitchens.add(foodNotesKitchen);
    if (drinkNotes.trim() && drinkNotesKitchen) orderKitchens.add(drinkNotesKitchen);
    const createdOrderIds: string[] = [];

    async function rollbackOrders() {
      for (const orderId of createdOrderIds) {
        const { error } = await supabase.from('orders').delete().eq('id', orderId);
        if (error) console.error('Gagal membatalkan pesanan setelah pengiriman gagal:', error);
      }
    }

    for (const kitchen of orderKitchens) {
      const items = cartByKitchen[kitchen] || [];
      const notes = [
        foodNotes.trim() && foodNotesKitchen === kitchen && `Makanan: ${foodNotes.trim()}`,
        drinkNotes.trim() && drinkNotesKitchen === kitchen && `Minuman: ${drinkNotes.trim()}`,
      ].filter(Boolean).join('\n');
      const { data: order, error: orderErr } = await supabase.from('orders').insert({
        table_number: tableNumber.trim(),
        waiter_name: waiterName.trim(),
        customer_name: customerName.trim(),
        kitchen,
        notes,
        status: 'pending',
      }).select().single();

      if (orderErr || !order) {
        await rollbackOrders();
        alert(`Gagal mengirim pesanan ke ${KITCHEN_LABELS[kitchen]}: ${orderErr?.message || 'Pesanan tidak berhasil dibuat.'}`);
        setSubmitting(false);
        return;
      }
      createdOrderIds.push(order.id);

      const orderItems = items.map(c => ({
        order_id: order.id,
        menu_item_id: c.menuItem.id,
        menu_item_name: c.menuItem.name,
        menu_item_price: c.menuItem.price,
        quantity: c.quantity,
        subtotal: c.menuItem.price * c.quantity,
        kitchen,
      }));

      if (orderItems.length > 0) {
        const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
        if (itemsError) {
          await rollbackOrders();
          alert(`Gagal menyimpan item pesanan: ${itemsError.message}`);
          setSubmitting(false);
          return;
        }
      }

      if (kitchen === 'pentri' || kitchen === 'prasmanan') {
        const { error: statusError } = await supabase.from('orders')
          .update({ status: 'done', updated_at: new Date().toISOString() })
          .eq('id', order.id);
        if (statusError) {
          await rollbackOrders();
          alert(`Pesanan berhasil dibuat, tetapi gagal meneruskannya ke Kasir: ${statusError.message}`);
          setSubmitting(false);
          return;
        }
      }
    }

    const destinations = new Set([...orderKitchens].map(k => (
      k === 'pentri' || k === 'prasmanan' ? 'Kasir' : KITCHEN_LABELS[k]
    )));
    setSuccessMsg(`Pesanan untuk Meja ${tableNumber} berhasil dikirim ke ${[...destinations].join(', ')}!`);
    setCart([]);
    setTableNumber('');
    setFoodNotes('');
    setDrinkNotes('');
    setFoodNotesKitchen('');
    setDrinkNotesKitchen('');
    setSubmitting(false);
    setTimeout(() => setSuccessMsg(''), 5000);
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Input Pesanan</h1>
        <p className="text-gray-500 text-sm mt-1">Tambah pesanan pelanggan dan kirim ke dapur atau langsung ke kasir</p>
      </div>

      {successMsg && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 font-medium text-sm flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Menu Section */}
        <div className="lg:col-span-2 space-y-4">
          {/* Info */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5"><Table2 size={12} className="inline mr-1" />Nomor Meja</label>
                <input
                  type="text"
                  value={tableNumber}
                  onChange={e => setTableNumber(e.target.value)}
                  placeholder="cth: Meja 5"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5"><User size={12} className="inline mr-1" />Nama Pelayan</label>
                <input
                  type="text"
                  value={waiterName}
                  onChange={e => setWaiterName(e.target.value)}
                  placeholder="cth: Budi"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5"><User size={12} className="inline mr-1" />Nama Pelanggan (opsional)</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="cth: Ibu Sari"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
            </div>
          </div>

          {/* Kitchen tabs */}
          <div className="flex gap-2">
            {orderCategories.map(k => {
              const c = KITCHEN_COLORS[k];
              return (
                <button
                  key={k}
                  onClick={() => setSelectedKitchen(k)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                    selectedKitchen === k ? `${c.bg} ${c.text} ${c.border} shadow-sm` : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {KITCHEN_LABELS[k].replace('Dapur ', '')}
                </button>
              );
            })}
          </div>

          {/* Menu Grid */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">
                {selectedKitchen === 'pentri' || selectedKitchen === 'prasmanan'
                  ? `${KITCHEN_LABELS[selectedKitchen]} · langsung ke Kasir`
                  : KITCHEN_LABELS[selectedKitchen]}
              </h2>
              <button onClick={fetchMenu} className="text-gray-400 hover:text-gray-600 transition-colors">
                <RefreshCw size={15} />
              </button>
            </div>
            {loading ? (
              <div className="grid grid-cols-2 gap-3">
                {[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : filteredMenu.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Tidak ada menu tersedia</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredMenu.map(item => {
                  const inCart = cart.find(c => c.menuItem.id === item.id);
                  const c = KITCHEN_COLORS[selectedKitchen];
                  return (
                    <button
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className={`relative p-3 rounded-xl border text-left transition-all hover:shadow-md active:scale-95 ${
                        inCart ? `${c.bg} ${c.border}` : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {inCart && (
                        <span className={`absolute top-2 right-2 w-5 h-5 ${c.badge} rounded-full text-xs font-bold flex items-center justify-center`}>
                          {inCart.quantity}
                        </span>
                      )}
                      <p className={`text-sm font-semibold ${inCart ? c.text : 'text-gray-800'} pr-6`}>{item.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatCurrency(item.price)}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Cart */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <ShoppingCart size={16} />
                Keranjang
              </h2>
              {cart.length > 0 && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                  {cart.reduce((s, c) => s + c.quantity, 0)} item
                </span>
              )}
            </div>

            <div className="p-4 space-y-4">
              {cart.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">Belum ada pesanan</p>
              ) : (
                <>
                  {orderCategories.filter(k => cartByKitchen[k]?.length).map(k => (
                    <div key={k}>
                      <p className={`text-xs font-bold uppercase tracking-wider ${KITCHEN_COLORS[k].text} mb-2`}>
                        {KITCHEN_LABELS[k]}
                      </p>
                      <div className="space-y-2">
                        {cartByKitchen[k].map(c => (
                          <div key={c.menuItem.id} className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{c.menuItem.name}</p>
                              <p className="text-xs text-gray-400">{formatCurrency(c.menuItem.price)}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => updateQty(c.menuItem.id, -1)} className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                                <Minus size={10} />
                              </button>
                              <span className="w-5 text-center text-sm font-semibold">{c.quantity}</span>
                              <button onClick={() => updateQty(c.menuItem.id, 1)} className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                                <Plus size={10} />
                              </button>
                              <button onClick={() => removeFromCart(c.menuItem.id)} className="w-6 h-6 rounded-full bg-red-50 hover:bg-red-100 text-red-400 flex items-center justify-center transition-colors ml-1">
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor="food-notes" className="block text-xs font-medium text-gray-500 mb-1.5">
                          <StickyNote size={12} className="inline mr-1" />Catatan makanan (opsional)
                        </label>
                        <textarea
                          id="food-notes"
                          value={foodNotes}
                          onChange={e => setFoodNotes(e.target.value)}
                          placeholder="cth: tidak pakai bawang"
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-y"
                        />
                        <label htmlFor="food-notes-kitchen" className="block text-xs font-medium text-gray-500 mt-2 mb-1">
                          Kirim catatan makanan ke
                        </label>
                        <select
                          id="food-notes-kitchen"
                          value={foodNotesKitchen}
                          onChange={e => setFoodNotesKitchen(e.target.value as Kitchen | '')}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                        >
                          <option value="">Pilih dapur</option>
                          {kitchens.map(k => <option key={k} value={k}>{KITCHEN_LABELS[k]}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="drink-notes" className="block text-xs font-medium text-gray-500 mb-1.5">
                          <StickyNote size={12} className="inline mr-1" />Catatan minuman (opsional)
                        </label>
                        <textarea
                          id="drink-notes"
                          value={drinkNotes}
                          onChange={e => setDrinkNotes(e.target.value)}
                          placeholder="cth: es sedikit, gula dipisah"
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-y"
                        />
                        <label htmlFor="drink-notes-kitchen" className="block text-xs font-medium text-gray-500 mt-2 mb-1">
                          Kirim catatan minuman ke
                        </label>
                        <select
                          id="drink-notes-kitchen"
                          value={drinkNotesKitchen}
                          onChange={e => setDrinkNotesKitchen(e.target.value as Kitchen | '')}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                        >
                          <option value="">Pilih dapur</option>
                          {kitchens.map(k => <option key={k} value={k}>{KITCHEN_LABELS[k]}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex justify-between text-sm font-bold text-gray-900">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>

                  <button
                    onClick={submitOrder}
                    disabled={submitting}
                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    {submitting ? (
                      <><RefreshCw size={16} className="animate-spin" />Mengirim...</>
                    ) : (
                      <><Send size={16} />Kirim Pesanan</>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
