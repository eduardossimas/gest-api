import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../database/index.js';
import authMiddleware from '../middlewares/auth.js';

const router = express.Router();

// Rota para criar um plano de contas
router.post('/plans', 
    authMiddleware,
    body('description').notEmpty().withMessage('Descrição é obrigatória'),
    body('category_id').notEmpty().withMessage('ID da categoria é obrigatório'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { description, category_id } = req.body;
        const userID = req.headers['user-id'];

        try {
            const query = 'INSERT INTO chart_of_accounts (description, category_id, user_id) VALUES (?, ?, ?)';
            db.query(query, [description, category_id, userID], (err, results) => {
                if (err) {
                    console.error("Erro ao criar plano de contas:", err);
                    return res.status(500).json({ error: "Erro interno ao criar plano de contas" });
                }
                res.status(201).json({
                    message: "Plano de contas criado com sucesso",
                    plan: {
                        id: results.insertId,
                        description,
                        category_id,
                        userID,
                    },
                });
            });
        } catch (err) {
            console.error("Erro ao criar plano de contas:", err);
            res.status(500).json({ error: "Erro interno ao criar plano de contas" });
        }
    }
);

// Rota para buscar todos os planos de contas de um usuário específico
router.get('/plans', authMiddleware, async (req, res) => {
    const userID = req.headers['user-id'];

    try {
        const query = 'SELECT * FROM chart_of_accounts WHERE user_id = ?';
        db.query(query, [userID], (err, results) => {
            if (err) {
                console.error("Erro ao buscar planos de contas:", err);
                return res.status(500).json({ error: "Erro interno ao buscar planos de contas" });
            }
            res.status(200).json(results);
        });
    } catch (err) {
        console.error("Erro ao buscar planos de contas:", err);
        res.status(500).json({ error: "Erro interno ao buscar planos de contas" });
    }
});

// Rota para deletar um plano de contas
router.delete('/plans/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const userID = req.headers['user-id'];

    try {
        const query = 'SELECT * FROM chart_of_accounts WHERE id = ? AND user_id = ?';
        db.query(query, [id, userID], (err, results) => {
            if (err) {
                console.error("Erro ao buscar plano de contas:", err);
                return res.status(500).json({ error: "Erro interno ao buscar plano de contas" });
            }
            if (results.length === 0) {
                return res.status(404).json({ error: "Plano de contas não encontrado" });
            }

            const deleteQuery = 'DELETE FROM chart_of_accounts WHERE id = ? AND user_id = ?';
            db.query(deleteQuery, [id, userID], (err) => {
                if (err) {
                    console.error("Erro ao deletar plano de contas:", err);
                    return res.status(500).json({ error: "Erro interno ao deletar plano de contas" });
                }
                res.status(200).json({ message: "Plano de contas deletado com sucesso" });
            });
        });
    } catch (err) {
        console.error("Erro ao deletar plano de contas:", err);
        res.status(500).json({ error: "Erro interno ao deletar plano de contas" });
    }
});

// Rota para atualizar um plano de contas
router.put('/plans/:id', 
    authMiddleware,
    body('description').notEmpty().withMessage('Descrição é obrigatória'),
    body('category_id').notEmpty().withMessage('ID da categoria é obrigatório'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const userID = req.headers['user-id'];
        const { description, category_id } = req.body;

        try {
            const query = 'SELECT * FROM chart_of_accounts WHERE id = ? AND user_id = ?';
            db.query(query, [id, userID], (err, results) => {
                if (err) {
                    console.error("Erro ao buscar plano de contas:", err);
                    return res.status(500).json({ error: "Erro interno ao buscar plano de contas" });
                }
                if (results.length === 0) {
                    return res.status(404).json({ error: "Plano de contas não encontrado" });
                }

                const updateQuery = 'UPDATE chart_of_accounts SET description = ?, category_id = ? WHERE id = ? AND user_id = ?';
                db.query(updateQuery, [description, category_id, id, userID], (err) => {
                    if (err) {
                        console.error("Erro ao atualizar plano de contas:", err);
                        return res.status(500).json({ error: "Erro interno ao atualizar plano de contas" });
                    }
                    res.status(200).json({ message: "Plano de contas atualizado com sucesso" });
                });
            });
        } catch (err) {
            console.error("Erro ao atualizar plano de contas:", err);
            res.status(500).json({ error: "Erro interno ao atualizar plano de contas" });
        }
    }
);

export default router;