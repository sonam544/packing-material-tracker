import { useState, useEffect, useCallback } from 'react';
import { InventoryItem, Transaction, User } from './types';
import { initialInventory, defaultAdmin } from './data';

// ─── Helpers ───────────────────────────────────────────────
function load<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch { return fallback; }
}
function save<T>(key: string, data: T) { localStorage.setItem(key, JSON.stringify(data)); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 6); }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Categories config ─────────────────────────────────────
const CATEGORIES = [
  { name: 'Secondary Packaging', subCategories: ['Purees', 'Melts'], color: 'blue' },
  { name: 'Territory Packaging', subCategories: ['Corrugated Boxes'], color: 'orange' },
  { name: 'Daily Orders', subCategories: ['Daily Orders'], color: 'green' },
];

const UNIT_OPTIONS = ['packs', 'boxes', 'orders', 'pcs', 'rolls', 'bags', 'bundles'];

// ─── Main App ──────────────────────────────────────────────
export default function App() {
  const [users, setUsers] = useState<User[]>(() => {
    const stored = load<User[]>('pt-users', []);
    if (!stored.find(u => u.userId === 'Mirza')) return [defaultAdmin, ...stored];
    return stored;
  });
  const [inventory, setInventory] = useState<InventoryItem[]>(() => load('pt-inv-v3', initialInventory));
  const [transactions, setTransactions] = useState<Transaction[]>(() => load('pt-tx-v3', []));
  const [currentUser, setCurrentUser] = useState<User | null>(() => load<User | null>('pt-session', null));

  const [tab, setTab] = useState<'dashboard' | 'history' | 'manage' | 'users'>('dashboard');
  const [catFilter, setCatFilter] = useState('all');
  const [showInactive, setShowInactive] = useState(false);

  // modals
  const [showAuth, setShowAuth] = useState(!currentUser);
  const [addModal, setAddModal] = useState<InventoryItem | null>(null);
  const [deductModal, setDeductModal] = useState<InventoryItem | null>(null);
  const [addItemModal, setAddItemModal] = useState(false);
  const [editItemModal, setEditItemModal] = useState<InventoryItem | null>(null);
  const [notify, setNotify] = useState<string | null>(null);

  useEffect(() => { save('pt-inv-v3', inventory); }, [inventory]);
  useEffect(() => { save('pt-tx-v3', transactions); }, [transactions]);
  useEffect(() => { save('pt-users', users); }, [users]);
  useEffect(() => { save('pt-session', currentUser); }, [currentUser]);

  const flash = useCallback((m: string) => { setNotify(m); setTimeout(() => setNotify(null), 3000); }, []);

  // Pending users count (for admin badge)
  const pendingCount = users.filter(u => u.status === 'pending').length;

  // ─── Auth ────────────────────────────────────────────────
  const login = (userId: string, pin: string): string | null => {
    const u = users.find(x => x.userId.toLowerCase() === userId.toLowerCase());
    if (!u) return 'User ID not found. Please register first.';
    if (u.pin !== pin) return 'Incorrect PIN.';
    if (u.status === 'pending') return '⏳ Your account is pending admin approval. Please wait.';
    if (u.status === 'rejected') return '❌ Your account has been rejected by admin.';
    setCurrentUser(u);
    setShowAuth(false);
    flash(`Welcome, ${u.userId}! (${u.role})`);
    return null;
  };

  const register = (userId: string, pin: string): string | null => {
    if (!/^[a-zA-Z]+$/.test(userId)) return 'User ID must contain letters only (no numbers or spaces).';
    if (userId.length < 2) return 'User ID must be at least 2 characters.';
    if (!/^\d{4}$/.test(pin)) return 'PIN must be exactly 4 digits (numbers only).';
    if (users.find(u => u.userId.toLowerCase() === userId.toLowerCase())) return `"${userId}" is already taken. Choose a different User ID.`;
    const newUser: User = { userId, pin, role: 'viewer', status: 'pending', createdAt: new Date().toISOString() };
    setUsers(prev => [...prev, newUser]);
    flash(`✅ Registration successful! Your account is pending admin approval.`);
    return null;
  };

  const logout = () => { setCurrentUser(null); setShowAuth(true); localStorage.removeItem('pt-session'); };

  // ─── Admin Approval ──────────────────────────────────────
  const approveUser = (userId: string, role: 'editor' | 'viewer') => {
    setUsers(prev => prev.map(u => u.userId === userId ? { ...u, status: 'approved', role } : u));
    flash(`✅ "${userId}" approved as ${role}`);
  };

  const rejectUser = (userId: string) => {
    setUsers(prev => prev.map(u => u.userId === userId ? { ...u, status: 'rejected' } : u));
    flash(`❌ "${userId}" rejected`);
  };

  const removeUser = (userId: string) => {
    setUsers(prev => prev.filter(u => u.userId !== userId));
    flash(`🗑 Removed "${userId}"`);
  };

  const changeUserRole = (userId: string, role: 'editor' | 'viewer') => {
    setUsers(prev => prev.map(u => u.userId === userId ? { ...u, role } : u));
    flash(`✅ "${userId}" role changed to ${role}`);
  };

  // ─── Stock Operations ────────────────────────────────────
  const addStock = (itemId: string, qty: number, comment: string) => {
    if (!currentUser) return;
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;
    setInventory(p => p.map(i => i.id === itemId ? { ...i, count: i.count + qty } : i));
    setTransactions(p => [{ id: uid(), itemId, itemName: item.name, category: item.category, type: 'add', quantity: qty, date: new Date().toISOString(), performedBy: currentUser.userId, comment, assemblyId: '' }, ...p]);
    flash(`✅ Added ${qty} ${item.unit} → "${item.name}"`);
  };

  const deductStock = (itemId: string, qty: number, assemblyId: string) => {
    if (!currentUser) return;
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;
    if (item.count < qty) { flash(`❌ Only ${item.count} available!`); return; }
    setInventory(p => p.map(i => i.id === itemId ? { ...i, count: i.count - qty } : i));
    setTransactions(p => [{ id: uid(), itemId, itemName: item.name, category: item.category, type: 'deduct', quantity: qty, date: new Date().toISOString(), performedBy: currentUser.userId, comment: '', assemblyId }, ...p]);
    flash(`📦 Deducted ${qty} ${item.unit} ← "${item.name}" (ID: ${assemblyId})`);
  };

  // ─── Item Management ─────────────────────────────────────
  const addNewItem = (name: string, category: string, subCategory: string, unit: string) => {
    const newItem: InventoryItem = { id: uid(), name, category, subCategory, count: 0, unit, active: true };
    setInventory(p => [...p, newItem]);
    flash(`✅ Added new item: "${name}"`);
  };

  const editItem = (id: string, updates: Partial<InventoryItem>) => {
    setInventory(p => p.map(i => i.id === id ? { ...i, ...updates } : i));
    flash(`✅ Item updated`);
  };

  const toggleItemActive = (id: string) => {
    setInventory(p => p.map(i => i.id === id ? { ...i, active: !i.active } : i));
    const item = inventory.find(i => i.id === id);
    flash(item?.active ? `⏸ "${item.name}" marked inactive` : `▶ "${item?.name}" reactivated`);
  };

  const deleteItem = (id: string) => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    if (item.count > 0) { flash(`❌ Cannot delete "${item.name}" — stock is ${item.count}. Set to 0 first.`); return; }
    setInventory(p => p.filter(i => i.id !== id));
    flash(`🗑 Deleted "${item.name}"`);
  };

  // ─── Filtering ───────────────────────────────────────────
  const visibleInventory = inventory.filter(i => showInactive ? true : i.active);
  const filtered = catFilter === 'all' ? visibleInventory : visibleInventory.filter(i => i.category === catFilter);
  const grouped = filtered.reduce((a, i) => {
    if (!a[i.category]) a[i.category] = {};
    if (!a[i.category][i.subCategory]) a[i.category][i.subCategory] = [];
    a[i.category][i.subCategory].push(i);
    return a;
  }, {} as Record<string, Record<string, InventoryItem[]>>);

  const canEdit = currentUser && currentUser.role !== 'viewer';
  const isAdmin = currentUser && currentUser.role === 'admin';
  const totalStock = inventory.reduce((s, i) => s + i.count, 0);
  const lowStock = inventory.filter(i => i.active && i.count > 0 && i.count <= 10);

  // ─── Render ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {notify && (
        <div className="fixed top-4 right-4 z-[100] bg-slate-800 text-white px-5 py-3 rounded-xl shadow-2xl text-sm font-medium animate-bounce max-w-sm">
          {notify}
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Packing Material Tracker</h1>
              <p className="text-xs text-slate-400">Live Inventory Management</p>
            </div>
          </div>
          {currentUser && (
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                currentUser.role === 'admin' ? 'bg-purple-500' : currentUser.role === 'editor' ? 'bg-emerald-500' : 'bg-slate-400'
              }`}>
                {currentUser.userId[0].toUpperCase()}
              </div>
              <div className="text-sm">
                <span className="font-semibold text-slate-700">{currentUser.userId}</span>
                <span className={`ml-1.5 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                  currentUser.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                  currentUser.role === 'editor' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                }`}>{currentUser.role}</span>
              </div>
              <button onClick={logout} className="ml-2 text-slate-400 hover:text-red-500 transition-colors" title="Logout">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Stats */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 grid grid-cols-4 gap-3">
          <div className="text-center p-2 bg-indigo-50 rounded-lg">
            <p className="text-xl font-bold text-indigo-700">{inventory.filter(i=>i.active).length}</p>
            <p className="text-[10px] text-indigo-500 font-medium">ACTIVE ITEMS</p>
          </div>
          <div className="text-center p-2 bg-green-50 rounded-lg">
            <p className="text-xl font-bold text-green-700">{totalStock}</p>
            <p className="text-[10px] text-green-500 font-medium">TOTAL STOCK</p>
          </div>
          <div className="text-center p-2 bg-amber-50 rounded-lg">
            <p className="text-xl font-bold text-amber-600">{lowStock.length}</p>
            <p className="text-[10px] text-amber-500 font-medium">LOW STOCK</p>
          </div>
          <div className="text-center p-2 bg-purple-50 rounded-lg">
            <p className="text-xl font-bold text-purple-700">{transactions.length}</p>
            <p className="text-[10px] text-purple-500 font-medium">TRANSACTIONS</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {[
            { id: 'dashboard', label: '📊 Dashboard' },
            { id: 'history', label: '📋 History' },
            ...(canEdit ? [{ id: 'manage', label: '📦 Manage Items' }] : []),
            ...(isAdmin ? [{ id: 'users', label: `👥 Users${pendingCount > 0 ? ` (${pendingCount})` : ''}` }] : []),
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">

        {/* ─── DASHBOARD ─── */}
        {tab === 'dashboard' && (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-6">
              {['all', ...CATEGORIES.map(c => c.name)].map(c => (
                <button key={c} onClick={() => setCatFilter(c)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    catFilter === c ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'
                  }`}>{c === 'all' ? '🔍 All' : c}</button>
              ))}
              <label className="ml-auto flex items-center gap-2 text-sm text-slate-500 cursor-pointer">
                <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                Show inactive
              </label>
            </div>

            {Object.entries(grouped).map(([cat, subs]) => (
              <div key={cat} className="mb-8">
                <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${
                    cat === 'Secondary Packaging' ? 'bg-blue-500' : cat === 'Territory Packaging' ? 'bg-orange-500' : 'bg-green-500'
                  }`} />
                  {cat}
                </h2>
                {Object.entries(subs).map(([sub, items]) => (
                  <div key={sub} className="mb-4">
                    {Object.keys(subs).length > 1 && (
                      <h3 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">{sub}</h3>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {items.map(item => (
                        <div key={item.id}
                          className={`bg-white rounded-xl border-2 p-4 shadow-sm hover:shadow-lg transition-all relative ${
                            !item.active ? 'border-slate-200 opacity-60' :
                            item.count === 0 ? 'border-red-200' : item.count <= 10 ? 'border-amber-200' : 'border-slate-100'
                          }`}>
                          {!item.active && (
                            <span className="absolute top-2 right-2 text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-bold">INACTIVE</span>
                          )}
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="font-semibold text-slate-800 text-sm truncate pr-2">{item.name}</h4>
                            <span className={`text-2xl font-black ${
                              item.count === 0 ? 'text-red-500' : item.count <= 10 ? 'text-amber-500' : 'text-green-600'
                            }`}>{item.count}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mb-2">{item.unit}</p>

                          {item.count === 0 && item.active && (
                            <span className="inline-block mb-2 px-2 py-0.5 bg-red-100 text-red-600 text-[10px] rounded-full font-bold">OUT OF STOCK</span>
                          )}
                          {item.count > 0 && item.count <= 10 && item.active && (
                            <span className="inline-block mb-2 px-2 py-0.5 bg-amber-100 text-amber-600 text-[10px] rounded-full font-bold">LOW STOCK</span>
                          )}

                          {canEdit && item.active && (
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => setAddModal(item)}
                                className="flex-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg py-2 text-xs font-bold hover:bg-emerald-100 flex items-center justify-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                                Add
                              </button>
                              <button onClick={() => setDeductModal(item)}
                                className="flex-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg py-2 text-xs font-bold hover:bg-rose-100 flex items-center justify-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" /></svg>
                                Deduct
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}

        {/* ─── HISTORY ─── */}
        {tab === 'history' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">Transaction History</h2>
              <span className="text-xs text-slate-400">{transactions.length} records</span>
            </div>
            {transactions.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <p className="text-lg font-medium">No transactions yet</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        {['Date & Time','Item','Type','Qty','By','Assembly ID','Comment'].map(h => (
                          <th key={h} className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {transactions.map(tx => (
                        <tr key={tx.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{fmtDate(tx.date)}</td>
                          <td className="px-4 py-3 font-medium text-slate-800 text-xs">{tx.itemName}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              tx.type === 'add' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}>{tx.type === 'add' ? '↑ Added' : '↓ Deducted'}</span>
                          </td>
                          <td className="px-4 py-3 font-bold">{tx.quantity}</td>
                          <td className="px-4 py-3 text-slate-600 text-xs">{tx.performedBy}</td>
                          <td className="px-4 py-3 text-slate-600 text-xs font-mono">{tx.assemblyId || <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs max-w-[150px] truncate">{tx.comment || <span className="text-slate-300">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── MANAGE ITEMS ─── */}
        {tab === 'manage' && canEdit && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">Manage Items</h2>
              <button onClick={() => setAddItemModal(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-md flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add New Item
              </button>
            </div>

            {CATEGORIES.map(cat => {
              const items = inventory.filter(i => i.category === cat.name);
              if (items.length === 0) return null;
              return (
                <div key={cat.name} className="mb-6">
                  <h3 className="font-bold text-slate-700 mb-2">{cat.name}</h3>
                  <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Name</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Sub-Category</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Stock</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Status</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map(item => (
                          <tr key={item.id} className={`hover:bg-slate-50 ${!item.active ? 'opacity-50' : ''}`}>
                            <td className="px-4 py-2.5 font-medium text-slate-800">{item.name}</td>
                            <td className="px-4 py-2.5 text-slate-500 text-xs">{item.subCategory}</td>
                            <td className="px-4 py-2.5 font-bold">{item.count} <span className="text-slate-400 font-normal text-xs">{item.unit}</span></td>
                            <td className="px-4 py-2.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                item.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                              }`}>{item.active ? 'Active' : 'Inactive'}</span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => setEditItemModal(item)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button onClick={() => toggleItemActive(item.id)}
                                  className={`p-1.5 rounded-lg transition-colors ${item.active ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                                  title={item.active ? 'Deactivate' : 'Activate'}>
                                  {item.active ? (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  )}
                                </button>
                                <button onClick={() => { if (confirm(`Delete "${item.name}"?`)) deleteItem(item.id); }}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── USERS (admin only) ─── */}
        {tab === 'users' && isAdmin && (
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-4">User Management</h2>

            {/* Pending Approvals */}
            {users.filter(u => u.status === 'pending').length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-amber-700 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                  Pending Approvals ({users.filter(u => u.status === 'pending').length})
                </h3>
                <div className="space-y-3">
                  {users.filter(u => u.status === 'pending').map(u => (
                    <div key={u.userId} className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-amber-200 rounded-full flex items-center justify-center text-amber-700 font-bold">
                            {u.userId[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{u.userId}</p>
                            <p className="text-xs text-slate-500">Registered: {fmtDate(u.createdAt)}</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold bg-amber-200 text-amber-800 px-2 py-1 rounded-full">PENDING</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600 mr-2">Assign role:</span>
                        <button onClick={() => approveUser(u.userId, 'editor')}
                          className="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                          ✏️ Approve as Editor
                        </button>
                        <button onClick={() => approveUser(u.userId, 'viewer')}
                          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                          👁️ Approve as Viewer
                        </button>
                        <button onClick={() => { if (confirm(`Reject "${u.userId}"?`)) rejectUser(u.userId); }}
                          className="bg-red-100 text-red-700 border border-red-200 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-200 transition-colors">
                          ✗ Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approved Users */}
            <div className="mb-6">
              <h3 className="font-bold text-emerald-700 mb-3">✅ Approved Users</h3>
              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">User ID</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Role</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Created</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.filter(u => u.status === 'approved').map(u => (
                      <tr key={u.userId} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-800">{u.userId}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                            u.role === 'editor' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                          }`}>{u.role}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(u.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          {u.userId !== 'Mirza' ? (
                            <div className="flex items-center justify-end gap-2">
                              <select value={u.role} onChange={e => changeUserRole(u.userId, e.target.value as 'editor' | 'viewer')}
                                className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500 outline-none">
                                <option value="editor">Editor</option>
                                <option value="viewer">Viewer</option>
                              </select>
                              <button onClick={() => { if (confirm(`Remove "${u.userId}"?`)) removeUser(u.userId); }}
                                className="text-red-400 hover:text-red-600 text-xs font-medium">Remove</button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-300">Owner</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rejected Users */}
            {users.filter(u => u.status === 'rejected').length > 0 && (
              <div>
                <h3 className="font-bold text-red-700 mb-3">❌ Rejected Users</h3>
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">User ID</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Created</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.filter(u => u.status === 'rejected').map(u => (
                        <tr key={u.userId} className="hover:bg-slate-50 opacity-60">
                          <td className="px-4 py-3 font-semibold text-slate-800">{u.userId}</td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-red-100 text-red-700">Rejected</span>
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(u.createdAt)}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => { if (confirm(`Remove "${u.userId}"?`)) removeUser(u.userId); }}
                              className="text-red-400 hover:text-red-600 text-xs font-medium">Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-6 bg-white rounded-xl border shadow-sm p-5">
              <h3 className="font-semibold text-slate-700 mb-3">Role Permissions</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                  <span className="text-lg">👑</span>
                  <div>
                    <p className="font-medium text-purple-800 text-sm">Admin</p>
                    <p className="text-xs text-purple-600">Full access — View, Add, Deduct, Manage items, Manage users</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg">
                  <span className="text-lg">✏️</span>
                  <div>
                    <p className="font-medium text-emerald-800 text-sm">Editor</p>
                    <p className="text-xs text-emerald-600">Can View, Add & Deduct stock, Manage items</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <span className="text-lg">👁️</span>
                  <div>
                    <p className="font-medium text-slate-800 text-sm">Viewer</p>
                    <p className="text-xs text-slate-600">Monitor only — Can view inventory & history (read-only)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ─── MODALS ─── */}
      {showAuth && <AuthModal users={users} onLogin={login} onRegister={register} />}
      {addModal && <AddStockModal item={addModal} onSubmit={(q, c) => { addStock(addModal.id, q, c); setAddModal(null); }} onClose={() => setAddModal(null)} />}
      {deductModal && <DeductStockModal item={deductModal} onSubmit={(q, a) => { deductStock(deductModal.id, q, a); setDeductModal(null); }} onClose={() => setDeductModal(null)} />}
      {addItemModal && <AddItemModal onSubmit={(n, cat, sub, u) => { addNewItem(n, cat, sub, u); setAddItemModal(false); }} onClose={() => setAddItemModal(false)} />}
      {editItemModal && <EditItemModal item={editItemModal} onSubmit={(updates) => { editItem(editItemModal.id, updates); setEditItemModal(null); }} onClose={() => setEditItemModal(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// AUTH MODAL
// ═══════════════════════════════════════════════════════════
function AuthModal({ users, onLogin, onRegister }: { users: User[]; onLogin: (id: string, pin: string) => string | null; onRegister: (id: string, pin: string) => string | null }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [userId, setUserId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'login') {
      const err = onLogin(userId, pin);
      if (err) setError(err);
    } else {
      const err = onRegister(userId, pin);
      if (err) setError(err);
    }
  };

  const handlePinChange = (v: string) => {
    const cleaned = v.replace(/\D/g, '').slice(0, 4);
    setPin(cleaned);
  };

  const handleUserIdChange = (v: string) => {
    setUserId(v.replace(/[^a-zA-Z]/g, ''));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className="text-center mb-5">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800">Packing Tracker</h2>
          <p className="text-sm text-slate-500 mt-1">{mode === 'login' ? 'Login to continue' : 'Register for access'}</p>
        </div>

        {/* Toggle */}
        <div className="flex bg-slate-100 rounded-lg p-1 mb-5">
          <button onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'login' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}>
            🔑 Login
          </button>
          <button onClick={() => { setMode('register'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'register' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}>
            📝 Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">User ID <span className="text-[10px] text-slate-400">(letters only)</span></label>
            <input type="text" value={userId} onChange={e => handleUserIdChange(e.target.value)}
              placeholder="e.g., Rahul, Priya"
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm" autoFocus />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">4-Digit PIN <span className="text-[10px] text-slate-400">(numbers only)</span></label>
            <input type="password" value={pin} onChange={e => handlePinChange(e.target.value)}
              placeholder="• • • •" maxLength={4} inputMode="numeric"
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm tracking-widest text-center font-mono text-lg" />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm font-medium flex items-start gap-2">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <button type="submit"
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200">
            {mode === 'login' ? '🔑 Login' : '📝 Register'}
          </button>
        </form>

        {mode === 'register' && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-800 font-medium flex items-start gap-2">
              <span className="text-sm">⏳</span>
              <span>After registration, your account will be <strong>pending admin approval</strong>. You can login only after admin assigns you a role (Editor or Viewer).</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ADD STOCK MODAL (Comment mandatory)
// ═══════════════════════════════════════════════════════════
function AddStockModal({ item, onSubmit, onClose }: { item: InventoryItem; onSubmit: (q: number, c: string) => void; onClose: () => void }) {
  const [qty, setQty] = useState('');
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseInt(qty);
    if (!q || q <= 0) { setErr('Enter valid quantity'); return; }
    if (!comment.trim()) { setErr('Comment is MANDATORY when adding stock'); return; }
    onSubmit(q, comment.trim());
  };

  return (
    <ModalShell title="Add Stock" subtitle={`${item.name} • ${item.category}`} color="emerald" icon="+" onClose={onClose}>
      <div className="bg-slate-50 rounded-xl p-3 mb-4 flex justify-between items-center">
        <span className="text-sm text-slate-500">Current Stock:</span>
        <span className="text-2xl font-black text-slate-800">{item.count} <span className="text-sm font-normal text-slate-400">{item.unit}</span></span>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Quantity <span className="text-red-500">*</span></label>
          <input type="number" value={qty} onChange={e => { setQty(e.target.value); setErr(''); }} min="1"
            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-lg font-semibold" autoFocus />
          <div className="flex gap-2 mt-2 flex-wrap">
            {[1,5,10,25,50,100].map(q => (
              <button key={q} type="button" onClick={() => { setQty(q.toString()); setErr(''); }}
                className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200">{q}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Comment <span className="text-red-500 font-bold">(Mandatory)</span>
          </label>
          <textarea value={comment} onChange={e => { setComment(e.target.value); setErr(''); }} rows={3}
            placeholder="e.g., Received from supplier, Batch #123..."
            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm resize-none" />
        </div>
        {err && <p className="text-red-500 text-sm font-medium">⚠️ {err}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50">Cancel</button>
          <button type="submit" className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 shadow-lg shadow-emerald-200">✅ Add Stock</button>
        </div>
      </form>
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════
// DEDUCT STOCK MODAL (Assembly ID mandatory)
// ═══════════════════════════════════════════════════════════
function DeductStockModal({ item, onSubmit, onClose }: { item: InventoryItem; onSubmit: (q: number, a: string) => void; onClose: () => void }) {
  const [qty, setQty] = useState('');
  const [asmId, setAsmId] = useState('');
  const [err, setErr] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseInt(qty);
    if (!q || q <= 0) { setErr('Enter valid quantity'); return; }
    if (q > item.count) { setErr(`Only ${item.count} available!`); return; }
    if (!asmId.trim()) { setErr('Assembly ID is MANDATORY when deducting stock'); return; }
    onSubmit(q, asmId.trim());
  };

  return (
    <ModalShell title="Deduct Stock" subtitle={`${item.name} • ${item.category}`} color="rose" icon="−" onClose={onClose}>
      <div className="bg-slate-50 rounded-xl p-3 mb-4 flex justify-between items-center">
        <span className="text-sm text-slate-500">Current Stock:</span>
        <span className="text-2xl font-black text-slate-800">{item.count} <span className="text-sm font-normal text-slate-400">{item.unit}</span></span>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Quantity <span className="text-red-500">*</span></label>
          <input type="number" value={qty} onChange={e => { setQty(e.target.value); setErr(''); }} min="1" max={item.count}
            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none text-lg font-semibold" autoFocus />
          <p className="text-xs text-slate-400 mt-1">Max: {item.count} {item.unit}</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            {[1,5,10,25,50].map(q => (
              <button key={q} type="button" onClick={() => { setQty(q.toString()); setErr(''); }}
                className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200">{q}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Assembly ID <span className="text-red-500 font-bold">(Mandatory)</span>
          </label>
          <input type="text" value={asmId} onChange={e => { setAsmId(e.target.value); setErr(''); }}
            placeholder="e.g., ORD-2024-001, ASM-456..."
            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none text-sm font-mono" />
        </div>
        {err && <p className="text-red-500 text-sm font-medium">⚠️ {err}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50">Cancel</button>
          <button type="submit" className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 shadow-lg shadow-rose-200">📦 Deduct</button>
        </div>
      </form>
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════
// ADD NEW ITEM MODAL
// ═══════════════════════════════════════════════════════════
function AddItemModal({ onSubmit, onClose }: { onSubmit: (name: string, cat: string, sub: string, unit: string) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [cat, setCat] = useState(CATEGORIES[0].name);
  const [sub, setSub] = useState(CATEGORIES[0].subCategories[0]);
  const [unit, setUnit] = useState('packs');
  const [newSub, setNewSub] = useState('');
  const [err, setErr] = useState('');

  const catConfig = CATEGORIES.find(c => c.name === cat)!;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Item name is required'); return; }
    const finalSub = newSub.trim() || sub;
    if (!finalSub) { setErr('Sub-category is required'); return; }
    onSubmit(name.trim(), cat, finalSub, unit);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-1">Add New Item</h2>
        <p className="text-sm text-slate-500 mb-4">Add a custom item to any section</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category <span className="text-red-500">*</span></label>
            <select value={cat} onChange={e => { setCat(e.target.value); setSub(CATEGORIES.find(c=>c.name===e.target.value)!.subCategories[0]); setNewSub(''); }}
              className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
              {CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sub-Category</label>
            <select value={sub} onChange={e => setSub(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm mb-2">
              {catConfig.subCategories.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="text" value={newSub} onChange={e => setNewSub(e.target.value)}
              placeholder="Or type new sub-category name..."
              className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Item Name <span className="text-red-500">*</span></label>
            <input type="text" value={name} onChange={e => { setName(e.target.value); setErr(''); }}
              placeholder="e.g., FBA 35 Box"
              className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
            <select value={unit} onChange={e => setUnit(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
              {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          {err && <p className="text-red-500 text-sm font-medium">⚠️ {err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 shadow-lg shadow-indigo-200">✅ Add Item</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// EDIT ITEM MODAL
// ═══════════════════════════════════════════════════════════
function EditItemModal({ item, onSubmit, onClose }: { item: InventoryItem; onSubmit: (u: Partial<InventoryItem>) => void; onClose: () => void }) {
  const [name, setName] = useState(item.name);
  const [unit, setUnit] = useState(item.unit);
  const [count, setCount] = useState(item.count.toString());
  const [err, setErr] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Name is required'); return; }
    const c = parseInt(count);
    if (isNaN(c) || c < 0) { setErr('Invalid stock count'); return; }
    onSubmit({ name: name.trim(), unit, count: c });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-1">Edit Item</h2>
        <p className="text-sm text-slate-500 mb-4">{item.category} → {item.subCategory}</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Item Name</label>
            <input type="text" value={name} onChange={e => { setName(e.target.value); setErr(''); }}
              className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Current Stock</label>
            <input type="number" value={count} onChange={e => { setCount(e.target.value); setErr(''); }} min="0"
              className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
            <select value={unit} onChange={e => setUnit(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
              {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          {err && <p className="text-red-500 text-sm font-medium">⚠️ {err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 shadow-lg shadow-indigo-200">💾 Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MODAL SHELL (reusable)
// ═══════════════════════════════════════════════════════════
const colorMap: Record<string, { bg: string; text: string }> = {
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-600' },
};

function ModalShell({ title, subtitle, color, icon, onClose, children }: {
  title: string; subtitle: string; color: string; icon: string; onClose: () => void; children: React.ReactNode;
}) {
  const colors = colorMap[color] || colorMap.emerald;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 ${colors.bg} rounded-xl flex items-center justify-center`}>
            <span className={`${colors.text} text-xl font-bold`}>{icon}</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">{title}</h2>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
