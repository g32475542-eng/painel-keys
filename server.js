const express = require('express');
const cors = require('cors');
const basicAuth = require('express-basic-auth');
const app = express();

app.use(cors());
app.use(express.json());

// ========== AUTENTICAÇÃO ==========
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const SOCIO_USER = process.env.SOCIO_USER || 'socio';
const SOCIO_PASS = process.env.SOCIO_PASS || 'socio123';

const users = {};
users[ADMIN_USER] = ADMIN_PASS;
users[SOCIO_USER] = SOCIO_PASS;

const authMiddleware = basicAuth({
    users: users,
    challenge: true,
    realm: 'Painel de Keys'
});

// Protege todas as rotas exceto /api/validate
app.use((req, res, next) => {
    if (req.path === '/api/validate') {
        next();
    } else {
        authMiddleware(req, res, next);
    }
});

// ========== BANCO EM MEMÓRIA ==========
let keys = {};

// Remove keys expiradas a cada minuto
setInterval(() => {
    const agora = Math.floor(Date.now() / 1000);
    let removidas = 0;
    for (let [key, data] of Object.entries(keys)) {
        if (agora > data.expira) {
            delete keys[key];
            removidas++;
        }
    }
    if (removidas > 0) console.log(`🗑️ ${removidas} keys expiradas removidas.`);
}, 60000);

// ========== ROTA PÚBLICA (VALIDAÇÃO PARA O ROBLOX) ==========
app.post('/api/validate', (req, res) => {
    const { key } = req.body;
    if (!key) return res.json({ valid: false, message: 'Key não fornecida' });

    const data = keys[key];
    if (!data) return res.json({ valid: false, message: 'Key inválida' });

    const agora = Math.floor(Date.now() / 1000);
    if (agora > data.expira) {
        delete keys[key];
        return res.json({ valid: false, message: 'Key expirada' });
    }

    res.json({ valid: true, message: 'Key válida', expiration: data.expira });
});

// ========== ROTAS ADMINISTRATIVAS (PROTEGIDAS) ==========
app.get('/api/keys', (req, res) => {
    const lista = Object.entries(keys).map(([k, v]) => ({
        key: k,
        expira: v.expira,
        criada: v.criada
    }));
    res.json(lista);
});

app.post('/api/keys', (req, res) => {
    const { key, duracaoSegundos } = req.body;
    if (!key || !duracaoSegundos) {
        return res.status(400).json({ error: 'Faltam dados: key e duracaoSegundos são obrigatórios' });
    }
    const expira = Math.floor(Date.now() / 1000) + duracaoSegundos;
    keys[key] = { expira, criada: Math.floor(Date.now() / 1000) };
    console.log(`✅ Key adicionada: ${key} (expira em ${duracaoSegundos}s)`);
    res.json({ success: true });
});

app.delete('/api/keys/:key', (req, res) => {
    const { key } = req.params;
    if (keys[key]) {
        delete keys[key];
        console.log(`❌ Key removida: ${key}`);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Key não encontrada' });
    }
});

// ========== SERVE O PAINEL HTML (PROTEGIDO) ==========
app.use(express.static('public'));

// ========== INICIA O SERVIDOR ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🔐 Painel de Keys rodando na porta ${PORT}`);
    console.log(`📌 Rota pública: /api/validate`);
    console.log(`🔒 Painel administrativo protegido por usuário/senha`);
});
