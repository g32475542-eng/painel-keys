const express = require('express');
const cors = require('cors');
const basicAuth = require('express-basic-auth');
const app = express();

app.use(cors());
app.use(express.json());

// Autenticação
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const SOCIO_USER = process.env.SOCIO_USER || 'socio';
const SOCIO_PASS = process.env.SOCIO_PASS || 'socio123';

const users = {};
users[ADMIN_USER] = ADMIN_PASS;
users[SOCIO_USER] = SOCIO_PASS;

const authMiddleware = basicAuth({ users, challenge: true, realm: 'Painel de Keys' });

// Protege todas as rotas exceto /api/validate
app.use((req, res, next) => {
    if (req.path === '/api/validate') next();
    else authMiddleware(req, res, next);
});

let keys = {};

// Remove keys expiradas a cada minuto
setInterval(() => {
    const agora = Math.floor(Date.now() / 1000);
    for (let [key, data] of Object.entries(keys)) {
        if (agora > data.expira) delete keys[key];
    }
}, 60000);

// Rota pública POST para validação
app.post('/api/validate', (req, res) => {
    const { key } = req.body;
    if (!key) return res.json({ valid: false, message: 'Key não fornecida' });
    const data = keys[key];
    if (!data) return res.json({ valid: false, message: 'Key inválida' });
    if (Math.floor(Date.now() / 1000) > data.expira) {
        delete keys[key];
        return res.json({ valid: false, message: 'Key expirada' });
    }
    res.json({ valid: true, message: 'Key válida', expiration: data.expira });
});

// Rotas administrativas
app.get('/api/keys', (req, res) => {
    const lista = Object.entries(keys).map(([k, v]) => ({ key: k, expira: v.expira, criada: v.criada }));
    res.json(lista);
});

app.post('/api/keys', (req, res) => {
    const { key, duracaoSegundos } = req.body;
    if (!key || !duracaoSegundos) return res.status(400).json({ error: 'Faltam dados' });
    keys[key] = {
        expira: Math.floor(Date.now() / 1000) + duracaoSegundos,
        criada: Math.floor(Date.now() / 1000)
    };
    res.json({ success: true });
});

app.delete('/api/keys/:key', (req, res) => {
    if (keys[req.params.key]) delete keys[req.params.key];
    res.json({ success: true });
});

// Arquivos estáticos (painel HTML)
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Painel rodando na porta ${PORT}`));
