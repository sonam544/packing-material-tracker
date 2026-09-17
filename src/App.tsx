import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch materials from Supabase
  const fetchMaterials = async () => {
    const { data, error } = await supabase.from('materials').select('*').order('name');
    if (!error && data) {
      setMaterials(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMaterials();

    // Listen for real-time changes
    const channel = supabase
      .channel('realtime-materials')
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

  // Update stock level in Supabase
  const handleStockChange = async (id: string, newStock: number) => {
    if (newStock < 0) return;
    const { error } = await supabase
      .from('materials')
      .update({ stock: newStock, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      alert('Error updating stock: ' + error.message);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading packing materials...</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Packing Material Tracker</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {materials.map((item) => (
          <div 
            key={item.id} 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '12px', 
              border: '1px solid #ccc', 
              borderRadius: '6px' 
            }}
          >
            <div>
              <strong>{item.name}</strong>
              <div style={{ fontSize: '12px', color: '#666' }}>{item.category || 'General'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={() => handleStockChange(item.id, Number(item.stock) - 1)}>-</button>
              <span>{item.stock} {item.unit || 'pcs'}</span>
              <button onClick={() => handleStockChange(item.id, Number(item.stock) + 1)}>+</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
