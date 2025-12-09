import express from "express";
const app = express();
app.use(express.json());

let duels = {};      
let rating = {};     
let cooldown = {};   

const CD = 20;

function now() {
    return Math.floor(Date.now() / 1000);
}

app.get("/duel", (req, res) => {
    let from = (req.query.from || "").toLowerCase();
    let to = (req.query.to || "").toLowerCase();

    if (!from || !to) return res.send("Используй: !duel @имя");
    if (from === to) return res.send(`@${from}, нельзя вызвать самого себя!`);

    if (cooldown[from] && now() - cooldown[from] < CD) {
        let left = CD - (now() - cooldown[from]);
        return res.send(`@${from}, подожди ${left} сек перед новой дуэлью!`);
    }

    if (duels[to]) {
        return res.send(`@${to} уже участвует в дуэли!`);
    }

    duels[to] = from;
    cooldown[from] = now();

    res.send(`@${to}, тебя вызвал на дуэль @${from}! Напиши !accept`);
});

app.get("/accept", (req, res) => {
    let target = (req.query.from || "").toLowerCase();

    if (!duels[target]) {
        return res.send(`@${target}, тебя никто не вызывал на дуэль.`);
    }

    let challenger = duels[target];
    delete duels[target];

    let winner = Math.random() < 0.5 ? challenger : target;
    let loser = winner === challenger ? target : challenger;

    rating[winner] = rating[winner] || { wins: 0, losses: 0 };
    rating[loser]  = rating[loser]  || { wins: 0, losses: 0 };

    rating[winner].wins++;
    rating[loser].losses++;

    res.send(`⚔️ Дуэль между @${challenger} и @${target}! 🏆 Победитель: @${winner}!`);
});

app.get("/rating", (req, res) => {
    let list = Object.entries(rating)
        .sort((a, b) => b[1].wins - a[1].wins)
        .slice(0, 5);

    if (list.length === 0) return res.send("Рейтинг пока пуст 😢");

    let text = "🏆 Топ дуэлянтов: ";
    list.forEach(([user, stats], i) => {
        text += `${i+1}. ${user} (${stats.wins} побед)  `;
    });

    res.send(text);
});

app.listen(3000, () => console.log("API started"));
