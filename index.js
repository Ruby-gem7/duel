const express = require('express');
const CyclicDb = require('@cyclic.sh/dynamodb');

const app = express();
const db = CyclicDb();
const duels = db.collection('duels');
const players = db.collection('players');

// ==========================
//  HELPERS
// ==========================

async function getOrCreatePlayer(username) {
    username = username.toLowerCase();
    let data = await players.get(username);

    if (!data?.props) {
        const newData = { wins: 0, loses: 0 };
        await players.set(username, newData);
        return newData;
    }

    return data.props;
}

async function addWin(username) {
    let p = await getOrCreatePlayer(username);
    p.wins += 1;
    await players.set(username, p);
}

async function addLose(username) {
    let p = await getOrCreatePlayer(username);
    p.loses += 1;
    await players.set(username, p);
}

// ==========================
//  ROUTES
// ==========================

// Вызов дуэли
app.get('/duel', async (req, res) => {
    const from = req.query.from?.toLowerCase();
    const to = req.query.to?.toLowerCase();

    if (!from || !to) return res.send("❌ Ошибка: укажи игрока.");
    if (from === to) return res.send("❌ Ты не можешь вызвать на дуэль самого себя.");

    await duels.set(from, {
        challenger: from,
        opponent: to,
        status: "pending",
        time: Date.now()
    });

    res.send(`🗡️ ${from} вызывает ${to} на дуэль! Напиши !accept, чтобы принять дуэль или !deny, чтобы отказаться.`);
});

// Принять дуэль
app.get('/accept', async (req, res) => {
    const from = req.query.from?.toLowerCase();

    if (!from) return res.send("❌ Ошибка: укажи игрока.");

    // находим активную дуэль где “from” — это тот, кого вызвали
    const all = await duels.list();

    let duel = null;
    for (const d of all.results) {
        const data = await duels.get(d.key);
        if (data?.props?.opponent === from && data.props.status === "pending") {
            duel = data.props;
            break;
        }
    }

    if (!duel) {
        return res.send(`❌ ${from}, у тебя нет активных вызовов на дуэль.`);
    }

    // Определяем победителя
    const challenger = duel.challenger;
    const opponent = duel.opponent;

    const winner = Math.random() < 0.5 ? challenger : opponent;
    const loser = winner === challenger ? opponent : challenger;

    await addWin(winner);
    await addLose(loser);

    await duels.delete(challenger);

    res.send(`⚔️ Дуэль: ${challenger} vs ${opponent}! Победитель — ${winner}! 🎉`);
});

// Отменить дуэль
app.get('/deny', async (req, res) => {
    const from = req.query.from?.toLowerCase();

    if (!from) return res.send("❌ Ошибка: укажи игрока.");

    const all = await duels.list();
    for (const d of all.results) {
        const data = await duels.get(d.key);
        if (data?.props?.opponent === from && data.props.status === "pending") {
            await duels.delete(d.key);
            return res.send(`🚫 ${from} отказался от дуэли.`);
        }
    }

    res.send(`❌ ${from}, тебе никто не бросал вызов.`);
});

// Статистика игрока
app.get('/stats', async (req, res) => {
    const user = req.query.user?.toLowerCase();
    if (!user) return res.send("❌ Укажи игрока");

    const data = await getOrCreatePlayer(user);

    const rating = data.wins - data.loses;

    res.send(`📊 Статистика ${user}: Побед: ${data.wins}, Поражений: ${data.loses}, Рейтинг: ${rating}`);
});

// Таблица рейтинга
app.get('/top', async (req, res) => {
    const list = await players.list();

    const stats = [];

    for (const p of list.results) {
        const data = await players.get(p.key);
        if (data?.props) {
            const u = p.key;
            const { wins, loses } = data.props;
            stats.push({
                user: u,
                wins,
                loses,
                rating: wins - loses
            });
        }
    }

    stats.sort((a, b) => b.rating - a.rating);

    const top5 = stats.slice(0, 5);

    let result = "🏆 ТОП рейтинга:\n";
    top5.forEach((p, i) => {
        result += `${i + 1}. ${p.user} — рейтинг: ${p.rating} (W:${p.wins}/L:${p.loses})\n`;
    });

    res.send(result.trim());
});

// ==========================
//  START SERVER
// ==========================
app.listen(3000, () => console.log("API is running"));
