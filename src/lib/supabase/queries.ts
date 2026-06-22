import { supabase, isSupabaseConfigured, Database } from '../supabase';
import {
  mockProducts, mockCategories, mockOrders, mockBanners, mockDeliveryZones,
} from './mock';

export type Product = Database['public']['Tables']['products']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];
export type Review = Database['public']['Tables']['reviews']['Row'];
export type Promotion = Database['public']['Tables']['promotions']['Row'];
export type Referral = Database['public']['Tables']['referrals']['Row'];

export interface ProductFilters {
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  sizes?: string[];
  colors?: string[];
  inStock?: boolean;
  search?: string;
}

export interface ProductSort {
  field: 'created_at' | 'price' | 'views';
  order: 'asc' | 'desc';
}

export const PAGE_SIZE = 20;

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

export const productQueries = {
  getAll: async (filters?: ProductFilters, sort?: ProductSort, offset = 0, limit = PAGE_SIZE) => {
    if (!isSupabaseConfigured) {
      await delay();
      let items = [...mockProducts].filter((p) => p.is_active);
      if (filters?.categoryId) items = items.filter((p) => p.category_id === filters.categoryId);
      if (filters?.minPrice !== undefined) items = items.filter((p) => p.price >= filters.minPrice!);
      if (filters?.maxPrice !== undefined) items = items.filter((p) => p.price <= filters.maxPrice!);
      if (filters?.inStock) items = items.filter((p) => p.stock > 0);
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        items = items.filter((p) => p.name.ru.toLowerCase().includes(q) || p.name.uz.toLowerCase().includes(q));
      }
      if (filters?.sizes?.length) items = items.filter((p) => p.sizes.some((s) => filters.sizes!.includes(s)));
      if (filters?.colors?.length) items = items.filter((p) => p.colors.some((c) => filters.colors!.includes(c.hex)));
      if (sort) items.sort((a, b) => sort.order === 'asc' ? (a[sort.field] as number) - (b[sort.field] as number) : (b[sort.field] as number) - (a[sort.field] as number));
      return { items: items.slice(offset, offset + limit), total: items.length };
    }

    // Use FTS RPC for search queries (much faster than ILIKE)
    if (filters?.search && filters.search.trim().length > 0) {
      const { data, error } = await supabase.rpc('search_products', {
        p_query: filters.search.trim(),
        p_language: 'ru',
        p_category_id: filters.categoryId || null,
        p_min_price: filters.minPrice || null,
        p_max_price: filters.maxPrice || null,
        p_in_stock: filters.inStock || false,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) throw error;

      const rows = data ?? [];
      const total = rows.length > 0 ? (rows[0] as Record<string, unknown>).total_count as number : 0;
      // Remove the rank and total_count fields from returned data
      const items = rows.map((row: Record<string, unknown>) => row as Product);
      return { items, total };
    }

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    if (filters?.categoryId) {
      query = query.eq('category_id', filters.categoryId);
    }

    if (filters?.minPrice !== undefined) {
      query = query.gte('price', filters.minPrice);
    }

    if (filters?.maxPrice !== undefined) {
      query = query.lte('price', filters.maxPrice);
    }

    if (filters?.search && filters.search.trim().length > 0) {
      const sanitized = filters.search.replace(/[%_()]/g, '\\$&');
      query = query.or(`name->ru.ilike.%${sanitized}%,name->uz.ilike.%${sanitized}%,description->ru.ilike.%${sanitized}%,description->uz.ilike.%${sanitized}%`);
    }

    if (filters?.inStock) {
      query = query.gt('stock', 0);
    }

    if (sort) {
      query = query.order(sort.field, { ascending: sort.order === 'asc' });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    let filteredData = data || [];

    if (filters?.sizes && filters.sizes.length > 0) {
      filteredData = filteredData.filter(product =>
        product.sizes.some((size: string) => filters.sizes!.includes(size))
      );
    }

    if (filters?.colors && filters.colors.length > 0) {
      filteredData = filteredData.filter(product =>
        product.colors.some((color: { name: string; hex: string }) => filters.colors!.includes(color.hex))
      );
    }

    return { items: filteredData, total: count ?? 0 };
  },

  getBySlug: async (slug: string) => {
    if (!isSupabaseConfigured) {
      await delay();
      return mockProducts.find((p) => p.slug === slug) ?? null;
    }
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  incrementViews: async (id: string) => {
    if (!isSupabaseConfigured) return;
    await supabase.rpc('increment_views', { p_id: id });
  },

  uploadImages: async (files: File[]) => {
    if (!isSupabaseConfigured) return files.map(() => 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80');
    const uploadPromises = files.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return publicUrl;
    });

    return Promise.all(uploadPromises);
  },

  getByIds: async (ids: string[]): Promise<Product[]> => {
    if (!ids.length) return [];
    if (!isSupabaseConfigured) {
      await delay();
      return mockProducts.filter((p) => ids.includes(p.id) && p.is_active);
    }
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .in('id', ids)
      .eq('is_active', true);
    if (error) throw error;
    return data ?? [];
  },
};

export const inventoryQueries = {
  updateStock: async (productId: string, newStock: number) => {
    if (!isSupabaseConfigured) { await delay(); const p = mockProducts.find((p) => p.id === productId); if (p) p.stock = newStock; return { id: productId, stock: newStock }; }
    const { data, error } = await supabase
      .from('products')
      .update({ stock: newStock, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .select('id, stock')
      .single();
    if (error) throw error;
    return data;
  },

  adjustStock: async (productId: string, delta: number) => {
    if (!isSupabaseConfigured) {
      await delay();
      const p = mockProducts.find((p) => p.id === productId);
      if (p) p.stock = Math.max(0, p.stock + delta);
      return { id: productId, stock: p?.stock ?? 0 };
    }
    const { data, error } = await supabase.rpc('adjust_stock', {
      p_product_id: productId,
      p_delta: delta,
    }).maybeSingle();
    if (error) throw error;
    return data;
  },

  getAllWithStock: async () => {
    if (!isSupabaseConfigured) { await delay(); return mockProducts; }
    const { data, error } = await supabase
      .from('products')
      .select('id, name, slug, price, stock, images, is_active, category_id')
      .order('stock', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
};

export const userQueries = {
  getByTelegramId: async (telegramId: number) => {
    if (!isSupabaseConfigured) { await delay(); return { id: `${telegramId}`, telegram_id: telegramId, first_name: 'Гость', username: null, language: 'ru', phone: null, address: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; }
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  upsert: async (telegramId: number, userData: { first_name: string; username?: string | null; language?: string }) => {
    if (!isSupabaseConfigured) { await delay(); return { id: `${telegramId}`, telegram_id: telegramId, first_name: userData.first_name, username: userData.username ?? null, language: userData.language ?? 'ru', phone: null, address: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; }
    const { data, error } = await supabase
      .from('users')
      .upsert(
        { telegram_id: telegramId, ...userData, updated_at: new Date().toISOString() },
        { onConflict: 'telegram_id' }
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  updateProfile: async (telegramId: number, updates: { phone?: string; address?: string; first_name?: string }) => {
    if (!isSupabaseConfigured) { await delay(); return { id: `${telegramId}`, telegram_id: telegramId, first_name: updates.first_name || 'Гость', username: null, language: 'ru', phone: updates.phone ?? null, address: updates.address ?? null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; }
    // Use upsert to handle both insert and update in one call
    const { data, error } = await supabase
      .from('users')
      .upsert(
        { telegram_id: telegramId, ...updates, updated_at: new Date().toISOString() },
        { onConflict: 'telegram_id' }
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

export const categoryQueries = {
  getAll: async () => {
    if (!isSupabaseConfigured) {
      await delay();
      return mockCategories;
    }
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name->ru');

    if (error) throw error;
    return data;
  },
};

export const orderQueries = {
  create: async (orderData: Database['public']['Tables']['orders']['Insert']) => {
    if (!isSupabaseConfigured) {
      await delay();
      return { ...orderData, id: `ord-${Date.now()}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status_history: [], transaction_id: null, paid_at: null } as Order;
    }
    const { data, error } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  getByTelegramUserId: async (telegramUserId: number) => {
    if (!isSupabaseConfigured) {
      await delay();
      return mockOrders;
    }
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('telegram_user_id', telegramUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  getById: async (id: string) => {
    if (!isSupabaseConfigured) {
      await delay();
      return mockOrders.find((o) => o.id === id) ?? null;
    }
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  updateStatus: async (id: string, status: string, changedBy = 'admin', note?: string) => {
    if (!isSupabaseConfigured) {
      await delay();
      const order = mockOrders.find((o) => o.id === id);
      if (order) order.status = status;
      return order as Order;
    }

    // Use RPC to atomically append to status_history (avoids race condition)
    const { data, error } = await supabase.rpc('append_order_status', {
      p_order_id: id,
      p_status: status,
      p_changed_by: changedBy,
      p_note: note || null,
    }).maybeSingle();

    if (error) throw error;
    return data as Order;
  },

  subscribeToOrders: (callback: (payload: { new: Record<string, unknown>; old: Record<string, unknown>; eventType: string }) => void) => {
    if (!isSupabaseConfigured) return { unsubscribe: () => {} } as ReturnType<typeof supabase.channel>;
    return supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        callback
      )
      .subscribe();
  },
};

export const reviewQueries = {
  getByProductId: async (productId: string) => {
    if (!isSupabaseConfigured) {
      await delay();
      return [];
    }
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('product_id', productId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  getWithVotes: async (productId: string, sort: 'newest' | 'highest' | 'helpful' = 'newest', limit = 50, offset = 0) => {
    if (!isSupabaseConfigured) {
      await delay();
      return [];
    }
    const { data, error } = await supabase.rpc('get_reviews_with_votes', {
      p_product_id: productId,
      p_limit: limit,
      p_offset: offset,
      p_sort: sort,
    });
    if (error) throw error;
    return data ?? [];
  },

  create: async (reviewData: Database['public']['Tables']['reviews']['Insert']) => {
    if (!isSupabaseConfigured) {
      await delay();
      return { ...reviewData, id: `rev-${Date.now()}`, created_at: new Date().toISOString(), is_approved: true } as Review;
    }
    const { data, error } = await supabase
      .from('reviews')
      .insert(reviewData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  getAverageRating: async (productId: string) => {
    if (!isSupabaseConfigured) {
      await delay();
      return { average: 0, count: 0 };
    }
    const { data, error, count } = await supabase
      .from('reviews')
      .select('rating', { count: 'exact' })
      .eq('product_id', productId)
      .eq('is_approved', true);

    if (error) throw error;

    if (!data || data.length === 0) return { average: 0, count: 0 };

    const sum = data.reduce((acc, review) => acc + review.rating, 0);
    return {
      average: sum / data.length,
      count: count ?? data.length,
    };
  },

  getRatingBreakdown: async (productId: string): Promise<Array<{ stars: number; count: number }>> => {
    if (!isSupabaseConfigured) {
      await delay();
      return [];
    }
    const { data, error } = await supabase.rpc('get_rating_breakdown', {
      p_product_id: productId,
    });
    if (error) throw error;
    return (data ?? []) as Array<{ stars: number; count: number }>;
  },

  voteHelpful: async (reviewId: string, userId: number, helpful: boolean) => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.rpc('vote_review', {
      p_review_id: reviewId,
      p_user_id: userId,
      p_helpful: helpful,
    });
    if (error) throw error;
  },

  getHelpfulCount: async (reviewId: string): Promise<number> => {
    if (!isSupabaseConfigured) return 0;
    const { data, error } = await supabase.rpc('get_helpful_count', {
      p_review_id: reviewId,
    });
    if (error) return 0;
    return (data as number) ?? 0;
  },
};

export const promotionQueries = {
  getActive: async (type?: 'new_arrival' | 'sale' | 'featured') => {
    if (!isSupabaseConfigured) { await delay(); return []; }
    let query = supabase
      .from('promotions')
      .select('*')
      .eq('is_active', true)
      .lte('starts_at', new Date().toISOString())
      .or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`);

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  },

  getProductsByPromotion: async (promotionId: string) => {
    if (!isSupabaseConfigured) { await delay(); return []; }
    const { data: promotion } = await supabase
      .from('promotions')
      .select('product_ids')
      .eq('id', promotionId)
      .maybeSingle();

    if (!promotion || !promotion.product_ids?.length) return [];

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .in('id', promotion.product_ids)
      .eq('is_active', true);

    if (error) throw error;
    return data;
  },

  getPromoEndDates: async (): Promise<Record<string, string>> => {
    if (!isSupabaseConfigured) { await delay(); return {}; }
    const { data: promotions } = await supabase
      .from('promotions')
      .select('product_ids, ends_at')
      .eq('is_active', true)
      .not('ends_at', 'is', null)
      .lte('starts_at', new Date().toISOString())
      .gte('ends_at', new Date().toISOString());

    if (!promotions) return {};

    const map: Record<string, string> = {};
    for (const promo of promotions) {
      if (promo.product_ids && promo.ends_at) {
        for (const pid of promo.product_ids) {
          // Keep the earliest end date if multiple promotions overlap
          if (!map[pid] || promo.ends_at < map[pid]) {
            map[pid] = promo.ends_at;
          }
        }
      }
    }
    return map;
  },
};

export const referralQueries = {
  getByCode: async (code: string) => {
    if (!isSupabaseConfigured) { await delay(); return null; }
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referral_code', code)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  create: async (telegramId: number) => {
    if (!isSupabaseConfigured) {
      await delay();
      return { id: `ref-${Date.now()}`, referrer_telegram_id: telegramId, referral_code: `REF${telegramId}${Math.random().toString(36).substring(7).toUpperCase()}`, bonus_amount: 50000, is_redeemed: false, redeemed_at: null, created_at: new Date().toISOString() } as Referral;
    }
    const code = `REF${telegramId}${Math.random().toString(36).substring(7).toUpperCase()}`;

    const { data, error } = await supabase
      .from('referrals')
      .insert({
        referrer_telegram_id: telegramId,
        referral_code: code,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  getByReferrer: async (telegramId: number) => {
    if (!isSupabaseConfigured) { await delay(); return []; }
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_telegram_id', telegramId);

    if (error) throw error;
    return data;
  },

  redeem: async (referralId: string, referredTelegramId: number) => {
    if (!isSupabaseConfigured) { await delay(); return null; }
    const { data, error } = await supabase
      .from('referrals')
      .update({
        referred_telegram_id: referredTelegramId,
        is_redeemed: true,
        redeemed_at: new Date().toISOString(),
      })
      .eq('id', referralId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

export type Banner = {
  id: string;
  title: { ru: string; uz: string };
  subtitle: { ru: string; uz: string };
  image_url: string;
  link_url: string | null;
  link_label: { ru: string; uz: string } | null;
  bg_color: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type DeliveryZone = {
  id: string;
  city_ru: string;
  city_uz: string;
  region_ru: string;
  region_uz: string;
  standard_price: number;
  express_price: number;
  standard_days_min: number;
  standard_days_max: number;
  express_days_min: number;
  express_days_max: number;
  free_threshold: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export const deliveryZoneQueries = {
  getActive: async (): Promise<DeliveryZone[]> => {
    if (!isSupabaseConfigured) { await delay(); return mockDeliveryZones.filter((z) => z.is_active); }
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []) as DeliveryZone[];
  },

  getAll: async (): Promise<DeliveryZone[]> => {
    if (!isSupabaseConfigured) { await delay(); return mockDeliveryZones; }
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []) as DeliveryZone[];
  },

  create: async (zone: Omit<DeliveryZone, 'id' | 'created_at' | 'updated_at'>): Promise<DeliveryZone> => {
    if (!isSupabaseConfigured) { await delay(); return { ...zone, id: `zone-${Date.now()}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; }
    const { data, error } = await supabase
      .from('delivery_zones')
      .insert(zone)
      .select()
      .single();
    if (error) throw error;
    return data as DeliveryZone;
  },

  update: async (id: string, zone: Partial<Omit<DeliveryZone, 'id' | 'created_at' | 'updated_at'>>): Promise<DeliveryZone> => {
    if (!isSupabaseConfigured) { await delay(); const z = mockDeliveryZones.find((z) => z.id === id); if (z) Object.assign(z, zone); return z as DeliveryZone; }
    const { data, error } = await supabase
      .from('delivery_zones')
      .update({ ...zone, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as DeliveryZone;
  },

  delete: async (id: string): Promise<void> => {
    if (!isSupabaseConfigured) { await delay(); return; }
    const { error } = await supabase.from('delivery_zones').delete().eq('id', id);
    if (error) throw error;
  },
};

export const bannerQueries = {
  getActive: async (): Promise<Banner[]> => {
    if (!isSupabaseConfigured) { await delay(); return mockBanners.filter((b) => b.is_active); }
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Banner[];
  },

  getAll: async (): Promise<Banner[]> => {
    if (!isSupabaseConfigured) { await delay(); return mockBanners; }
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Banner[];
  },

  create: async (banner: Omit<Banner, 'id' | 'created_at' | 'updated_at'>): Promise<Banner> => {
    if (!isSupabaseConfigured) { await delay(); return { ...banner, id: `banner-${Date.now()}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; }
    const { data, error } = await supabase
      .from('banners')
      .insert(banner)
      .select()
      .single();
    if (error) throw error;
    return data as Banner;
  },

  update: async (id: string, banner: Partial<Omit<Banner, 'id' | 'created_at' | 'updated_at'>>): Promise<Banner> => {
    if (!isSupabaseConfigured) { await delay(); return mockBanners[0] as Banner; }
    const { data, error } = await supabase
      .from('banners')
      .update({ ...banner, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Banner;
  },

  delete: async (id: string): Promise<void> => {
    if (!isSupabaseConfigured) { await delay(); return; }
    const { error } = await supabase.from('banners').delete().eq('id', id);
    if (error) throw error;
  },
};

export const paymentQueries = {
  createPayment: async (orderId: string, amount: number, paymentMethod: 'payme' | 'click' | 'uzum') => {
    if (!isSupabaseConfigured) { await delay(); return { paymentUrl: null, orderId }; }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/create-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'Apikey': anonKey,
        },
        body: JSON.stringify({ orderId, amount, paymentMethod }),
      });

      if (response.status === 404) {
        await supabase.from('orders').update({ status: 'new' }).eq('id', orderId);
        return { paymentUrl: null, orderId };
      }

      if (!response.ok) {
        throw new Error('Failed to create payment');
      }

      return response.json();
    } catch {
      await supabase.from('orders').update({ status: 'new' }).eq('id', orderId);
      return { paymentUrl: null, orderId };
    }
  },
};

export const favoriteQueries = {
  getByUser: async (telegramUserId: number) => {
    if (!isSupabaseConfigured || !telegramUserId) return [];
    const { data, error } = await supabase
      .from('favorites')
      .select('*, products(*)')
      .eq('telegram_user_id', telegramUserId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({ ...row.products, favoriteId: row.id })) as (Product & { favoriteId: string })[];
  },

  getProductIds: async (telegramUserId: number) => {
    if (!isSupabaseConfigured || !telegramUserId) return [] as string[];
    const { data, error } = await supabase
      .from('favorites')
      .select('product_id')
      .eq('telegram_user_id', telegramUserId);
    if (error) throw error;
    return (data ?? []).map((row) => row.product_id) as string[];
  },

  add: async (telegramUserId: number, productId: string) => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase
      .from('favorites')
      .insert({ telegram_user_id: telegramUserId, product_id: productId });
    if (error && !error.message.includes('unique')) throw error;
  },

  remove: async (telegramUserId: number, productId: string) => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('telegram_user_id', telegramUserId)
      .eq('product_id', productId);
    if (error) throw error;
  },
};

export type Coupon = Database['public']['Tables']['coupons']['Row'];
export type CouponUsage = Database['public']['Tables']['coupon_usage']['Row'];
export type Return = Database['public']['Tables']['returns']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type AuditLogEntry = Database['public']['Tables']['audit_log']['Row'];
export type ProductRelation = Database['public']['Tables']['product_relations']['Row'];

export const couponQueries = {
  validate: async (code: string, telegramUserId: number, orderAmount: number) => {
    if (!isSupabaseConfigured) return { valid: true, coupon: null, discount: 0, error: null };
    const { data: coupon, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .maybeSingle();
    if (error || !coupon) return { valid: false, coupon: null, discount: 0, error: 'Купон не найден' };
    if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) return { valid: false, coupon, discount: 0, error: 'Купон истёк' };
    if (new Date(coupon.valid_from) > new Date()) return { valid: false, coupon, discount: 0, error: 'Купон ещё не активен' };
    if (orderAmount < coupon.min_order_amount) return { valid: false, coupon, discount: 0, error: `Минимальная сумма: ${coupon.min_order_amount}` };
    if (coupon.max_uses_total) {
      const { count } = await supabase.from('coupon_usage').select('*', { count: 'exact', head: true }).eq('coupon_id', coupon.id);
      if ((count ?? 0) >= coupon.max_uses_total) return { valid: false, coupon, discount: 0, error: 'Купон закончился' };
    }
    const { count: userCount } = await supabase.from('coupon_usage').select('*', { count: 'exact', head: true }).eq('coupon_id', coupon.id).eq('telegram_user_id', telegramUserId);
    if ((userCount ?? 0) >= coupon.max_uses_per_user) return { valid: false, coupon, discount: 0, error: 'Вы уже использовали этот купон' };
    if (coupon.new_customers_only) {
      const { count: orderCount } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('telegram_user_id', telegramUserId);
      if ((orderCount ?? 0) > 0) return { valid: false, coupon, discount: 0, error: 'Купон только для новых клиентов' };
    }
    const discount = coupon.type === 'percent' ? Math.round(orderAmount * coupon.value / 100) : Math.min(coupon.value, orderAmount);
    return { valid: true, coupon, discount, error: null };
  },

  recordUsage: async (couponId: string, telegramUserId: number, orderId?: string) => {
    if (!isSupabaseConfigured) return;
    await supabase.from('coupon_usage').insert({ coupon_id: couponId, telegram_user_id: telegramUserId, order_id: orderId ?? null });
  },

  getAll: async () => {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  create: async (coupon: Omit<Coupon, 'id' | 'created_at' | 'updated_at'>) => {
    if (!isSupabaseConfigured) return { ...coupon, id: `coupon-${Date.now()}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Coupon;
    const { data, error } = await supabase.from('coupons').insert(coupon).select().single();
    if (error) throw error;
    return data as Coupon;
  },

  update: async (id: string, updates: Partial<Omit<Coupon, 'id' | 'created_at' | 'updated_at'>>) => {
    if (!isSupabaseConfigured) return {} as Coupon;
    const { data, error } = await supabase.from('coupons').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw error;
    return data as Coupon;
  },

  delete: async (id: string) => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('coupons').delete().eq('id', id);
    if (error) throw error;
  },

  getUsageStats: async (couponId: string) => {
    if (!isSupabaseConfigured) return { totalUses: 0, uniqueUsers: 0 };
    const { data } = await supabase.from('coupon_usage').select('telegram_user_id').eq('coupon_id', couponId);
    const users = new Set((data ?? []).map((u) => u.telegram_user_id));
    return { totalUses: data?.length ?? 0, uniqueUsers: users.size };
  },
};

export const returnQueries = {
  create: async (returnData: Omit<Return, 'id' | 'created_at' | 'updated_at' | 'status' | 'refund_amount' | 'admin_note'>) => {
    if (!isSupabaseConfigured) return { ...returnData, id: `ret-${Date.now()}`, status: 'pending' as const, refund_amount: 0, admin_note: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Return;
    const { data, error } = await supabase.from('returns').insert(returnData).select().single();
    if (error) throw error;
    return data as Return;
  },

  getByUser: async (telegramUserId: number) => {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.from('returns').select('*').eq('telegram_user_id', telegramUserId).order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  getAll: async () => {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.from('returns').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  updateStatus: async (id: string, status: Return['status'], adminNote?: string) => {
    if (!isSupabaseConfigured) return {} as Return;
    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (adminNote) updates.admin_note = adminNote;
    if (status === 'refunded') updates.refund_amount = 0;
    const { data, error } = await supabase.from('returns').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data as Return;
  },
};

export const notificationQueries = {
  getByUser: async (telegramUserId: number) => {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.from('notifications').select('*').eq('telegram_user_id', telegramUserId).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return data ?? [];
  },

  getUnreadCount: async (telegramUserId: number) => {
    if (!isSupabaseConfigured) return 0;
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('telegram_user_id', telegramUserId).eq('is_read', false);
    return count ?? 0;
  },

  markAsRead: async (id: string) => {
    if (!isSupabaseConfigured) return;
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  },

  markAllAsRead: async (telegramUserId: number) => {
    if (!isSupabaseConfigured) return;
    await supabase.from('notifications').update({ is_read: true }).eq('telegram_user_id', telegramUserId).eq('is_read', false);
  },

  create: async (notification: Omit<Notification, 'id' | 'created_at' | 'is_read' | 'sent_at'>) => {
    if (!isSupabaseConfigured) return;
    await supabase.from('notifications').insert(notification);
  },
};

export const auditLogQueries = {
  log: async (entry: Omit<AuditLogEntry, 'id' | 'created_at' | 'ip_address' | 'entity_id'> & { entity_id?: string | null; ip_address?: string | null }) => {
    if (!isSupabaseConfigured) return;
    await supabase.from('audit_log').insert({ ...entry, entity_id: entry.entity_id ?? null, ip_address: entry.ip_address ?? null });
  },

  getAll: async (limit = 100) => {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  getByEntity: async (entityType: string, entityId?: string) => {
    if (!isSupabaseConfigured) return [];
    let query = supabase.from('audit_log').select('*').eq('entity_type', entityType).order('created_at', { ascending: false });
    if (entityId) query = query.eq('entity_id', entityId);
    const { data, error } = await query.limit(50);
    if (error) throw error;
    return data ?? [];
  },

  getByAdmin: async (adminId: string) => {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.from('audit_log').select('*').eq('admin_id', adminId).order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return data ?? [];
  },
};

export const productRelationQueries = {
  getRelated: async (productId: string, type?: ProductRelation['relation_type']) => {
    if (!isSupabaseConfigured) return [];
    let query = supabase.from('product_relations').select('*, products!product_relations_related_product_id_fkey(*)').eq('product_id', productId).order('sort_order');
    if (type) query = query.eq('relation_type', type);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  getUpsells: async (productId: string) => {
    return productRelationQueries.getRelated(productId, 'upsell');
  },

  getCrossSells: async (productId: string) => {
    return productRelationQueries.getRelated(productId, 'cross_sell');
  },

  create: async (relation: Omit<ProductRelation, 'id' | 'created_at'>) => {
    if (!isSupabaseConfigured) return { ...relation, id: `pr-${Date.now()}`, created_at: new Date().toISOString() } as ProductRelation;
    const { data, error } = await supabase.from('product_relations').insert(relation).select().single();
    if (error) throw error;
    return data as ProductRelation;
  },

  delete: async (id: string) => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('product_relations').delete().eq('id', id);
    if (error) throw error;
  },
};

export type PriceRule = Database['public']['Tables']['price_rules']['Row'];

export const priceRuleQueries = {
  getActive: async (): Promise<PriceRule[]> => {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('price_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });
    if (error) throw error;
    return (data ?? []) as PriceRule[];
  },

  calculateDiscount: async (totalAmount: number, itemsCount: number, userRole = 'customer') => {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase.rpc('calculate_cart_discount', {
      p_total_amount: totalAmount,
      p_items_count: itemsCount,
      p_user_role: userRole,
    });
    if (error) throw error;
    return data?.[0] ?? null;
  },

  create: async (rule: Omit<PriceRule, 'id' | 'created_at' | 'updated_at'>) => {
    if (!isSupabaseConfigured) return { ...rule, id: `pr-${Date.now()}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as PriceRule;
    const { data, error } = await supabase.from('price_rules').insert(rule).select().single();
    if (error) throw error;
    return data as PriceRule;
  },

  update: async (id: string, updates: Partial<Omit<PriceRule, 'id' | 'created_at' | 'updated_at'>>) => {
    if (!isSupabaseConfigured) return {} as PriceRule;
    const { data, error } = await supabase.from('price_rules').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw error;
    return data as PriceRule;
  },

  delete: async (id: string) => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('price_rules').delete().eq('id', id);
    if (error) throw error;
  },
};


export const notificationSubscriptionQueries = {
  subscribe: async (userId: number, productId: string, type: 'price_drop' | 'back_in_stock' | 'low_stock', targetPrice?: number) => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.rpc('subscribe_notification', {
      p_user_id: userId,
      p_product_id: productId,
      p_type: type,
      p_target_price: targetPrice || null,
    });
    if (error) throw error;
  },

  unsubscribe: async (userId: number, productId: string, type: string) => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.rpc('unsubscribe_notification', {
      p_user_id: userId,
      p_product_id: productId,
      p_type: type,
    });
    if (error) throw error;
  },

  getUserSubscriptions: async (userId: number, productId: string) => {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.rpc('get_user_subscriptions', {
      p_user_id: userId,
      p_product_id: productId,
    });
    if (error) throw error;
    return (data ?? []) as Array<{ type: string; is_active: boolean; target_price: number | null }>;
  },

  triggerSmartNotifications: async (type?: string, productId?: string) => {
    if (!isSupabaseConfigured) return;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    await fetch(`${supabaseUrl}/functions/v1/smart-notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'Apikey': anonKey,
      },
      body: JSON.stringify({ type, product_id: productId }),
    });
  },
};


export interface SocialProof {
  product_id: string;
  bought_today: number;
  total_bought: number;
  avg_rating: number;
  review_count: number;
}

export const socialProofQueries = {
  getForProducts: async (productIds: string[]): Promise<SocialProof[]> => {
    if (!productIds.length || !isSupabaseConfigured) {
      return productIds.map((id) => ({
        product_id: id,
        bought_today: 0,
        total_bought: 0,
        avg_rating: 0,
        review_count: 0,
      }));
    }
    const { data, error } = await supabase.rpc('get_social_proof', {
      p_product_ids: productIds,
    });
    if (error) throw error;
    return (data ?? []) as SocialProof[];
  },

  getBoughtToday: async (productId: string): Promise<number> => {
    if (!isSupabaseConfigured) return 0;
    const { data, error } = await supabase.rpc('get_bought_today', {
      p_product_id: productId,
    });
    if (error) return 0;
    return (data as number) ?? 0;
  },
};


export const urgencyQueries = {
  recordViewer: async (productId: string, userId: number) => {
    if (!isSupabaseConfigured || !userId) return;
    await supabase.rpc('record_product_viewer', {
      p_product_id: productId,
      p_user_id: userId,
    });
  },

  getActiveViewers: async (productId: string): Promise<number> => {
    if (!isSupabaseConfigured) return Math.floor(Math.random() * 5) + 1;
    const { data, error } = await supabase.rpc('get_active_viewer_count', {
      p_product_id: productId,
    });
    if (error) return 0;
    return (data as number) ?? 0;
  },

  getCartPressure: async (productId: string): Promise<number> => {
    if (!isSupabaseConfigured) return 0;
    const { data, error } = await supabase.rpc('get_cart_pressure', {
      p_product_id: productId,
    });
    if (error) return 0;
    return (data as number) ?? 0;
  },
};


export type Wallet = {
  id: string;
  telegram_id: number;
  balance: number;
  total_earned: number;
  total_spent: number;
  frozen: number;
  daily_earned: number;
  monthly_earned: number;
  is_frozen: boolean;
  created_at: string;
  updated_at: string;
};

export type WalletTransaction = {
  id: string;
  wallet_id: string;
  telegram_id: number;
  type: 'earn' | 'spend' | 'freeze' | 'unfreeze' | 'admin_adjust' | 'expire';
  amount: number;
  balance_after: number;
  source: string;
  description: string | null;
  reference_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type CoinReward = {
  id: string;
  action: string;
  amount: number;
  description: string | null;
  is_active: boolean;
  max_per_user_day: number | null;
  max_per_user_month: number | null;
  cooldown_hours: number;
  created_at: string;
  updated_at: string;
};

export type RewardStoreItem = {
  id: string;
  name: string;
  name_uz: string | null;
  description: string | null;
  description_uz: string | null;
  cost: number;
  discount_type: 'percent' | 'fixed' | 'free_delivery' | 'exclusive' | 'cashback';
  discount_value: number;
  icon_url: string | null;
  is_active: boolean;
  stock: number;
  max_per_user: number;
  min_order_amount: number;
  valid_from: string;
  valid_until: string | null;
  usage_count: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Treasury = {
  id: string;
  balance: number;
  reserved: number;
  total_minted: number;
  total_returned: number;
  created_at: string;
  updated_at: string;
};

export type EconomyStats = {
  total_supply: number;
  treasury_balance: number;
  reserved: number;
  circulating: number;
  total_minted: number;
  total_returned: number;
  user_count: number;
  actual_total: number;
  treasury_pct: number;
  circulating_pct: number;
};

export type CoinConfig = {
  key: string;
  value: unknown;
  updated_at: string;
};

export type Invite = {
  id: string;
  inviter_telegram_id: number;
  invited_telegram_id: number | null;
  invite_code: string;
  status: 'pending' | 'registered' | 'first_order';
  inviter_reward: number;
  invited_reward: number;
  created_at: string;
  registered_at: string | null;
  first_order_at: string | null;
};

export type AdminCoinLog = {
  id: string;
  admin_id: string;
  action: string;
  target_user: number | null;
  amount: number | null;
  old_balance: number | null;
  new_balance: number | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const MOCK_WALLET: Wallet = {
  id: 'wallet-mock', telegram_id: 0, balance: 0, total_earned: 0, total_spent: 0,
  frozen: 0, daily_earned: 0, monthly_earned: 0, is_frozen: false,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
};

export const walletQueries = {
  getOrCreate: async (telegramId: number): Promise<Wallet> => {
    if (!isSupabaseConfigured) { await delay(); return { ...MOCK_WALLET, telegram_id: telegramId }; }
    const { data, error } = await supabase.rpc('get_or_create_wallet', { p_telegram_id: telegramId });
    if (error) throw error;
    return data as Wallet;
  },

  getStats: async (telegramId: number) => {
    if (!isSupabaseConfigured) { await delay(); return { wallet: { ...MOCK_WALLET, telegram_id: telegramId }, total_transactions: 0 }; }
    const { data, error } = await supabase.rpc('get_wallet_stats', { p_telegram_id: telegramId });
    if (error) throw error;
    return data as { wallet: Wallet | null; total_transactions: number };
  },

  getTransactions: async (telegramId: number, limit = 50, offset = 0): Promise<WalletTransaction[]> => {
    if (!isSupabaseConfigured) { await delay(); return []; }
    const { data: wallet } = await supabase.from('wallets').select('id').eq('telegram_id', telegramId).maybeSingle();
    if (!wallet) return [];
    const { data, error } = await supabase
      .from('wallet_transactions').select('*').eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    return (data ?? []) as WalletTransaction[];
  },

  addCoins: async (telegramId: number, amount: number, source: string, description?: string, referenceId?: string, metadata?: Record<string, unknown>) => {
    if (!isSupabaseConfigured) { await delay(); return { ...MOCK_WALLET, telegram_id: telegramId, balance: amount }; }
    const { data, error } = await supabase.rpc('add_coins', {
      p_telegram_id: telegramId, p_amount: amount, p_source: source,
      p_description: description || null, p_reference_id: referenceId || null,
      p_metadata: metadata ? JSON.stringify(metadata) : '{}',
    });
    if (error) throw error;
    return ((data as Record<string, unknown>)?.wallet as Wallet) ?? data as Wallet;
  },

  spendCoins: async (telegramId: number, amount: number, source: string, description?: string, referenceId?: string, metadata?: Record<string, unknown>) => {
    if (!isSupabaseConfigured) { await delay(); return { ...MOCK_WALLET, telegram_id: telegramId }; }
    const { data, error } = await supabase.rpc('spend_coins', {
      p_telegram_id: telegramId, p_amount: amount, p_source: source,
      p_description: description || null, p_reference_id: referenceId || null,
      p_metadata: metadata ? JSON.stringify(metadata) : '{}',
    });
    if (error) throw error;
    return ((data as Record<string, unknown>)?.wallet as Wallet) ?? data as Wallet;
  },

  processInviteReward: async (inviterId: number, invitedId: number) => {
    if (!isSupabaseConfigured) { await delay(); return { inviter_balance: 1, invited_balance: 1, inviter_reward: 1, invited_reward: 1 }; }
    const { data, error } = await supabase.rpc('process_invite_reward', {
      p_inviter_telegram_id: inviterId, p_invited_telegram_id: invitedId,
    });
    if (error) throw error;
    return data as { inviter_balance: number; invited_balance: number; inviter_reward: number; invited_reward: number };
  },

  purchaseReward: async (telegramId: number, rewardId: string) => {
    if (!isSupabaseConfigured) { await delay(); return { success: true, reward_name: 'Reward' }; }
    const { data, error } = await supabase.rpc('purchase_reward', {
      p_telegram_id: telegramId, p_reward_id: rewardId,
    });
    if (error) throw error;
    return data as { success: boolean; reward_name: string };
  },

  getRewardStore: async (): Promise<RewardStoreItem[]> => {
    if (!isSupabaseConfigured) { await delay(); return []; }
    const { data, error } = await supabase.from('reward_store').select('*').eq('is_active', true).order('sort_order');
    if (error) throw error;
    return (data ?? []) as RewardStoreItem[];
  },

  getAllRewardStore: async (): Promise<RewardStoreItem[]> => {
    if (!isSupabaseConfigured) { await delay(); return []; }
    const { data, error } = await supabase.from('reward_store').select('*').order('sort_order');
    if (error) throw error;
    return (data ?? []) as RewardStoreItem[];
  },

  getRewards: async (): Promise<CoinReward[]> => {
    if (!isSupabaseConfigured) { await delay(); return []; }
    const { data, error } = await supabase.from('coin_rewards').select('*').order('amount', { ascending: false });
    if (error) throw error;
    return (data ?? []) as CoinReward[];
  },

  getEconomyStats: async (): Promise<EconomyStats> => {
    if (!isSupabaseConfigured) {
      await delay();
      return { total_supply: 1000000, treasury_balance: 700000, reserved: 100000, circulating: 0, total_minted: 0, total_returned: 0, user_count: 0, actual_total: 800000, treasury_pct: 100, circulating_pct: 0 };
    }
    const { data, error } = await supabase.rpc('get_economy_stats');
    if (error) throw error;
    return data as EconomyStats;
  },

  getConfig: async (): Promise<CoinConfig[]> => {
    if (!isSupabaseConfigured) { await delay(); return []; }
    const { data, error } = await supabase.from('coin_config').select('*');
    if (error) throw error;
    return (data ?? []) as CoinConfig[];
  },

  updateConfig: async (key: string, value: unknown) => {
    if (!isSupabaseConfigured) { await delay(); return; }
    const { error } = await supabase.from('coin_config').upsert({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
  },

  adminAdjust: async (adminId: string, targetTelegramId: number, amount: number, reason: string) => {
    if (!isSupabaseConfigured) { await delay(); return { wallet: MOCK_WALLET }; }
    const { data, error } = await supabase.rpc('admin_adjust_balance', {
      p_admin_id: adminId, p_target_telegram_id: targetTelegramId, p_amount: amount, p_reason: reason,
    });
    if (error) throw error;
    return data as { wallet: Wallet };
  },

  adminFreeze: async (adminId: string, targetTelegramId: number, freeze: boolean, reason: string) => {
    if (!isSupabaseConfigured) { await delay(); return { wallet: MOCK_WALLET }; }
    const { data, error } = await supabase.rpc('admin_freeze_wallet', {
      p_admin_id: adminId, p_target_telegram_id: targetTelegramId, p_freeze: freeze, p_reason: reason,
    });
    if (error) throw error;
    return data as { wallet: Wallet };
  },

  getAdminLog: async (limit = 50): Promise<AdminCoinLog[]> => {
    if (!isSupabaseConfigured) { await delay(); return []; }
    const { data, error } = await supabase.from('admin_coin_log').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []) as AdminCoinLog[];
  },

  getInvites: async (inviterTelegramId?: number): Promise<Invite[]> => {
    if (!isSupabaseConfigured) { await delay(); return []; }
    let query = supabase.from('invites').select('*').order('created_at', { ascending: false });
    if (inviterTelegramId) query = query.eq('inviter_telegram_id', inviterTelegramId);
    const { data, error } = await query.limit(100);
    if (error) throw error;
    return (data ?? []) as Invite[];
  },

  createInvite: async (inviterTelegramId: number): Promise<Invite> => {
    if (!isSupabaseConfigured) { await delay(); return { id: `inv-${Date.now()}`, inviter_telegram_id: inviterTelegramId, invite_code: `INV${inviterTelegramId}${Math.random().toString(36).substring(7).toUpperCase()}`, status: 'pending', inviter_reward: 0, invited_reward: 0, created_at: new Date().toISOString(), registered_at: null, first_order_at: null, invited_telegram_id: null }; }
    const code = `INV${inviterTelegramId}${Math.random().toString(36).substring(7).toUpperCase()}`;
    const { data, error } = await supabase.from('invites').insert({ inviter_telegram_id: inviterTelegramId, invite_code: code }).select().single();
    if (error) throw error;
    return data as Invite;
  },

  updateInviteReward: async (inviteId: string, inviterReward: number, invitedReward: number) => {
    if (!isSupabaseConfigured) { await delay(); return; }
    const { error } = await supabase.from('invites').update({ inviter_reward: inviterReward, invited_reward: invitedReward }).eq('id', inviteId);
    if (error) throw error;
  },
};

export const cartSyncQueries = {
  save: async (userId: number, items: unknown[]) => {
    if (!isSupabaseConfigured || !userId) return;
    const { error } = await supabase.rpc('upsert_cart', { p_user_id: userId, p_items: JSON.stringify(items) });
    if (error) throw error;
  },
  load: async (userId: number): Promise<unknown[]> => {
    if (!isSupabaseConfigured || !userId) return [];
    const { data, error } = await supabase.rpc('get_user_cart', { p_user_id: userId });
    if (error) throw error;
    try { return typeof data === 'string' ? JSON.parse(data) : (data ?? []); } catch { return []; }
  },
};
