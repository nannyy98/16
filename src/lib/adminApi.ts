import { getCurrentAdmin } from './auth';
import { supabase } from './supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function adminApiCall(action: string, table: string, params?: {
  data?: unknown;
  filters?: Record<string, unknown>;
  id?: string;
}) {
  const admin = getCurrentAdmin();
  if (!admin?._token) throw new Error('Not authenticated');

  if (!supabaseUrl || !anonKey) throw new Error('Supabase not configured');

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/admin-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'Apikey': anonKey,
      },
      body: JSON.stringify({ action, table, sessionToken: admin._token, ...params }),
    });

    if (response.status === 404) {
      return await fallbackQuery(action, table, params);
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Admin API error');
    }

    const result = await response.json();
    return result.data;
  } catch (err) {
    if (err instanceof Error && err.message.includes('fetch')) {
      return await fallbackQuery(action, table, params);
    }
    throw err;
  }
}

async function fallbackQuery(action: string, table: string, params?: {
  data?: unknown;
  filters?: Record<string, unknown>;
  id?: string;
}) {
  switch (action) {
    case 'select': {
      const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    }
    case 'insert': {
      const { data, error } = await supabase.from(table).insert(params?.data).select().single();
      if (error) throw error;
      return data;
    }
    case 'update': {
      const { data, error } = await supabase.from(table).update(params?.data).eq('id', params?.id).select().single();
      if (error) throw error;
      return data;
    }
    case 'delete': {
      const { error } = await supabase.from(table).delete().eq('id', params?.id);
      if (error) throw error;
      return null;
    }
    case 'updateOrderStatus': {
      const { data, error } = await supabase.rpc('append_order_status', {
        p_order_id: params?.id,
        p_status: (params?.data as Record<string, unknown>)?.status,
        p_changed_by: (params?.data as Record<string, unknown>)?.changed_by || 'admin',
      }).maybeSingle();
      if (error) {
        const { data: d2, error: e2 } = await supabase.from(table).update({ status: (params?.data as Record<string, unknown>)?.status }).eq('id', params?.id).select().single();
        if (e2) throw e2;
        return d2;
      }
      return data;
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

export const adminQueries = {
  getOrders: async () => {
    return adminApiCall('select', 'orders');
  },

  updateOrderStatus: async (orderId: string, status: string, changedBy: string) => {
    return adminApiCall('updateOrderStatus', 'orders', {
      id: orderId,
      data: { status, changed_by: changedBy },
    });
  },

  getProducts: async () => {
    return adminApiCall('select', 'products');
  },

  createProduct: async (product: Record<string, unknown>) => {
    return adminApiCall('insert', 'products', { data: product });
  },

  updateProduct: async (id: string, updates: Record<string, unknown>) => {
    return adminApiCall('update', 'products', { id, data: updates });
  },

  deleteProduct: async (id: string) => {
    return adminApiCall('delete', 'products', { id });
  },

  getBanners: async () => {
    return adminApiCall('select', 'banners');
  },

  createBanner: async (banner: Record<string, unknown>) => {
    return adminApiCall('insert', 'banners', { data: banner });
  },

  updateBanner: async (id: string, updates: Record<string, unknown>) => {
    return adminApiCall('update', 'banners', { id, data: updates });
  },

  deleteBanner: async (id: string) => {
    return adminApiCall('delete', 'banners', { id });
  },

  getDeliveryZones: async () => {
    return adminApiCall('select', 'delivery_zones');
  },

  createDeliveryZone: async (zone: Record<string, unknown>) => {
    return adminApiCall('insert', 'delivery_zones', { data: zone });
  },

  updateDeliveryZone: async (id: string, updates: Record<string, unknown>) => {
    return adminApiCall('update', 'delivery_zones', { id, data: updates });
  },

  deleteDeliveryZone: async (id: string) => {
    return adminApiCall('delete', 'delivery_zones', { id });
  },

  getCoupons: async () => {
    return adminApiCall('select', 'coupons');
  },

  createCoupon: async (coupon: Record<string, unknown>) => {
    return adminApiCall('insert', 'coupons', { data: coupon });
  },

  updateCoupon: async (id: string, updates: Record<string, unknown>) => {
    return adminApiCall('update', 'coupons', { id, data: updates });
  },

  deleteCoupon: async (id: string) => {
    return adminApiCall('delete', 'coupons', { id });
  },

  getReturns: async () => {
    return adminApiCall('select', 'returns');
  },

  updateReturnStatus: async (id: string, updates: Record<string, unknown>) => {
    return adminApiCall('update', 'returns', { id, data: updates });
  },

  getUsers: async () => {
    return adminApiCall('select', 'users');
  },

  getAuditLog: async () => {
    return adminApiCall('select', 'audit_log');
  },

  getAdminAccounts: async () => {
    return adminApiCall('select', 'admin_accounts');
  },

  createAdminAccount: async (account: Record<string, unknown>) => {
    return adminApiCall('insert', 'admin_accounts', { data: account });
  },

  updateAdminAccount: async (id: string, updates: Record<string, unknown>) => {
    return adminApiCall('update', 'admin_accounts', { id, data: updates });
  },
};
