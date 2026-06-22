import { useState } from 'react';
import {
  Coins, TrendingUp, TrendingDown,
  Shield, Settings, Activity, Search, UserPlus, UserMinus,
  Lock, Unlock, BarChart3,
} from 'lucide-react';
import { Layout } from '../../components/Layout';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore, selectUserId } from '../../store/useAppStore';
import {
  useEconomyStats, useCoinConfig, useUpdateCoinConfig,
  useAdminAdjust, useAdminFreeze, useAdminLog, useWalletStats,
} from '../../lib/supabase/hooks';
import { toast } from '../../lib/toastStore';

export const AdminEconomy = () => {
  const { language } = useTranslation();
  const adminId = String(useAppStore(selectUserId));

  const { data: stats, isLoading } = useEconomyStats();
  const { data: config = [] } = useCoinConfig();
  const { data: adminLog = [] } = useAdminLog(20);
  const updateConfig = useUpdateCoinConfig();
  const adjustMutation = useAdminAdjust();
  const freezeMutation = useAdminFreeze();

  const [activeSection, setActiveSection] = useState<'overview' | 'adjust' | 'config' | 'log'>('overview');
  const [searchUser, setSearchUser] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [targetUser, setTargetUser] = useState<number | null>(null);
  const { data: targetWallet } = useWalletStats(targetUser ?? 0);

  const getConfig = (key: string) => config.find(c => c.key === key)?.value;

  const handleAdjust = async (freeze: boolean) => {
    if (!targetUser) { toast.error('Введите ID пользователя'); return; }
    if (!freeze && (!adjustAmount || !adjustReason)) { toast.error('Заполните сумму и причину'); return; }

    try {
      if (freeze) {
        await freezeMutation.mutateAsync({ adminId, targetTelegramId: targetUser, freeze: true, reason: 'Admin freeze' });
      } else {
        await adjustMutation.mutateAsync({ adminId, targetTelegramId: targetUser, amount: Number(adjustAmount), reason: adjustReason });
      }
      toast.success(language === 'ru' ? 'Выполнено' : 'Bajarildi');
      setAdjustAmount('');
      setAdjustReason('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error';
      toast.error(msg);
    }
  };

  const handleToggleConfig = async (key: string) => {
    const current = getConfig(key);
    await updateConfig.mutateAsync({ key, value: !current });
  };

  const handleUpdateConfig = async (key: string, value: number) => {
    await updateConfig.mutateAsync({ key, value });
    toast.success(language === 'ru' ? 'Сохранено' : 'Saqlandi');
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-4 space-y-4 pb-24">
        {/* Header — no back button, Layout handles it */}
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-bold text-surface-900 dark:text-white">{language === 'ru' ? 'Экономика ShopCoin' : 'ShopCoin Iqtisodiyoti'}</h1>
            <p className="text-xs text-surface-500 dark:text-surface-400">{language === 'ru' ? 'Управление внутренней валютой' : 'Ichki valyutani boshqarish'}</p>
          </div>
        </div>

        {/* Nav tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {[
            { key: 'overview' as const, icon: BarChart3, label: language === 'ru' ? 'Обзор' : 'Ko\'rish' },
            { key: 'adjust' as const, icon: UserPlus, label: language === 'ru' ? 'Начислить' : 'Qo\'shish' },
            { key: 'config' as const, icon: Settings, label: language === 'ru' ? 'Настройки' : 'Sozlamalar' },
            { key: 'log' as const, icon: Activity, label: language === 'ru' ? 'Логи' : 'Jurnallar' },
          ].map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setActiveSection(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                activeSection === key ? 'bg-surface-900 text-white' : 'bg-surface-100 text-surface-600'
              }`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeSection === 'overview' && (
          <div className="space-y-4">
            {isLoading ? <div className="h-40 skeleton rounded-2xl" /> : stats && (
              <>
                {/* Supply breakdown */}
                <div className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" /> TOTAL_SUPPLY: {stats.total_supply.toLocaleString()}
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-surface-500">{language === 'ru' ? 'Treasury (резерв)' : 'Xazina'}</span>
                        <span className="font-bold">{stats.treasury_balance.toLocaleString()} ({stats.treasury_pct}%)</span>
                      </div>
                      <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                        <div className="h-full bg-surface-900 dark:bg-white rounded-full" style={{ width: `${stats.treasury_pct}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-surface-500">{language === 'ru' ? 'У пользователей' : 'Foydalanuvchilarda'}</span>
                        <span className="font-bold">{stats.circulating.toLocaleString()} ({stats.circulating_pct}%)</span>
                      </div>
                      <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${stats.circulating_pct}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-surface-500">{language === 'ru' ? 'Зарезервировано' : 'Zaxiralangan'}</span>
                        <span className="font-bold">{stats.reserved.toLocaleString()}</span>
                      </div>
                      <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(stats.reserved / stats.total_supply * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-surface-100 grid grid-cols-2 gap-2 text-xs text-surface-500">
                    <span>{language === 'ru' ? 'Всего отчеканено' : 'Jami qazilgan'}: {stats.total_minted.toLocaleString()}</span>
                    <span>{language === 'ru' ? 'Всего возвращено' : 'Jami qaytarilgan'}: {stats.total_returned.toLocaleString()}</span>
                    <span>{language === 'ru' ? 'Пользователей' : 'Foydalanuvchilar'}: {stats.user_count}</span>
                    <span>{language === 'ru' ? 'Факт. итого' : 'Haqiqiy jami'}: {stats.actual_total.toLocaleString()}</span>
                  </div>
                </div>

                {/* Flow indicator */}
                <div className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm">
                  <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4" /> {language === 'ru' ? 'Оборот монет' : 'Tangalar aylanmasi'}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface-50 dark:bg-surface-700/50 rounded-xl p-3 text-center">
                      <TrendingUp className="w-5 h-5 text-surface-900 dark:text-white mx-auto mb-1" />
                      <p className="text-lg font-bold text-surface-900 dark:text-white">{stats.total_minted.toLocaleString()}</p>
                      <p className="text-[10px] text-surface-500 dark:text-surface-400">{language === 'ru' ? 'Выдано' : 'Berildi'}</p>
                    </div>
                    <div className="bg-surface-50 dark:bg-surface-700/50 rounded-xl p-3 text-center">
                      <TrendingDown className="w-5 h-5 text-surface-500 dark:text-surface-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-surface-600 dark:text-surface-300">{stats.total_returned.toLocaleString()}</p>
                      <p className="text-[10px] text-surface-500 dark:text-surface-400">{language === 'ru' ? 'Возвращено' : 'Qaytarildi'}</p>
                    </div>
                  </div>
                  <p className="text-xs text-surface-500 mt-2 text-center">
                    {language === 'ru'
                      ? `Нетто: ${stats.total_minted - stats.total_returned > 0 ? '+' : ''}${(stats.total_minted - stats.total_returned).toLocaleString()}`
                      : `Sof: ${stats.total_minted - stats.total_returned > 0 ? '+' : ''}${(stats.total_minted - stats.total_returned).toLocaleString()}`}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Adjust balance */}
        {activeSection === 'adjust' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm">
              <h3 className="font-bold text-sm mb-3">{language === 'ru' ? 'Найти пользователя' : 'Foydalanuvchini topish'}</h3>
              <div className="flex gap-2">
                <input type="number" value={searchUser} onChange={e => setSearchUser(e.target.value)}
                  placeholder="Telegram ID"
                  className="flex-1 border border-surface-200 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-surface-700" />
                <button onClick={() => setTargetUser(Number(searchUser))}
                  className="bg-surface-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium">
                  <Search className="w-4 h-4" />
                </button>
              </div>

              {targetUser && targetWallet?.wallet && (
                <div className="mt-3 p-3 bg-surface-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">ID: {targetUser}</span>
                    <span className="font-bold">{targetWallet.wallet.balance} <Coins className="w-3.5 h-3.5 inline" /></span>
                  </div>
                  <div className="text-xs text-surface-500 mt-1">
                    Заработано: {targetWallet.wallet.total_earned} · Потрачено: {targetWallet.wallet.total_spent}
                    {targetWallet.wallet.is_frozen && <span className="ml-2 text-red-500 font-bold">ЗАМОРОЖЕН</span>}
                  </div>
                </div>
              )}
            </div>

            {targetUser && (
              <div className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm space-y-3">
                <h3 className="font-bold text-sm">{language === 'ru' ? 'Начислить / Списать' : "Qo'shish / Ayirish"}</h3>
                <input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)}
                  placeholder={language === 'ru' ? '+100 или -50' : '+100 yoki -50'}
                  className="w-full border border-surface-200 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-surface-700" />
                <input type="text" value={adjustReason} onChange={e => setAdjustReason(e.target.value)}
                  placeholder={language === 'ru' ? 'Причина' : 'Sabab'}
                  className="w-full border border-surface-200 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-surface-700" />
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleAdjust(false)} disabled={adjustMutation.isPending}
                    className="btn-brand py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-1 active:scale-[0.97]">
                    <UserPlus className="w-4 h-4" /> {language === 'ru' ? 'Начислить' : "Qo'shish"}
                  </button>
                  <button onClick={() => adjustMutation.mutateAsync({ adminId, targetTelegramId: targetUser, amount: -Math.abs(Number(adjustAmount)), reason: adjustReason || 'Admin deduct' })}
                    disabled={adjustMutation.isPending || !adjustAmount}
                    className="bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-1 active:scale-[0.97]">
                    <UserMinus className="w-4 h-4" /> {language === 'ru' ? 'Списать' : 'Ayirish'}
                  </button>
                </div>

                <div className="pt-2 border-t border-surface-100 dark:border-surface-700">
                  <button onClick={() => handleAdjust(true)}
                    className="w-full bg-surface-900 hover:bg-surface-800 text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-1 active:scale-[0.97]">
                    <Lock className="w-4 h-4" /> {language === 'ru' ? 'Заморозить кошелёк' : "Hamyonni muzlatish"}
                  </button>
                  {targetWallet?.wallet?.is_frozen && (
                    <button onClick={async () => { await freezeMutation.mutateAsync({ adminId, targetTelegramId: targetUser, freeze: false, reason: 'Admin unfreeze' }); toast.success('Разморожен'); }}
                      className="w-full mt-2 btn-brand py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-1 active:scale-[0.97]">
                      <Unlock className="w-4 h-4" /> {language === 'ru' ? 'Разморозить' : 'Eritish'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Config */}
        {activeSection === 'config' && (
          <div className="space-y-3">
            {/* Toggle switches */}
            <div className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm space-y-3">
              <h3 className="font-bold text-sm">{language === 'ru' ? 'Системные переключатели' : 'Tizim kalitlari'}</h3>
              {['earning_enabled', 'spending_enabled'].map(key => (
                <div key={key} className="flex items-center justify-between py-2">
                  <span className="text-sm">{key === 'earning_enabled' ? (language === 'ru' ? 'Начисления включены' : 'Berish yoqilgan') : (language === 'ru' ? 'Траты включены' : 'Sarflash yoqilgan')}</span>
                  <button onClick={() => handleToggleConfig(key)}
                    className={`w-12 h-6 rounded-full transition ${getConfig(key) ? 'bg-surface-900 dark:bg-white' : 'bg-surface-300 dark:bg-surface-600'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white dark:bg-surface-900 shadow transition-transform ${getConfig(key) ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>

            {/* Numeric configs */}
            <div className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm space-y-3">
              <h3 className="font-bold text-sm">{language === 'ru' ? 'Лимиты' : 'Limitlar'}</h3>
              {[
                { key: 'max_daily_earn_per_user', label: language === 'ru' ? 'Дневной лимит на пользователя' : 'Kunlik limit' },
                { key: 'max_monthly_earn_per_user', label: language === 'ru' ? 'Месячный лимит на пользователя' : 'Oylik limit' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-surface-500 flex-1">{label}</span>
                  <input type="number" defaultValue={Number(getConfig(key) ?? 0)}
                    onBlur={e => handleUpdateConfig(key, Number(e.target.value))}
                    className="w-20 border border-surface-200 rounded-lg px-2 py-1.5 text-sm text-center bg-white dark:bg-surface-700" />
                </div>
              ))}
            </div>

            {/* Treasury info */}
            <div className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm">
              <h3 className="font-bold text-sm mb-2">{language === 'ru' ? 'Treasury' : 'Xazina'}</h3>
              <p className="text-xs text-surface-500">
                {language === 'ru'
                  ? 'Treasury автоматически пополняется, когда пользователи тратят монеты. Монеты НЕ исчезают — они возвращаются в оборот.'
                  : 'Xazina avtomatik to\'ldiriladi, foydalanuvchilar tanga sarflaganda. Tangalar yo\'qolmaydi — ular aylanmaga qaytadi.'}
              </p>
            </div>
          </div>
        )}

        {/* Log */}
        {activeSection === 'log' && (
          <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-100">
              <p className="font-bold text-sm">{language === 'ru' ? 'Лог действий' : 'Amallar jurnali'}</p>
            </div>
            <div className="divide-y divide-surface-100">
              {adminLog.length === 0 ? (
                <p className="text-center py-8 text-surface-500 text-sm">{language === 'ru' ? 'Пока нет записей' : 'Hali yozuvlar yo\'q'}</p>
              ) : adminLog.map((entry) => (
                <div key={entry.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-surface-400" />
                      <span className="text-xs font-medium text-surface-900">{entry.action}</span>
                    </div>
                    <span className="text-xs text-surface-400">{new Date(entry.created_at).toLocaleString('ru-RU')}</span>
                  </div>
                  <div className="text-xs text-surface-500 mt-1">
                    {entry.target_user && <span>Пользователь: {entry.target_user}</span>}
                    {entry.amount != null && <span className="ml-2">Сумма: {entry.amount > 0 ? '+' : ''}{entry.amount}</span>}
                    {entry.old_balance != null && entry.new_balance != null && (
                      <span className="ml-2">({entry.old_balance} → {entry.new_balance})</span>
                    )}
                  </div>
                  {entry.reason && <p className="text-[10px] text-surface-400 mt-0.5">{entry.reason}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
