const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Активные вызовы и дуэли
// duelRequests[from] = {
//   to: "targetUser",
//   timer: setTimeout(...)
// }

const duelRequests = {}; 
const activeDuels = {}; // activeDuels[user] = opponent

// Очищает вызов и отменяет таймер
function clearRequest(from) {
    if (duelRequests[from]) {
        clearTimeout(duelRequests[from].timer);
        delete duelRequests[from];
    }
}

// Проверка: кто-то в дуэли?
function isInDuel(user) {
    return activeDuels[user] !== undefined;
}

// ---------- Вызов дуэли ----------
app.get("/duel", (req, res) => {
    const from = req.query.from?.toLowerCase();
    const to = req.query.to?.toLowerCase();

    if (!from || !to) return res.send("Ошибка: нет пользователя.");
    if (from === to) return res.send("Ты не можешь вызвать сам себя.");

    // уже в дуэли
    if (isInDuel(from)) return res.send(`Ты уже находишься в дуэли.`);
    if (isInDuel(to)) return res.send(`${to} уже в дуэли.`);

    // у тебя уже есть активный вызов
    if (duelRequests[from]) {
        return res.send(`Ты уже вызвал ${duelRequests[from].to}.`);
    }

    // на игрока уже есть вызов
    const incoming = Object.values(duelRequests).find(r => r.to === to);
    if (incoming) return res.send(`${to} уже получили вызов и ждут ответа.`);

    // создаем вызов + таймер 2 минуты
    const timer = setTimeout(() => {
        clearRequest(from);
        console.log(`Вызов ${from} → ${to} автоматически отменён.`);
    }, 2 * 60 * 1000);

    duelRequests[from] = { to, timer };

    res.send(`${from} вызывает ${to} на дуэль! Напишите !accept или !deny.`);
});


// ---------- Принятие дуэли ----------
app.get("/accept", (req, res) => {
    const user = req.query.from?.toLowerCase();
    if (!user) return res.send("Ошибка.");

    // ищем, кто вызвал user
    const caller = Object.keys(duelRequests).find(from => duelRequests[from].to === user);

    if (!caller) return res.send("У вас нет входящих вызовов.");

    // проверяем, не в дуэли ли они
    if (isInDuel(user) || isInDuel(caller)) {
        clearRequest(caller);
        return res.send("Кто-то уже в дуэли.");
    }

    // создаем дуэль
    activeDuels[user] = caller;
    activeDuels[caller] = user;

    // убираем запрос
    clearRequest(caller);

    res.send(`${user} принял дуэль от ${caller}! Битва началась!`);
});


// ---------- Отказ от дуэли ----------
app.get("/deny", (req, res) => {
    const user = req.query.from?.toLowerCase();
    if (!user) return res.send("Ошибка.");

    // ищем входящий вызов
    const caller = Object.keys(duelRequests).find(from => duelRequests[from].to === user);

    if (!caller) return res.send("У вас нет вызовов для отказа.");

    clearRequest(caller);

    res.send(`${user} отказался от дуэли с ${caller}.`);
});


// ---------- Сервер ----------
app.get("/", (req, res) => {
    res.send("Duel system working.");
});

app.listen(port, () => console.log(`Server running on port ${port}`));
