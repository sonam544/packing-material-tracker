import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

interface Material {
  id: string;
  name: string;
  category: string;
  quantity: number;
  min_stock: number;
}

export default function App() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Form State
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<string>('Boxes');
  const [quantity, setQuantity] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(5);

  useEffect(() => {
    fetchMaterials();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('materials-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'materials' },
        () => {
          fetchMaterials();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchMaterials = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching materials:', error.message);
    } else if (data) {
      setMaterials(data);
    }
    setLoading(false);
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const { error } = await supabase
      .from('materials')
      .insert([{ name, category, quantity, min_stock: minStock }]);

    if (error) {
      alert('Error adding material: ' + error.message);
    } else {
      setName('');
      setQuantity(0);
      setMinStock(5);
      fetchMaterials();
    }
  };

  const handleUpdateQuantity = async (id: string, currentQty: number, delta: number) => {
    const newQty = Math.max(0, currentQty + delta);
    const { error } = await supabase
      .from('materials')
      .update({ quantity: newQty })
      .eq('id', id);

    if (error) {
      alert('Error updating quantity: ' + error.message);
    } else {
      fetchMaterials();
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    const { error } = await supabase
      .from('materials')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Error deleting material: ' + error.message);
    } else {
      fetchMaterials();
    }
  };

  const categories = ['All', ...Array.from(new Set(materials.map((m) => m.category || 'General')))];
  const filteredMaterials = selectedCategory === 'All' 
    ? materials 
    : materials.filter((m) => (m.category || 'General') === selectedCategory);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Packing Material Tracker</h1>
      
      {/* Add New Item Form */}
      <form onSubmit={handleAddMaterial} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '10px', marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
        <input 
          type="text" 
          placeholder="Material Name" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          required 
          style={{ padding: '8px' }}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: '8px' }}>
          <option value="Boxes">Boxes</option>
          <option value="Protective">Protective</option>
          <option value="Adhesives">Adhesives</option>
          <option value="Labels">Labels</option>
          <option value="General">General</option>
        </select>
        <input 
          type="number" 
          placeholder="Qty" 
          value={quantity} 
          onChange={(e) => setQuantity(Number(e.target.value))} 
          style={{ padding: '8px' }}
        />
        <input 
          type="number" 
          placeholder="Min Stock" 
          value={minStock} 
          onChange={(e) => setMinStock(Number(e.target.value))} 
          style={{ padding: '8px' }}
        />
        <button type="submit" style={{ padding: '8px 16px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Add Item</button>
      </form>

      {/* Category Filter Pills */}
      <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: '6px 12px',
              border: '1px solid #ccc',
              borderRadius: '16px',
              background: selectedCategory === cat ? '#0070f3' : '#fff',
              color: selectedCategory === cat ? '#fff' : '#000',
              cursor: 'pointer'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Materials List */}
      {loading ? (
        <p>Loading inventory...</p>
      ) : filteredMaterials.length === 0 ? (
        <p>No materials found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredMaterials.map((item) => {
            const isLowStock = item.quantity <= item.min_stock;
            return (
              <div 
                key={item.id} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '12px 16px', 
                  border: isLowStock ? '2px solid #e53e3e' : '1px solid #e2e8f0', 
                  borderRadius: '6px',
                  background: isLowStock ? '#fff5f5' : '#fff'
                }}
              >
                <div>
                  <strong style={{ fontSize: '1.1em' }}>{item.name}</strong>
                  <div style={{ fontSize: '0.85em', color: '#666' }}>
                    Category: {item.category || 'General'} | Min Stock Alert: {item.min_stock}
                    {isLowStock && <span style={{ color: '#e53e3e', marginLeft: '10px', fontWeight: 'bold' }}>⚠️ Low Stock</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button 
                    onClick={() => handleUpdateQuantity(item.id, item.quantity, -1)}
                    style={{ padding: '4px 10px', fontSize: '1.2em', cursor: 'pointer' }}
                  >
                    -
                  </button>
                  <span style={{ fontWeight: 'bold', minWidth: '40px', textAlign: 'center' }}>
                    {item.quantity} Pcs
                  </span>
                  <button 
                    onClick={() => handleUpdateQuantity(item.id, item.quantity, 1)}
                    style={{ padding: '4px 10px', fontSize: '1.2em', cursor: 'pointer' }}
                  >
                    +
                  </button>
                  <button 
                    onClick={() => handleDeleteMaterial(item.id)}
                    style={{ marginLeft: '15px', padding: '6px 10px', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
