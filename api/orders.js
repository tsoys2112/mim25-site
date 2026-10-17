// /api/orders — список заявок для менеджера (страница /admin.html).
// Доступ только с паролем из переменной окружения ADMIN_PASSWORD.
//   GET  — последние 200 заявок
//   POST { id, status } — сменить статус: new | done
import { query } from './_db.js';

export default async function handler(req, res) {
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return res.status(500).json({ error: 'Не задан ADMIN_PASSWORD в настройках Vercel' });
  if (req.headers['x-admin-password'] !== pass) return res.status(401).json({ error: 'Неверный пароль' });

  try {
    if (req.method === 'GET') {
      const [r] = await query([['SELECT * FROM orders ORDER BY id DESC LIMIT 200']]);
      return res.status(200).json({
        orders: r.rows.map((o) => ({ ...o, items: JSON.parse(o.items || '[]') })),
      });
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const status = body.status === 'done' ? 'done' : 'new';
      await query([['UPDATE orders SET status = ? WHERE id = ?', [status, Math.floor(Number(body.id))]]]);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Метод не поддерживается' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e.message || e) });
  }
}
