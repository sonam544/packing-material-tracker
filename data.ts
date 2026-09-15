import { InventoryItem } from './types';

export const initialInventory: InventoryItem[] = [
  // A. Secondary Packaging - Purees
  { id: 'puree-pack-2', name: 'Pack of 2', category: 'Secondary Packaging', subCategory: 'Purees', count: 0, unit: 'packs', active: true },
  { id: 'puree-pack-4', name: 'Pack of 4', category: 'Secondary Packaging', subCategory: 'Purees', count: 0, unit: 'packs', active: true },
  { id: 'puree-pack-8', name: 'Pack of 8', category: 'Secondary Packaging', subCategory: 'Purees', count: 0, unit: 'packs', active: true },
  { id: 'puree-pack-16', name: 'Pack of 16', category: 'Secondary Packaging', subCategory: 'Purees', count: 0, unit: 'packs', active: true },

  // A. Secondary Packaging - Melts
  { id: 'melts-combo', name: 'Combo', category: 'Secondary Packaging', subCategory: 'Melts', count: 0, unit: 'packs', active: true },
  { id: 'melts-mango', name: 'Mango', category: 'Secondary Packaging', subCategory: 'Melts', count: 0, unit: 'packs', active: true },
  { id: 'melts-strawberry', name: 'Strawberry', category: 'Secondary Packaging', subCategory: 'Melts', count: 0, unit: 'packs', active: true },
  { id: 'melts-chickoo', name: 'Chickoo', category: 'Secondary Packaging', subCategory: 'Melts', count: 0, unit: 'packs', active: true },
  { id: 'melts-pumpkin', name: 'Pumpkin', category: 'Secondary Packaging', subCategory: 'Melts', count: 0, unit: 'packs', active: true },

  // B. Territory Packaging - Corrugated Boxes
  { id: 'territory-puree-36', name: 'Puree (Pack of 36)', category: 'Territory Packaging', subCategory: 'Corrugated Boxes', count: 0, unit: 'boxes', active: true },
  { id: 'territory-melts-45', name: 'Melts (Pack of 45)', category: 'Territory Packaging', subCategory: 'Corrugated Boxes', count: 0, unit: 'boxes', active: true },
  { id: 'fba-32-box', name: 'FBA 32 Box', category: 'Territory Packaging', subCategory: 'Corrugated Boxes', count: 0, unit: 'boxes', active: true },
  { id: 'fba-16-box', name: 'FBA 16 Box', category: 'Territory Packaging', subCategory: 'Corrugated Boxes', count: 0, unit: 'boxes', active: true },
  { id: 'fba-18-box', name: 'FBA 18 Box', category: 'Territory Packaging', subCategory: 'Corrugated Boxes', count: 0, unit: 'boxes', active: true },

  // C. Daily Orders
  { id: 'daily-small', name: 'Small', category: 'Daily Orders', subCategory: 'Daily Orders', count: 0, unit: 'orders', active: true },
  { id: 'daily-medium', name: 'Medium', category: 'Daily Orders', subCategory: 'Daily Orders', count: 0, unit: 'orders', active: true },
  { id: 'daily-large', name: 'Large', category: 'Daily Orders', subCategory: 'Daily Orders', count: 0, unit: 'orders', active: true },
];

// Default admin user (pre-approved)
export const defaultAdmin = {
  userId: 'Mirza',
  pin: '5445',
  role: 'admin' as const,
  status: 'approved' as const,
  createdAt: new Date().toISOString(),
};
