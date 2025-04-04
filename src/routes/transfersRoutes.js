import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../database/index.js';
import authMiddleware from '../middlewares/auth.js';

const router = express.Router();

router.get('/transfers', authMiddleware, async (req, res) => {
    const user_id = req.user.id;

    if (!user_id) {
        return res.status(400).json({ error: "ID do usuário não fornecido" });
    }

    try {
        let query = 'SELECT * FROM transfers WHERE user_id = ?';
        const params = [user_id];

        db.query(query, params, (err, results) => {
            if (err) {
                console.error("Erro ao buscar transferencias:", err);
                return res.status(500).json({ error: "Erro interno ao buscar transferencias." });
            }
            res.status(200).json(results);
        });
    } catch (error) {
        console.error("Erro ao buscar transferencias:", error);
        res.status(500).json({ error: "Erro interno ao buscar transferencias." });
    }
});

router.post('/transfers', authMiddleware, async (req, res) => {
    const user_id = req.user.id;
    const { from_bank_id, to_bank_id, value, date } = req.body;

    if (!user_id) {
        return res.status(400).json({ error: "ID do usuário não fornecido" });
    }

    if (!from_bank_id || !to_bank_id || !value || !date) {
        return res.status(400).json({ error: "Campos obrigatórios não preenchidos." });
    }

    try {
        let query = 'INSERT INTO transfers (from_bank_id, to_bank_id, value, date, user_id) VALUES (?, ?, ?, ?, ?)';
        const params = [from_bank_id, to_bank_id, value, date, user_id];

        db.query(query, params, (err, results) => {
            if (err) {
                console.error("Erro ao inserir transferencia:", err);
                return res.status(500).json({ error: "Erro interno ao inserir transferencia." });
            }
            res.status(201).json({ id: results.insertId });
        });
    } catch (error) {
        console.error("Erro ao inserir transferencia:", error);
        res.status(500).json({ error: "Erro interno ao inserir transferencia." });
    }
});

export default router;