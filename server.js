const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. Подключение к MongoDB ---
mongoose.connect('mongodb://127.0.0.1:27017/studsovet_voting')
    .then(() => console.log('Успешное подключение к MongoDB'))
    .catch(err => console.error('Ошибка подключения к БД:', err));

// --- 2. Схемы данных ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }, 
    role: { type: String, default: 'student' } // 'student' или 'admin'
});
const User = mongoose.model('User', UserSchema);

const CandidateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    manifesto: { type: String, required: true },
    icon: { type: String, default: '🎓' }
});
const Candidate = mongoose.model('Candidate', CandidateSchema);

const VoteSchema = new mongoose.Schema({
    hash: { type: String, required: true, unique: true },
    timestamp: { type: String, required: true },
    candidateId: { type: String, required: true }
});
const Vote = mongoose.model('Vote', VoteSchema);

// --- 3. API Маршруты ---

// Регистрация пользователей
app.post('/api/auth/register', async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const user = new User({ username, password, role: role || 'student' });
        await user.save();
        res.status(201).json({ success: true, message: 'Пользователь зарегистрирован' });
    } catch (e) {
        res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
    }
});

// Вход в систему
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (user) {
        res.json({ success: true, username: user.username, role: user.role });
    } else {
        res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }
});

// Получить список всех кандидатов
app.get('/api/candidates', async (req, res) => {
    const list = await Candidate.find();
    res.json(list);
});

// Добавить нового кандидата (Админ)
app.post('/api/candidates', async (req, res) => {
    const { name, manifesto, icon } = req.body;
    const newCandidate = new Candidate({ name, manifesto, icon });
    await newCandidate.save();
    res.status(201).json({ success: true });
});

// Удалить кандидата (Админ)
app.delete('/api/candidates/:id', async (req, res) => {
    await Candidate.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// Получить журнал криптографического аудита
app.get('/api/audit', async (req, res) => {
    const votes = await Vote.find().sort({ _id: -1 });
    res.json(votes);
});

// Получить распределение голосов и результаты
app.get('/api/results', async (req, res) => {
    try {
        const totalVotes = await Vote.countDocuments();
        const candidatesList = await Candidate.find();
        
        const results = await Promise.all(candidatesList.map(async (c) => {
            const count = await Vote.countDocuments({ candidateId: c._id.toString() });
            const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            return { id: c._id, name: c.name, icon: c.icon, votes: count, percentage };
        }));
        res.json({ totalVotes, results });
    } catch (e) {
        res.status(500).json({ error: 'Ошибка сервера при подсчете результатов' });
    }
});

// Зафиксировать зашифрованный голос
app.post('/api/vote', async (req, res) => {
    const { hash, timestamp, candidateId } = req.body;
    try {
        const newVote = new Vote({ hash, timestamp, candidateId });
        await newVote.save();
        res.status(201).json({ success: true });
    } catch (e) {
        res.status(400).json({ error: 'Ошибка записи или дубликат хэша голоса' });
    }
});

// Очистить базу голосов (Админ)
app.delete('/api/reset', async (req, res) => {
    await Vote.deleteMany({});
    res.json({ message: 'БД очищена' });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Сервер запущен на http://localhost:${PORT}`));