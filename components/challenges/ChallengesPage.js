'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import { Button, EmptyState, LoadingState } from '@/components/ui';
import { api } from '@/lib/client';
import { displayDate } from '@/lib/dates';
import { trackingErrorMessage } from '@/lib/tracking-client';
import ChallengeForm from './ChallengeForm';

export default function ChallengesPage() {
  const { t, language, notify, refreshProfile } = useApp();
  const router = useRouter();
  const [items, setItems] = useState(null), [error, setError] = useState(''), [filter, setFilter] = useState('active');
  const [form, setForm] = useState(null), [busy, setBusy] = useState(false);
  const request = useRef(0), mutation = useRef(false);
  const load = useCallback(async () => { const version = ++request.current; try { const result = await api('/api/challenges'); if (version === request.current) { setItems(result); setError(''); } } catch (err) { if (version === request.current) setError(trackingErrorMessage(err, t)); } }, [t]);
  useEffect(() => { load(); const timer = setInterval(load, 60000); window.addEventListener('focus', load); return () => { clearInterval(timer); window.removeEventListener('focus', load); }; }, [load]);
  const templates = [
    { icon: '🍎', color: '#e34d59', duration: 30, title: t('30 дней без сладкого', '30 days without sugar'), description: t('Сегодня я обхожусь без добавленного сахара и сладостей.', 'Today I skip added sugar and sweets.') },
    { icon: '📚', color: '#af52de', duration: 14, title: t('14 дней чтения', '14 days of reading'), description: t('Читать книгу хотя бы 20 минут каждый день.', 'Read a book for at least 20 minutes every day.') },
    { icon: '🚶', color: '#34a853', duration: 30, title: t('30 дней прогулок', '30 days of daily walks'), description: t('Каждый день гулять на свежем воздухе не менее 30 минут.', 'Take an outdoor walk for at least 30 minutes every day.') },
  ];
  async function create(value) { if (mutation.current) return; mutation.current = true; setBusy(true); try { const created = await api('/api/challenges', { method: 'POST', body: value }); setForm(null); refreshProfile?.(); router.push(`/app/challenges/${created.id}`); } catch (err) { notify(trackingErrorMessage(err, t), 'error'); } finally { mutation.current = false; setBusy(false); } }
  const visible = (items || []).filter(item => filter === 'archived' ? item.archived_at : !item.archived_at && (filter === 'completed' ? item.stats.period_ended || item.stats.goal_completed : !item.stats.period_ended && !item.stats.goal_completed));
  return <div className="tracking-page">
    <header className="page-header"><div><div className="tracking-eyebrow">{t('Маленькие шаги. Большие перемены.', 'Small steps. Meaningful change.')}</div><h1>{t('Челленджи', 'Challenges')}</h1><p className="muted">{t('Одна цель, один день за раз.', 'One goal, one day at a time.')}</p></div><Button variant="primary" onClick={() => setForm({})}>+ {t('Новый челлендж', 'New challenge')}</Button></header>
    <div className="tracking-tabs" role="group" aria-label={t('Фильтр челленджей', 'Filter challenges')}>{[['active', t('Активные', 'Active')], ['completed', t('Завершённые', 'Completed')], ['archived', t('Архив', 'Archived')]].map(([key, label]) => <button key={key} className={filter === key ? 'selected' : ''} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>
    {error ? <div className="panel tracking-error" role="alert"><p>{error}</p><Button variant="secondary" onClick={load}>{t('Повторить', 'Retry')}</Button></div> : items === null ? <LoadingState /> : visible.length ? <div className="challenge-grid">{visible.map(item => <Link href={`/app/challenges/${item.id}`} className="challenge-card panel" key={item.id} style={{ '--item-color': item.color }}>
      <div className="challenge-card-top"><span className="challenge-icon">{item.icon}</span><span className="tracking-badge">{item.stats.goal_completed ? t('Цель выполнена', 'Goal achieved') : item.stats.period_ended ? t('Период завершён', 'Period ended') : item.stats.upcoming ? t('Скоро начнётся', 'Starts soon') : `${t('День', 'Day')} ${item.stats.current_day} / ${item.attempt.duration}`}</span></div>
      <h2>{item.title}</h2><p className="challenge-rule muted">{item.description || t('Каждый день приближает к цели.', 'Make room for a little progress every day.')}</p>
      <div className="challenge-card-progress"><strong>{item.stats.successful_days}<span> / {item.attempt.duration}</span></strong><span>{item.stats.percentage}%</span></div><div className="tracking-progress" role="progressbar" aria-label={t('Успешные дни', 'Successful days')} aria-valuenow={item.stats.percentage} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${item.stats.percentage}%` }} /></div>
      <div className="challenge-card-footer"><span>{displayDate(item.attempt.start_date, language)} – {displayDate(item.stats.end_date, language)}</span><span>{item.stats.current_streak} {t('в серии', 'in a row')}</span></div>
    </Link>)}</div> : <EmptyState icon="challenges" title={filter === 'active' ? t('Начните с одной цели', 'Start with one goal') : t('Здесь пока пусто', 'Nothing here yet')} description={filter === 'active' ? t('Создайте свой челлендж или выберите идею ниже.', 'Create your own challenge or choose an idea below.') : t('Здесь появятся ваши челленджи из этой категории.', 'Your challenges in this category will appear here.')}><Button variant="secondary" onClick={() => setForm({})}>{t('Создать челлендж', 'Create challenge')}</Button></EmptyState>}
    <section className="challenge-templates"><div><h2>{t('С чего начнём?', 'What will you start?')}</h2><p className="muted">{t('Несколько идей. Правила можно изменить под себя.', 'A few ideas. Make the rules your own.')}</p></div><div className="challenge-template-grid">{templates.map(template => <button key={template.title} className="challenge-template panel" onClick={() => setForm(template)}><span className="challenge-template-icon">{template.icon}</span><span><strong>{template.title}</strong><small>{t('Настроить челлендж', 'Customize challenge')} →</small></span></button>)}</div></section>
    {form && <ChallengeForm initial={form} onClose={() => setForm(null)} onSave={create} busy={busy} />}
  </div>;
}
