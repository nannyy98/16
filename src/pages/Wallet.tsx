import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet as WalletIcon, Gift, Users, ChevronLeft,
  ShoppingBag, Clock, Coins, TrendingDown, Star, Zap, Info,
  Package,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { useTranslation } from '../hooks/useTranslation';
import { useAppStore, selectUserId } from '../store/useAppStore';
import {
  useWalletStats, useWalletTransactions, useRewardStore,
  useCoinRewards, usePurchaseReward,
} from '../lib/supabase/hooks';
import { toast } from '../lib/toastStore';
import type { RewardStoreItem } from '../lib/supabase/queries';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const txIconMap: Record<string, typeof Gift> = {
  invite_friend: Users, friend_registered: Users, friend_first_order: Gift,
  first_order: Star, purchase: ShoppingBag, daily_visit: Zap, review: Star,
  birthday: Gift, reward_store: Package,
};
const txColorMap: Record<string, string> = {
  invite_friend: 'bg-emerald-50 text-emerald-600',
  friend_registered: 'bg-blue-50 text-blue-600',
  friend_first_order: 'bg-purple-50 text-purple-600',
  first_order: 'bg-amber-50 text-amber-600',
  purchase: 'bg-surface-100 text-surface-600',
  daily_visit: 'bg-cyan-50 text-cyan-600',
  review: 'bg-pink-50 text-pink-600',
  birthday: 'bg-red-50 text-red-600',
  reward_store: 'bg-orange-50 text-orange-600',
};

