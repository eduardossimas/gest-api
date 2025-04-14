import express from "express";
import { body, validationResult } from "express-validator";
import db from "../database/index.js";
import authMiddleware from "../middlewares/auth.js";

const router = express.Router();

router.get("/transfers", authMiddleware, async (req, res) => {
  const user_id = req.user.id;

  if (!user_id) {
    return res.status(400).json({ error: "ID do usuário não fornecido" });
  }

  try {
    let query = "SELECT * FROM transfers WHERE user_id = ?";
    const params = [user_id];

    db.query(query, params, (err, results) => {
      if (err) {
        console.error("Erro ao buscar transferencias:", err);
        return res
          .status(500)
          .json({ error: "Erro interno ao buscar transferencias." });
      }
      res.status(200).json(results);
    });
  } catch (error) {
    console.error("Erro ao buscar transferencias:", error);
    res.status(500).json({ error: "Erro interno ao buscar transferencias." });
  }
});

router.post("/transfers", authMiddleware, async (req, res) => {
  const user_id = req.user.id;
  const { from_bank_id, to_bank_id, value, date, description } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: "ID do usuário não fornecido" });
  }

  if (!from_bank_id || !to_bank_id || !value || !date || !description) {
    return res
      .status(400)
      .json({ error: "Campos obrigatórios não preenchidos." });
  }

  try {
    let query =
      "INSERT INTO transfers (from_bank_id, to_bank_id, description, value, date, user_id) VALUES (?, ?, ?, ?, ?, ?)";
    const params = [
      from_bank_id,
      to_bank_id,
      description,
      value,
      date,
      user_id,
    ];

    db.query(query, params, (err, results) => {
      if (err) {
        console.error("Erro ao inserir transferencia:", err);
        return res
          .status(500)
          .json({ error: "Erro interno ao inserir transferencia." });
      }
      res.status(201).json({ id: results.insertId });

      // Após inserir a transferência com sucesso
      const updateFromBank =
        "UPDATE banks SET currentBalance = currentBalance - ? WHERE id = ? AND userID = ?";
      const updateToBank =
        "UPDATE banks SET currentBalance = currentBalance + ? WHERE id = ? AND userID = ?";

      db.query(updateFromBank, [value, from_bank_id, user_id], (err) => {
        if (err) console.error("Erro ao debitar do banco origem:", err);
      });
      db.query(updateToBank, [value, to_bank_id, user_id], (err) => {
        if (err) console.error("Erro ao creditar no banco destino:", err);
      });
    });
  } catch (error) {
    console.error("Erro ao inserir transferencia:", error);
    res.status(500).json({ error: "Erro interno ao inserir transferencia." });
  }
});

router.put("/transfers/:id", authMiddleware, async (req, res) => {
  const user_id = req.user.id;
  const { id } = req.params;
  const { from_bank_id, to_bank_id, value, date, description } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: "ID do usuário não fornecido" });
  }

  if (!from_bank_id || !to_bank_id || !value || !date) {
    return res
      .status(400)
      .json({ error: "Campos obrigatórios não preenchidos." });
  }

  try {
    // 1. Buscar a transferência original
    const getOldTransfer =
      "SELECT * FROM transfers WHERE id = ? AND user_id = ?";
    db.query(getOldTransfer, [id, user_id], (err, transferResults) => {
      if (err || transferResults.length === 0) {
        return res.status(404).json({ error: "Transferência não encontrada." });
      }

      const oldTransfer = transferResults[0];

      // 2. Reverter os saldos da transferência antiga
      const revertFromBank =
        "UPDATE banks SET currentBalance = currentBalance + ? WHERE id = ? AND userID = ?";
      const revertToBank =
        "UPDATE banks SET currentBalance = currentBalance - ? WHERE id = ? AND userID = ?";

      db.query(
        revertFromBank,
        [oldTransfer.value, oldTransfer.from_bank_id, user_id],
        (err) => {
          if (err)
            console.error("Erro ao reverter débito do banco antigo:", err);
        }
      );

      db.query(
        revertToBank,
        [oldTransfer.value, oldTransfer.to_bank_id, user_id],
        (err) => {
          if (err)
            console.error("Erro ao reverter crédito do banco antigo:", err);
        }
      );

      // 3. Atualizar a transferência
      const updateTransfer = `
        UPDATE transfers 
        SET from_bank_id = ?, to_bank_id = ?, value = ?, date = ?, description = ?
        WHERE id = ? AND user_id = ?
      `;
      const updateParams = [
        from_bank_id,
        to_bank_id,
        value,
        date,
        description || "",
        id,
        user_id,
      ];

      db.query(updateTransfer, updateParams, (err) => {
        if (err) {
          console.error("Erro ao atualizar transferência:", err);
          return res
            .status(500)
            .json({ error: "Erro interno ao atualizar transferência." });
        }

        // 4. Aplicar os novos saldos
        const applyFromBank =
          "UPDATE banks SET currentBalance = currentBalance - ? WHERE id = ? AND userID = ?";
        const applyToBank =
          "UPDATE banks SET currentBalance = currentBalance + ? WHERE id = ? AND userID = ?";

        db.query(applyFromBank, [value, from_bank_id, user_id], (err) => {
          if (err) console.error("Erro ao debitar do novo banco origem:", err);
        });

        db.query(applyToBank, [value, to_bank_id, user_id], (err) => {
          if (err)
            console.error("Erro ao creditar no novo banco destino:", err);
        });

        res
          .status(200)
          .json({ message: "Transferência atualizada com sucesso." });
      });
    });
  } catch (error) {
    console.error("Erro ao atualizar transferência:", error);
    res.status(500).json({ error: "Erro interno ao atualizar transferência." });
  }
});

router.delete("/transfers/:id", authMiddleware, async (req, res) => {
  const user_id = req.user.id;
  const { id } = req.params;

  if (!user_id) {
    return res.status(400).json({ error: "ID do usuário não fornecido" });
  }

  try {
    const query = "DELETE FROM transfers WHERE id = ? AND user_id = ?";
    const params = [id, user_id];

    const getTransfer = "SELECT * FROM transfers WHERE id = ? AND user_id = ?";
    db.query(getTransfer, [id, user_id], (err, transferResults) => {
      if (err || transferResults.length === 0) {
        return res.status(404).json({ error: "Transferência não encontrada." });
      }

      const transfer = transferResults[0];

      const updateFromBank =
        "UPDATE banks SET currentBalance = currentBalance + ? WHERE id = ? AND userID = ?";
      const updateToBank =
        "UPDATE banks SET currentBalance = currentBalance - ? WHERE id = ? AND userID = ?";

      db.query(updateFromBank, [
        transfer.value,
        transfer.from_bank_id,
        user_id,
      ]);
      db.query(updateToBank, [transfer.value, transfer.to_bank_id, user_id]);

      // Agora sim exclui
      const deleteQuery = "DELETE FROM transfers WHERE id = ? AND user_id = ?";
      db.query(deleteQuery, [id, user_id], (err, result) => {
        if (err) {
          console.error("Erro ao deletar transferência:", err);
          return res
            .status(500)
            .json({ error: "Erro interno ao deletar transferência." });
        }
        res
          .status(200)
          .json({ message: "Transferência deletada com sucesso." });
      });
    });
  } catch (error) {
    console.error("Erro ao deletar transferência:", error);
    res.status(500).json({ error: "Erro interno ao deletar transferência." });
  }
});

export default router;
