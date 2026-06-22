import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Copy, Check, Share2, Gift, Coins, UserPlus, ExternalLink, MessageCircle, ChevronLeft } from 'lucide-react';
import { Layout } from '../components/Layout';
import { useTranslation } from '../hooks/useTranslation';
import { useAppStore, selectUserId } from '../store/useAppStore';
import { useInvites, useCreateInvite } from '../lib/supabase/hooks';
import { toast } from '../lib/toastStore';

export const InviteFriends = () => {
  const { language } = useTranslation();
  const navigate = useNavigate();
  const userId = useAppStore(selectUserId);

  const { data: invites = [], isLoading } = useInvites(userId);
  const createInviteMutation = useCreateInvite();

  const [copied, setCopied] = useState(false);

  const invite = invites[0];
  const inviteCode = invite?.invite_code || '';
  const totalInvited = invites.length;
  const registeredCount = invites.filter(r => r.status !== 'pending').length;

  const getInviteLink = () => {
    const bot = import.meta.env.VITE_BOT_USERNAME || 'StyleTechShopBot';
    return `https://t.me/${bot}?start=${inviteCode}`;
  };

  const handleCopyCode = async () => {
    if (!inviteCode) return;
    const text = `${language === 'ru' ? 'Присоединяйся к StyleTech Shop!' : 'StyleTech Shop ga qo\'shiling!'}\n${language === 'ru' ? 'Используй мой код:' : 'Kodimni ishlating:'} ${inviteCode}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(language === 'ru' ? 'Скопировано!' : 'Nusxalandi!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async () => {
    const link = getInviteLink();
    const text = `${language === 'ru' ? 'Присоединяйся к StyleTech Shop!' : 'StyleTech Shop ga qo\'shiling!'}\n${language === 'ru' ? 'Получим монеты вместе!' : 'Birgalikda tanga olamiz!'}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'StyleTech Shop', text, url: link }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${text}\n${link}`);
      toast.success(language === 'ru' ? 'Ссылка скопирована!' : 'Havola nusxalandi!');
    }
  };

  const handleCreateInvite = async () => {
    try { await createInviteMutation.mutateAsync(userId); toast.success(language === 'ru' ? 'Код создан!' : 'Yaratildi!'); }
    catch { toast.error(language === 'ru' ? 'Ошибка' : 'Xatolik'); }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-4 space-y-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/wallet')}
            className="w-10 h-10 rounded-xl bg-surface-100 dark:bg-surface-700 flex items-center justify-center active:scale-95 transition">
            <ChevronLeft className="w-5 h-5 text-surface-900 dark:text-white" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-surface-900 dark:text-white">
              {language === 'ru' ? 'Пригласить друга' : "Do'st taklif qilish"}
            </h1>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              {language === 'ru' ? 'Зарабатывайте монеты вместе' : 'Birgalikda tanga toping'}
            </p>
          </div>
        </div>

        {/* Reward Card — dark brand style, not emerald */}
        <div className="bg-surface-900 rounded-2xl p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-28 h-28 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                <Gift className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-white/60 text-sm">{language === 'ru' ? 'Награда за приглашение' : 'Taklif mukofoti'}</p>
                <p className="text-3xl font-extrabold">+1 <Coins className="w-5 h-5 inline text-accent" /> × 2</p>
              </div>
            </div>
            <p className="text-white/70 text-sm">{language === 'ru' ? 'Вы и друг получаете по 1 монете после регистрации' : 'Siz va do\'stingiz 1 tanga olasiz'}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-surface-900 dark:text-white">{totalInvited}</p>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              {language === 'ru' ? 'Приглашено' : 'Taklif qilingan'}
            </p>
          </div>
          <div className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-accent">{registeredCount}</p>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              {language === 'ru' ? 'Зарегистрировалось' : "Ro'yxatdan o'tdi"}
            </p>
          </div>
        </div>

        {/* Referral Code */}
        {isLoading ? <div className="h-24 skeleton rounded-2xl" /> : !inviteCode ? (
          <button onClick={handleCreateInvite} disabled={createInviteMutation.isPending}
            className="w-full btn-brand py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition">
            <UserPlus className="w-5 h-5" />
            {createInviteMutation.isPending ? '...' : (language === 'ru' ? 'Создать код' : 'Kod yaratish')}
          </button>
        ) : (
          <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700">
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
                {language === 'ru' ? 'Ваш код' : 'Sizning kodingiz'}
              </p>
            </div>
            <div className="p-4">
              <div className="bg-surface-50 dark:bg-surface-700 rounded-xl px-4 py-3 flex items-center gap-2">
                <code className="flex-1 text-lg font-mono font-bold break-all text-surface-900 dark:text-white">{inviteCode}</code>
                <button onClick={handleCopyCode}
                  className="flex-shrink-0 p-2 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-600 transition">
                  {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5 text-surface-600 dark:text-surface-400" />}
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={handleShare}
                  className="btn-brand py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.97]">
                  <Share2 className="w-4 h-4" /> {language === 'ru' ? 'Поделиться' : 'Ulashish'}
                </button>
                <a href={getInviteLink()} target="_blank" rel="noopener noreferrer"
                  className="bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-900 dark:text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition active:scale-[0.97]">
                  <ExternalLink className="w-4 h-4" /> {language === 'ru' ? 'Отправить' : 'Yuborish'}
                </a>
              </div>
            </div>
          </div>
        )}

        {/* How it works */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-sm p-4">
          <h3 className="font-bold text-surface-900 dark:text-white mb-3">
            {language === 'ru' ? 'Как это работает?' : 'Qanday ishlaydi?'}
          </h3>
          <div className="space-y-4">
            {[
              { step: 1, icon: Copy, title: language === 'ru' ? 'Скопируйте код' : 'Kodni nusxalang', desc: language === 'ru' ? 'Нажмите кнопку копирования' : 'Nusxalash tugmasini bosing' },
              { step: 2, icon: MessageCircle, title: language === 'ru' ? 'Отправьте другу' : "Do'stga yuboring", desc: language === 'ru' ? 'Поделитесь в Telegram' : 'Telegramda ulashing' },
              { step: 3, icon: UserPlus, title: language === 'ru' ? 'Друг регистрируется' : "Do'st ro'yxatdan o'tadi", desc: language === 'ru' ? 'Использует код при входе' : 'Kirishda kodni ishlatadi' },
              { step: 4, icon: Coins, title: language === 'ru' ? 'Получите монеты' : 'Tangalarni oling', desc: language === 'ru' ? 'По 1 монете каждому' : 'Har biriga 1 tanga' },
            ].map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-surface-900 dark:bg-white text-white dark:text-surface-900 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold">{step}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-surface-400 dark:text-surface-500" />
                    <p className="text-sm font-medium text-surface-900 dark:text-white">{title}</p>
                  </div>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invited list */}
        {invites.length > 0 && (
          <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700">
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
                {language === 'ru' ? 'Приглашённые' : 'Taklif qilinganlar'}
              </p>
            </div>
            <div className="divide-y divide-surface-100 dark:divide-surface-700">
              {invites.map((inv) => (
                <div key={inv.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 bg-surface-100 dark:bg-surface-700 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-surface-500 dark:text-surface-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-surface-900 dark:text-white">
                      {inv.invited_telegram_id ? `#${inv.invited_telegram_id}` : (language === 'ru' ? 'Ожидает...' : 'Kutilmoqda...')}
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      {inv.status === 'pending' ? (language === 'ru' ? 'Ожидает регистрации' : "Kutilmoqda")
                        : inv.status === 'registered' ? (language === 'ru' ? 'Зарегистрировался' : "Ro'yxatdan o'tdi")
                        : (language === 'ru' ? 'Сделал покупку' : 'Xarid qildi')}
                    </p>
                  </div>
                  {inv.status !== 'pending' && (
                    <span className="bg-surface-900 dark:bg-white text-white dark:text-surface-900 text-[10px] font-bold px-2 py-0.5 rounded-full">+1</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