export const WalletPage = () => {
  const { language } = useTranslation();
  const navigate = useNavigate();
  const userId = useAppStore(selectUserId);

  const { data: stats, isLoading: statsLoading } = useWalletStats(userId);
  const { data: transactions = [], isLoading: txLoading } = useWalletTransactions(userId);
  const { data: rewardStore = [] } = useRewardStore();
  const { data: rewards = [] } = useCoinRewards();
  const purchaseRewardMutation = usePurchaseReward();

  const [activeTab, setActiveTab] = useState<'history' | 'earn' | 'store'>('history');
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  const wallet = stats?.wallet;
  const balance = wallet?.balance ?? 0;
  const totalEarned = wallet?.total_earned ?? 0;
  const totalSpent = wallet?.total_spent ?? 0;
  const dailyEarned = wallet?.daily_earned ?? 0;

  const handlePurchase = async (item: RewardStoreItem) => {
    if (balance < item.cost) {
      toast.error(language === 'ru' ? 'Недостаточно монет' : 'Yetarli emas');
      return;
    }
    setPurchasingId(item.id);
    try {
      await purchaseRewardMutation.mutateAsync({ telegramId: userId, rewardId: item.id });
      toast.success(language === 'ru' ? `Приобретено: ${item.name}` : `Sotib olindi: ${item.name_uz || item.name}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error';
      toast.error(msg.includes('limit') ? (language === 'ru' ? 'Лимит покупок' : 'Sotib olish limiti') : (language === 'ru' ? 'Ошибка' : 'Xatolik'));
    } finally {
      setPurchasingId(null);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-4 space-y-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-surface-100 dark:bg-surface-700 flex items-center justify-center active:scale-95 transition">
            <ChevronLeft className="w-5 h-5 text-surface-900 dark:text-white" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-surface-900 dark:text-white">
              {language === 'ru' ? 'Кошелёк' : 'Hamyon'}
            </h1>
            <p className="text-xs text-surface-500 dark:text-surface-400">ShopCoin</p>
          </div>
        </div>

        {/* Balance Card — dark brand card */}
        <div className="bg-surface-900 rounded-2xl p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-28 h-28 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
                <WalletIcon className="w-4 h-4 text-accent" />
              </div>
              <span className="text-white/60 text-xs font-medium">
                {language === 'ru' ? 'Баланс' : 'Balans'}
              </span>
            </div>

            {statsLoading ? (
              <div className="h-10 skeleton rounded-xl mb-3" />
            ) : (
              <p className="text-4xl font-extrabold tracking-tight mb-4">
                {balance.toLocaleString()}
                <span className="text-lg font-bold text-white/40 ml-1">coin</span>
              </p>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/8 rounded-xl px-2.5 py-2.5">
                <p className="text-white/40 text-[10px] font-medium mb-0.5">
                  {language === 'ru' ? 'Заработано' : 'Tushum'}
                </p>
                <p className="font-bold text-emerald-400 text-sm">+{totalEarned}</p>
              </div>
              <div className="bg-white/8 rounded-xl px-2.5 py-2.5">
                <p className="text-white/40 text-[10px] font-medium mb-0.5">
                  {language === 'ru' ? 'Потрачено' : 'Xarajat'}
                </p>
                <p className="font-bold text-red-400 text-sm">-{totalSpent}</p>
              </div>
              <div className="bg-white/8 rounded-xl px-2.5 py-2.5">
                <p className="text-white/40 text-[10px] font-medium mb-0.5">
                  {language === 'ru' ? 'Лимит' : 'Limit'}
                </p>
                <p className="font-bold text-white/70 text-sm">{dailyEarned}/50</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate('/invite')}
            className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm hover-lift text-left">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center mb-2">
              <Users className="w-5 h-5 text-accent" />
            </div>
            <p className="font-semibold text-surface-900 dark:text-white text-sm">
              {language === 'ru' ? 'Пригласить друга' : "Do'st taklif qilish"}
            </p>
            <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
              +1 {language === 'ru' ? 'каждому' : 'har biriga'}
            </p>
          </button>

          <button onClick={() => setActiveTab('store')}
            className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm hover-lift text-left">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center mb-2">
              <ShoppingBag className="w-5 h-5 text-accent" />
            </div>
            <p className="font-semibold text-surface-900 dark:text-white text-sm">
              {language === 'ru' ? 'Магазин наград' : "Mukofotlar do'koni"}
            </p>
            <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
              {rewardStore.length} {language === 'ru' ? 'товаров' : 'mahsulot'}
            </p>
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex border-b border-surface-100 dark:border-surface-700">
            {([
              { key: 'history' as const, icon: Clock, label: language === 'ru' ? 'История' : 'Tarix' },
              { key: 'earn' as const, icon: Coins, label: language === 'ru' ? 'Заработать' : 'Tushum' },
              { key: 'store' as const, icon: ShoppingBag, label: language === 'ru' ? 'Магазин' : "Do'kon" },
            ]).map(({ key, icon: Icon, label }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-all ${
                  activeTab === key
                    ? 'text-surface-900 dark:text-white border-b-2 border-surface-900 dark:border-white'
                    : 'text-surface-400 dark:text-surface-500'
                }`}>
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* History */}
            {activeTab === 'history' && (
              <div className="space-y-2.5">
                {txLoading ? (
                  Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 skeleton rounded-xl" />)
                ) : transactions.length === 0 ? (
                  <div className="text-center py-10">
                    <Coins className="w-10 h-10 text-surface-200 dark:text-surface-700 mx-auto mb-2" />
                    <p className="text-surface-400 dark:text-surface-500 text-sm">
                      {language === 'ru' ? 'Пока нет операций' : "Hali operatsiyalar yo'q"}
                    </p>
                  </div>
                ) : transactions.map((tx) => {
                  const Icon = txIconMap[tx.source] || Coins;
                  const colorClass = txColorMap[tx.source] || 'bg-surface-50 text-surface-500';
                  const isEarn = tx.type === 'earn';
                  return (
                    <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-700/30">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
                          {tx.description || tx.source}
                        </p>
                        <p className="text-xs text-surface-400 dark:text-surface-500">
                          {formatDate(tx.created_at)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold text-sm ${isEarn ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {isEarn ? '+' : '-'}{tx.amount}
                        </p>
                        <p className="text-[10px] text-surface-400 dark:text-surface-500">
                          → {tx.balance_after}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Earn */}
            {activeTab === 'earn' && (
              <div className="space-y-2.5">
                {rewards.length === 0 ? (
                  <p className="text-center text-surface-400 text-sm py-8">
                    {language === 'ru' ? 'Скоро появятся' : 'Tez orada'}
                  </p>
                ) : rewards.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-700/30">
                    <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Coins className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-900 dark:text-white">
                        {r.description || r.action}
                      </p>
                      <p className="text-xs text-surface-400 dark:text-surface-500">
                        {r.max_per_user_day && `${language === 'ru' ? 'Макс.' : 'Maks.'} ${r.max_per_user_day}/${language === 'ru' ? 'день' : 'kun'}`}
                        {r.max_per_user_month && ` · ${r.max_per_user_month}/${language === 'ru' ? 'мес.' : 'oy'}`}
                      </p>
                    </div>
                    <div className="bg-surface-900 dark:bg-white text-white dark:text-surface-900 px-3 py-1 rounded-full text-xs font-bold flex-shrink-0">
                      +{r.amount}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Store */}
            {activeTab === 'store' && (
              <div className="space-y-2.5">
                {rewardStore.length === 0 ? (
                  <p className="text-center text-surface-400 text-sm py-8">
                    {language === 'ru' ? 'Магазин пуст' : "Do'kon bo'sh"}
                  </p>
                ) : rewardStore.map((item) => {
                  const canAfford = balance >= item.cost;
                  const outOfStock = item.stock === 0;
                  return (
                    <div key={item.id} className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-700/30">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center flex-shrink-0">
                          {item.discount_type === 'percent' && <TrendingDown className="w-4 h-4 text-accent" />}
                          {item.discount_type === 'free_delivery' && <Package className="w-4 h-4 text-accent" />}
                          {item.discount_type === 'exclusive' && <Star className="w-4 h-4 text-accent" />}
                          {item.discount_type === 'cashback' && <Coins className="w-4 h-4 text-accent" />}
                          {item.discount_type === 'fixed' && <Zap className="w-4 h-4 text-accent" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-surface-900 dark:text-white">{item.name}</p>
                            <span className="text-xs font-bold text-surface-900 dark:text-white whitespace-nowrap">
                              {item.cost} <Coins className="w-3 h-3 inline text-accent" />
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{item.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            {item.min_order_amount > 0 && (
                              <span className="text-[10px] text-surface-400 bg-surface-100 dark:bg-surface-600 px-1.5 py-0.5 rounded">
                                от {item.min_order_amount.toLocaleString()} сум
                              </span>
                            )}
                            {item.stock > 0 && (
                              <span className="text-[10px] text-surface-400">
                                {language === 'ru' ? `Осталось: ${item.stock}` : `Qoldi: ${item.stock}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handlePurchase(item)}
                        disabled={!canAfford || outOfStock || (purchaseRewardMutation.isPending && purchasingId === item.id)}
                        className={`w-full mt-3 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.97] ${
                          canAfford && !outOfStock
                            ? 'btn-brand'
                            : 'bg-surface-100 dark:bg-surface-600 text-surface-400 dark:text-surface-500 cursor-not-allowed'
                        }`}
                      >
                        {outOfStock ? (language === 'ru' ? 'Нет в наличии' : 'Mavjud emas')
                          : !canAfford ? (language === 'ru' ? 'Недостаточно монет' : 'Yetarli emas')
                          : purchaseRewardMutation.isPending && purchasingId === item.id ? '...'
                          : (language === 'ru' ? 'Приобрести' : 'Sotib olish')
                        }
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Info — warm surface, not blue */}
        <div className="bg-surface-100 dark:bg-surface-800 rounded-2xl p-4 flex gap-3">
          <Info className="w-5 h-5 text-surface-500 dark:text-surface-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-surface-600 dark:text-surface-300">
            <p className="font-medium text-surface-900 dark:text-white mb-1">
              {language === 'ru' ? 'Как заработать ShopCoin?' : 'ShopCoin qanday topish?'}
            </p>
            <ul className="space-y-1 text-xs text-surface-500 dark:text-surface-400">
              <li>• {language === 'ru' ? 'Приглашайте друзей — +1 каждому' : "Do'stlarni taklif qiling — har biriga +1"}</li>
              <li>• {language === 'ru' ? 'Покупки — +1 за 5 000 сум' : "Xaridlar — 5 000 so'm uchun +1"}</li>
              <li>• {language === 'ru' ? 'Первая покупка — +3' : 'Birinchi xarid — +3'}</li>
              <li>• {language === 'ru' ? 'Ежедневный визит — +1' : 'Kunlik tashrif — +1'}</li>
              <li>• {language === 'ru' ? 'Отзыв — +1' : 'Sharh — +1'}</li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
};
