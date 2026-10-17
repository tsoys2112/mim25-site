// POST /api/order — сохраняет заявку клиента в базу Turso.
// Цены пересчитываются на сервере по прайсу, цифрам из браузера не доверяем.
import { query } from './_db.js';
import { PRICES } from './_products.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  if (body.website) return res.status(200).json({ ok: true }); // скрытое поле-ловушка для спам-ботов

  const name = String(body.name || '').trim().slice(0, 120);
  const phone = String(body.phone || '').trim().slice(0, 40);
  const note = String(body.note || '').trim().slice(0, 500);
  if (phone.replace(/\D/g, '').length < 7) {
    return res.status(400).json({ error: 'Укажите номер телефона' });
  }

  const items = [];
  for (const it of Array.isArray(body.items) ? body.items.slice(0, 300) : []) {
    const p = PRICES[it.id];
    const qty = Math.floor(Number(it.qty));
    if (!p || !(qty > 0) || qty > 100000) continue;
    items.push({ id: Number(it.id), name: p[0], price: p[1], qty, sum: p[1] * qty });
  }
  if (!items.length) return res.status(400).json({ error: 'В заявке нет товаров' });

  const total = items.reduce((a, i) => a + i.sum, 0);
  try {
    const [r] = await query([[
      'INSERT INTO orders (created_at, name, phone, note, items, total) VALUES (?, ?, ?, ?, ?, ?)',
      [new Date().toISOString(), name, phone, note, JSON.stringify(items), total],
    ]]);
    return res.status(200).json({ ok: true, id: r.lastId, total });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Не удалось сохранить заявку. Напишите нам в Telegram @MIM25TS' });
  }
}
