export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  subCategory: string;
  count: number;
  unit: string;
  active: boolean;
}

export interface Transaction {
  id: string;
  itemId: string;
  itemName: string;
  category: string;
  type: 'add' | 'deduct';
  quantity: number;
  date: string;
  performedBy: string;
  comment: string;
  assemblyId: string;
}

export interface User {
  userId: string;
  pin: string;
  role: 'admin' | 'editor' | 'viewer';
  status: 'approved' | 'pending' | 'rejected';
  createdAt: string;
}
