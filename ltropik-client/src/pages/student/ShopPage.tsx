import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { getShopItems, getMyPurchases, buyItem, usePurchase, type ShopItem, type Purchase } from '../../api/shop';
import { getProgress, type StudentProgress } from '../../api/gamification';
import { Card, Badge, Modal, Loader, EmptyState, toast, cx } from '../../components/ui';

const TYPE_LABELS: Record<string, string> = {
  hint: 'Підказка',
  skip_absence: 'Пропуск',
  unlock_material: 'Матеріал',
  certificate: 'Сертифікат',
  custom: 'Інше',
};

const TYPE_TONE: Record<string, 'brand' | 'amber' | 'green' | 'rose' | 'blue'> = {
  hint: 'blue',
  skip_absence: 'rose',
  unlock_material: 'green',
  certificate: 'amber',
  custom: 'brand',
};

export function ShopPage() {
  const [items, setItems]       = useState<ShopItem[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [coins, setCoins]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [buying, setBuying]     = useState<string | null>(null);
  const [tab, setTab]           = useState<'shop' | 'inventory'>('shop');
  const [confirmItem, setConfirmItem] = useState<ShopItem | null>(null);

  const [loadError, setLoadError] = useState('');

  const load = async () => {
    setLoadError('');
    try {
      const [itemsRes, purchasesRes, progressRes] = await Promise.all([
        getShopItems(),
        getMyPurchases(),
        getProgress(),
      ]);
      setItems(itemsRes.data);
      setPurchases(purchasesRes.data);
      setCoins((progressRes.data as StudentProgress).totalCoins ?? 0);
    } catch {
      setLoadError('Не вдалося завантажити магазин. Спробуйте оновити сторінку.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  async function handleBuy(item: ShopItem) {
    setBuying(item.id);
    try {
      const r = await buyItem(item.id);
      toast('success', r.data.message);
      setConfirmItem(null);
      await load();
    } catch (err: any) {
      toast('error', err?.response?.data?.error ?? 'Помилка покупки');
    } finally {
      setBuying(null);
    }
  }

  async function handleUse(purchaseId: string) {
    try {
      await usePurchase(purchaseId);
      toast('success', 'Товар використано!');
      await load();
    } catch (err: any) {
      toast('error', err?.response?.data?.error ?? 'Помилка');
    }
  }

  if (loading) return <Layout title="Магазин"><Loader /></Layout>;

  return (
    <Layout title="Магазин монет" subtitle="Витрачай зароблені монети на корисні речі">
      {loadError && (
        <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-semibold flex items-center gap-2">
          ❌ {loadError}
          <button onClick={load} className="ml-auto btn btn-soft text-xs py-1 px-3">Повторити</button>
        </div>
      )}

      {/* Coins balance */}
      <div className="flex items-center gap-3 mb-6 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl">
        <span className="text-3xl">🪙</span>
        <div>
          <p className="text-2xl font-extrabold text-amber-800">{coins}</p>
          <p className="text-sm text-amber-600">монет доступно</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {(['shop', 'inventory'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cx('chip', tab === t ? 'bg-brand-600 text-white' : 'bg-white text-ink-500 ring-1 ring-ink-200')}>
            {{ shop: '🛍️ Магазин', inventory: '🎒 Мій інвентар' }[t]}
          </button>
        ))}
      </div>

      {tab === 'shop' && (
        items.length === 0
          ? <EmptyState icon="🛒" title="Магазин порожній" hint="Адмін ще не додав товари" />
          : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map(item => {
                const canAfford = coins >= item.coinsPrice;
                return (
                  <Card key={item.id} className="p-5 flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <span className="text-4xl">{item.icon}</span>
                      <Badge tone={TYPE_TONE[item.type] ?? 'brand'}>{TYPE_LABELS[item.type] ?? item.type}</Badge>
                    </div>
                    <div>
                      <p className="font-extrabold text-ink-900">{item.name}</p>
                      <p className="text-sm text-ink-500 mt-0.5">{item.description}</p>
                    </div>
                    {item.maxPerStudent && (
                      <p className="text-xs text-ink-400">Макс: {item.maxPerStudent}x на студента</p>
                    )}
                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-ink-100">
                      <span className="font-bold text-amber-600 text-lg">🪙 {item.coinsPrice}</span>
                      <button
                        onClick={() => setConfirmItem(item)}
                        disabled={!canAfford || buying === item.id}
                        className={cx(
                          'btn text-sm py-1.5 px-4 disabled:opacity-40',
                          canAfford ? 'btn-primary' : 'btn-soft'
                        )}>
                        {!canAfford ? 'Мало монет' : 'Купити'}
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )
      )}

      {tab === 'inventory' && (
        purchases.length === 0
          ? <EmptyState icon="🎒" title="Інвентар порожній" hint="Купуй товари в магазині" />
          : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {purchases.map(p => (
                <Card key={p.id} className={cx('p-5 flex items-center gap-4', p.usedAt && 'opacity-60')}>
                  <span className="text-3xl flex-shrink-0">{p.item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-ink-900">{p.item.name}</p>
                    <p className="text-xs text-ink-400">{new Date(p.purchasedAt).toLocaleDateString('uk-UA')}</p>
                    {p.usedAt && <p className="text-xs text-emerald-600 font-semibold">✓ Використано</p>}
                  </div>
                  {!p.usedAt && (
                    <button onClick={() => handleUse(p.id)} className="btn btn-soft text-sm py-1.5 px-3 flex-shrink-0">
                      Використати
                    </button>
                  )}
                </Card>
              ))}
            </div>
          )
      )}

      {/* Confirm purchase modal */}
      <Modal open={!!confirmItem} onClose={() => setConfirmItem(null)} className="max-w-sm">
        {confirmItem && (
          <div className="p-7 text-center">
            <span className="text-5xl">{confirmItem.icon}</span>
            <h3 className="font-extrabold text-xl text-ink-900 mt-3">{confirmItem.name}</h3>
            <p className="text-ink-500 text-sm mt-1">{confirmItem.description}</p>
            <p className="text-amber-600 font-bold text-2xl mt-4">🪙 {confirmItem.coinsPrice}</p>
            <p className="text-xs text-ink-400 mt-1">Залишиться: {coins - confirmItem.coinsPrice} монет</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setConfirmItem(null)} className="btn btn-soft flex-1">Скасувати</button>
              <button onClick={() => handleBuy(confirmItem)} disabled={buying === confirmItem.id}
                className="btn btn-primary flex-1">
                {buying === confirmItem.id ? '⏳…' : '✅ Купити'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
