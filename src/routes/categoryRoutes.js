import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../database/index.js';
import authMiddleware from '../middlewares/auth.js';

const router = express.Router();

// Rota para criar uma categoria do plano de contas
router.post('/category', 
    authMiddleware,
    body('description').notEmpty().withMessage('Descrição é obrigatória'),
    body('DRE_range').notEmpty().withMessage('Faixa DRE é obrigatória'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { description, DRE_range } = req.body;
        const userID = req.headers['user-id'];

        try {
            const query = 'INSERT INTO categories (description, DRE_range, user_id) VALUES (?, ?, ?)';
            db.query(query, [description, DRE_range, userID], (err, results) => {
                if (err) {
                    console.error("Erro ao criar categoria:", err);
                    return res.status(500).json({ error: "Erro interno ao criar categoria" });
                }
                res.status(201).json({
                    message: "Categoria criada com sucesso",
                    category: {
                        id: results.insertId,
                        description,
                        DRE_range,
                        userID,
                    },
                });
            });
        } catch (err) {
            console.error("Erro ao criar categoria:", err);
            res.status(500).json({ error: "Erro interno ao criar categoria" });
        }
    }
);

// Rota para buscar categorias do plano de contas de um usuário específico
router.get('/category', authMiddleware, async (req, res) => {
    const userID = req.headers['user-id'];

    try {
        const query = 'SELECT * FROM categories WHERE user_id = ?';
        db.query(query, [userID], (err, results) => {
            if (err) {
                console.error("Erro ao buscar categorias:", err);
                return res.status(500).json({ error: "Erro interno ao buscar categorias" });
            }
            res.status(200).json(results);
        });
    } catch (err) {
        console.error("Erro ao buscar categorias:", err);
        res.status(500).json({ error: "Erro interno ao buscar categorias" });
    }
});

// Rota para deletar uma categoria do plano de contas
router.delete('/category/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const userID = req.headers['user-id'];

    try {
        const query = 'SELECT * FROM categories WHERE id = ? AND user_id = ?';
        db.query(query, [id, userID], (err, results) => {
            if (err) {
                console.error("Erro ao buscar categoria:", err);
                return res.status(500).json({ error: "Erro interno ao buscar categoria" });
            }
            if (results.length === 0) {
                return res.status(404).json({ error: "Categoria não encontrada" });
            }

            const deleteQuery = 'DELETE FROM categories WHERE id = ? AND user_id = ?';
            db.query(deleteQuery, [id, userID], (err) => {
                if (err) {
                    console.error("Erro ao deletar categoria:", err);
                    return res.status(500).json({ error: "Erro interno ao deletar categoria" });
                }
                res.status(200).json({ message: "Categoria deletada com sucesso" });
            });
        });
    } catch (err) {
        console.error("Erro ao deletar categoria:", err);
        res.status(500).json({ error: "Erro interno ao deletar categoria" });
    }
});

// Rota para atualizar uma categoria do plano de contas
router.put('/category/:id', 
    authMiddleware,
    body('description').notEmpty().withMessage('Descrição é obrigatória'),
    body('DRE_range').notEmpty().withMessage('Faixa DRE é obrigatória'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const userID = req.headers['user-id'];
        const { description, DRE_range } = req.body;

        try {
            const query = 'SELECT * FROM categories WHERE id = ? AND user_id = ?';
            db.query(query, [id, userID], (err, results) => {
                if (err) {
                    console.error("Erro ao buscar categoria:", err);
                    return res.status(500).json({ error: "Erro interno ao buscar categoria" });
                }
                if (results.length === 0) {
                    return res.status(404).json({ error: "Categoria não encontrada" });
                }

                const updateQuery = 'UPDATE categories SET description = ?, DRE_range = ? WHERE id = ? AND user_id = ?';
                db.query(updateQuery, [description, DRE_range, id, userID], (err) => {
                    if (err) {
                        console.error("Erro ao atualizar categoria:", err);
                        return res.status(500).json({ error: "Erro interno ao atualizar categoria" });
                    }
                    res.status(200).json({ message: "Categoria atualizada com sucesso" });
                });
            });
        } catch (err) {
            console.error("Erro ao atualizar categoria:", err);
            res.status(500).json({ error: "Erro interno ao atualizar categoria" });
        }
    }
);

export default router;