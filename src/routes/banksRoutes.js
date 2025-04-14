import express from "express";
import { body, validationResult } from "express-validator";
import db from "../database/index.js";
import authMiddleware from "../middlewares/auth.js";

const router = express.Router();

// Rota para criar um banco
router.post(
  "/banks",
  authMiddleware,
  body("nameBank").notEmpty().withMessage("Nome do banco é obrigatório"),
  body("initialBalance")
    .isNumeric()
    .withMessage("Saldo inicial deve ser um número"),
  body("startDate").notEmpty().withMessage("Data de início é obrigatória"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nameBank, initialBalance, startDate } = req.body;
    const userID = req.headers["user-id"];

    const currentBalance = initialBalance;

    try {
      const query =
        "INSERT INTO banks (nameBank, initialBalance, currentBalance, startDate, userID) VALUES (?, ?, ?, ?, ?)";
      db.query(
        query,
        [nameBank, initialBalance, currentBalance, startDate, userID],
        (err, results) => {
          if (err) {
            console.error("Erro ao criar banco:", err);
            return res
              .status(500)
              .json({ error: "Erro interno ao criar banco" });
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
        }
      );
    } catch (err) {
      console.error("Erro ao criar banco:", err);
      res.status(500).json({ error: "Erro interno ao criar banco" });
    }
  }
);

const formatDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return new Date(d.getTime() + Math.abs(d.getTimezoneOffset() * 60000))
    .toISOString()
    .split("T")[0];
};

router.get("/banks", authMiddleware, async (req, res) => {
  const userID = req.headers["user-id"];

  try {
    const query = "SELECT * FROM banks WHERE userID = ?";
    db.query(query, [userID], (err, results) => {
      if (err) {
        console.error("Erro ao buscar bancos:", err);
        return res.status(500).json({ error: "Erro interno ao buscar bancos" });
      }

      const formattedResults = results.map((bank) => ({
        ...bank,
        startDate: formatDate(bank.startDate),
      }));

      res.status(200).json(formattedResults);
    });
  } catch (err) {
    console.error("Erro ao buscar bancos:", err);
    res.status(500).json({ error: "Erro interno ao buscar bancos" });
  }
});

// Rota para editar um banco existente
router.put(
  "/banks/:id",
  authMiddleware,
  body("nameBank").notEmpty().withMessage("Nome do banco é obrigatório"),
  body("initialBalance")
    .isNumeric()
    .withMessage("Saldo inicial deve ser um número"),
  body("startDate").notEmpty().withMessage("Data de início é obrigatória"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const userID = req.headers["user-id"];
    const { nameBank, initialBalance, startDate } = req.body;

    try {
      const query = `
                UPDATE banks 
                SET nameBank = ?, initialBalance = ?, startDate = ? 
                WHERE id = ? AND userID = ?
            `;
      db.query(
        query,
        [nameBank, initialBalance, startDate, id, userID],
        (err, result) => {
          if (err) {
            console.error("Erro ao editar banco:", err);
            return res
              .status(500)
              .json({ error: "Erro interno ao editar banco" });
          }

          if (result.affectedRows === 0) {
            return res
              .status(404)
              .json({ error: "Banco não encontrado ou não autorizado" });
          }

          res.status(200).json({ message: "Banco atualizado com sucesso" });
        }
      );
    } catch (err) {
      console.error("Erro ao editar banco:", err);
      res.status(500).json({ error: "Erro interno ao editar banco" });
    }
  }
);

// Rota para excluir um banco
router.delete("/banks/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userID = req.headers["user-id"];

  try {
    const query = "DELETE FROM banks WHERE id = ? AND userID = ?";
    db.query(query, [id, userID], (err, result) => {
      if (err) {
        console.error("Erro ao excluir banco:", err);
        return res.status(500).json({ error: "Erro interno ao excluir banco" });
      }

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ error: "Banco não encontrado ou não autorizado" });
      }

      res.status(200).json({ message: "Banco excluído com sucesso" });
    });
  } catch (err) {
    console.error("Erro ao excluir banco:", err);
    res.status(500).json({ error: "Erro interno ao excluir banco" });
  }
});

export default router;
