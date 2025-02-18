import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import db from '../database/index.js';
import authMiddleware from '../middlewares/auth.js';

const router = express.Router();
const SECRET_KEY = process.env.JWT_SECRET;

router.post('/login', 
    body('email').notEmpty().withMessage('Email é obrigatório'),
    body('password').notEmpty().withMessage('Senha é obrigatória'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;
        try {
            const query = 'SELECT * FROM users WHERE email = ?';
            db.query(query, [email], async (err, results) => {
                if (err) {
                    console.error('Erro ao consultar o banco de dados:', err);
                    return res.status(500).json({ error: 'Erro ao consultar o banco de dados' });
                }
                if (results.length === 0) {
                    return res.status(401).json({ message: 'Credenciais inválidas' });
                }

                const user = results[0];
                const isMatch = await bcrypt.compare(password, user.password);
                if (!isMatch) {
                    return res.status(401).json({ message: 'Credenciais inválidas' });
                }

                const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1h' });
                res.json({ message: 'Login bem-sucedido!', token, user: { id: user.id, name: user.name, email: user.email } });
            });
        } catch (err) {
            console.error('Erro no servidor:', err);
            res.status(500).json({ error: 'Erro no servidor' });
        }
    }
);

router.post('/logout', (req, res) => {
    res.json({ message: 'Logout bem-sucedido' });
});

router.get('/me', authMiddleware, (req, res) => {
    const userID = req.user.id;
    const query = 'SELECT id, name, email FROM users WHERE id = ?';
    db.query(query, [userID], (err, results) => {
        if (err) {
            console.error('Erro ao consultar o banco de dados:', err);
            return res.status(500).json({ error: 'Erro ao consultar o banco de dados' });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        res.json(results[0]);
    });
});

export default router;