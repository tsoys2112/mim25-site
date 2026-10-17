// Подключение к базе Turso через её HTTP API (без дополнительных библиотек).
// Адрес и токен берутся из переменных окружения Vercel:
//   TURSO_DATABASE_URL  — например libsql://mim25-имя.turso.io
//   TURSO_AUTH_TOKEN    — токен доступа к базе

const SCHEMA = `CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  name TEXT,
  phone TEXT NOT NULL,
  note TEXT,
  items TEXT NOT NULL,
  total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
)`;

function dbUrl() {
  const raw = process.env.TURSO_DATABASE_URL || process.env.TURSO_URL;
  if (!raw || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error('Не заданы TURSO_DATABASE_URL и TURSO_AUTH_TOKEN в настройках Vercel');
  }
  return raw.replace(/^libsql:\/\//, 'https://').replace(/\/$/, '') + '/v2/pipeline';
}

function toArg(v) {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'number' && Number.isInteger(v)) return { type: 'integer', value: String(v) };
  if (typeof v === 'number') return { type: 'float', value: v };
  return { type: 'text', value: String(v) };
}

function fromCell(c) {
  if (!c || c.type === 'null') return null;
  if (c.type === 'integer') return Number(c.value);
  return c.value;
}

// Выполняет SQL-запросы по очереди. Таблица создаётся автоматически при первом запросе.
export async function query(statements) {
  const requests = [{ type: 'execute', stmt: { sql: SCHEMA } }];
  for (const [sql, args = []] of statements) {
    requests.push({ type: 'execute', stmt: { sql, args: args.map(toArg) } });
  }
  requests.push({ type: 'close' });

  const r = await fetch(dbUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.TURSO_AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });
  if (!r.ok) throw new Error(`Turso ответила ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();

  return data.results.slice(1, -1).map((res) => {
    if (res.type !== 'ok') throw new Error('Ошибка базы: ' + (res.error?.message || 'неизвестно'));
    const result = res.response.result;
    const cols = result.cols.map((c) => c.name);
    return {
      rows: result.rows.map((row) => Object.fromEntries(row.map((cell, i) => [cols[i], fromCell(cell)]))),
      lastId: result.last_insert_rowid ? Number(result.last_insert_rowid) : null,
    };
  });
}
