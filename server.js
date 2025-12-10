const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== helpers ==========
async function ensureUser(nick) {
  await db.query(
    `INSERT INTO users (nick)
     VALUES ($1)
     ON CONFLICT (nick) DO NOTHING`,
    [nick]
  );
}

// ========== routes ==========
app.get('/', (req, res) => {
  res.send('Duel API is running');
});

// create duel
app.get('/duel', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.send('Invalid params');

  await ensureUser(from);
  await ensureUser(to);

  await db.query(`
    INSERT INTO duels (challenger_id, challenged_id, status)
    VALUES (
      (SELECT id FROM users WHERE nick=$1),
      (SELECT id FROM users WHERE nick=$2),
      'pending'
    )
  `, [from, to]);

  res.send(`⚔️ ${from} вызвал ${to} на дуэль`);
});

// accept duel + random result
app.get('/accept', async (req, res) => {
  const { user } = req.query;

  const duelQ = await db.query(`
    SELECT d.id, u1.nick AS a, u2.nick AS b
    FROM duels d
    JOIN users u1 ON d.challenger_id=u1.id
    JOIN users u2 ON d.challenged_id=u2.id
    WHERE u2.nick=$1 AND d.status='pending'
    ORDER BY d.created_at DESC
    LIMIT 1
  `, [user]);

  if (!duelQ.rows.length) return res.send('Нет дуэлей');

  const duel = duelQ.rows[0];
  const winner = Math.random() < 0.5 ? duel.a : duel.b;
  const loser = winner === duel.a ? duel.b : duel.a;

  await db.query(`
    UPDATE duels SET
      status='finished',
      winner_id=(SELECT id FROM users WHERE nick=$1),
      loser_id=(SELECT id FROM users WHERE nick=$2),
      finished_at=NOW()
    WHERE id=$3
  `, [winner, loser, duel.id]);

  await db.query(`UPDATE users SET wins=wins+1, duels=duels+1 WHERE nick=$1`, [winner]);
  await db.query(`UPDATE users SET losses=losses+1, duels=duels+1 WHERE nick=$1`, [loser]);

  res.send(`🏆 Победитель: ${winner}`);
});

// stats
app.get('/stats', async (req, res) => {
  const { user } = req.query;

  const q = await db.query(`
    SELECT wins, losses, duels
    FROM users WHERE nick=$1
  `, [user]);

  if (!q.rows.length) return res.send('Игрок не найден');

  const s = q.rows[0];
  res.send(`📊 ${user}: ${s.wins}W / ${s.losses}L (${s.duels})`);
});

// top
app.get('/top', async (req, res) => {
  const q = await db.query(`
    SELECT nick, wins
    FROM users
    ORDER BY wins DESC
    LIMIT 5
  `);

  res.send(
    q.rows.map((u, i) =>
      `${i+1}. ${u.nick} — ${u.wins}`
    ).join(' | ')
  );
});

app.listen(PORT, () => {
  console.log('Server started on port', PORT);
});
