import api from './client';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: string;
  coinsPrice: number;
  isActive: boolean;
  maxPerStudent?: number;
}

export interface Purchase {
  id: string;
  purchasedAt: string;
  usedAt?: string;
  item: Pick<ShopItem, 'id' | 'name' | 'icon' | 'type' | 'description'>;
}

export const getShopItems   = () => api.get<ShopItem[]>('/shop');
export const buyItem        = (itemId: string, courseId?: string) =>
  api.post<{ purchaseId: string; message: string }>(`/shop/${itemId}/buy`, { courseId });
export const getMyPurchases = () => api.get<Purchase[]>('/shop/my-purchases');
export const usePurchase    = (purchaseId: string) => api.post(`/shop/purchases/${purchaseId}/use`);
export const seedShop       = () => api.post('/shop/seed');

export const createShopItem = (data: Omit<ShopItem, 'id' | 'isActive'>) =>
  api.post<ShopItem>('/shop', data);
export const updateShopItem = (id: string, data: Omit<ShopItem, 'id' | 'isActive'>) =>
  api.put<ShopItem>(`/shop/${id}`, data);
export const deleteShopItem = (id: string) => api.delete(`/shop/${id}`);
