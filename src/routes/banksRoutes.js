import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../database/index.js';
import authMiddleware from '../middlewares/auth.js';

const router = express.Router();

// Rota para criar um banco
router.post('/banks', 
    authMiddleware,
    body('nameBank').notEmpty().withMessage('Nome do banco é obrigatório'),
    body('initialBalance').isNumeric().withMessage('Saldo inicial deve ser um número'),
    body('startDate').notEmpty().withMessage('Data de início é obrigatória'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { nameBank, initialBalance, startDate } = req.body;
        const userID = req.headers['user-id'];

        const currentBalance = initialBalance;

        try {
            const query = 'INSERT INTO banks (nameBank, initialBalance, currentBalance, startDate, userID) VALUES (?, ?, ?, ?, ?)';
            db.query(query, [nameBank, initialBalance, currentBalance, startDate, userID], (err, results) => {
                if (err) {
                    console.error("Erro ao criar banco:", err);
                    return res.status(500).json({ error: "Erro interno ao criar banco" });
                }
                res.status(201).json({
                    message: "Banco criado com sucesso",
                    bank: {
                        id: results.insertId,
                        nameBank,
                        initialBalance,
                        currentBalance,
                        startDate,
                        userID,
                    },
                });
            });
        } catch (err) {
            console.error("Erro ao criar banco:", err);
            res.status(500).json({ error: "Erro interno ao criar banco" });
        }
    }
);

// Rota para buscar bancos de um usuário específico
router.get('/banks', authMiddleware, async (req, res) => {
    const userID = req.headers['user-id'];

    try {
        const query = 'SELECT * FROM banks WHERE userID = ?';
        db.query(query, [userID], (err, results) => {
            if (err) {
                console.error("Erro ao buscar bancos:", err);
                return res.status(500).json({ error: "Erro interno ao buscar bancos" });
            }
            res.status(200).json(results);
        });
    } catch (err) {
        console.error("Erro ao buscar bancos:", err);
        res.status(500).json({ error: "Erro interno ao buscar bancos" });
    }
});

export default router;