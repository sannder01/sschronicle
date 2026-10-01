import { json, readJson } from '@/lib/api';
import { transaction } from '@/lib/db';
import { trackingRoute } from '@/lib/tracking-server';
import { trackingId, TrackingError } from '@/lib/tracking-validation';

export const PATCH = trackingRoute(async (req, _context, { user }) => {
  const { ids } = await readJson(req);
  if (!Array.isArray(ids) || !ids.length || ids.length > 5000) throw new TrackingError('Invalid order');
  ids.forEach(trackingId);
  if (new Set(ids).size !== ids.length) throw new TrackingError('Duplicate identifiers');
  await transaction(async client => {
    const own = (await client.query('SELECT id FROM habits WHERE user_id=$1 ORDER BY id FOR UPDATE', [user.id])).rows.map(row => row.id);
    if (ids.length !== own.length || ids.some(id => !own.includes(id))) throw new TrackingError('The list changed. Refresh before reordering.', 409);
    await client.query('UPDATE habits h SET sort_order=s.position-1,updated_at=now() FROM unnest($2::int[]) WITH ORDINALITY AS s(id,position) WHERE h.id=s.id AND h.user_id=$1', [user.id, ids]);
  });
  return json({ ok: true });
});
