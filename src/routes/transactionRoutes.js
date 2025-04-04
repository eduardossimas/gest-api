import express from "express";
import { body, validationResult } from "express-validator";
import db from "../database/index.js";
import authMiddleware from "../middlewares/auth.js";

const router = express.Router();

// Função auxiliar para formatar campos DATE como string "YYYY-MM-DD"
const formatDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().split("T")[0];
};

// Rota para buscar transações
router.get("/transactions", authMiddleware, async (req, res) => {
  const userID = req.user.id;
  const month = req.query.month;
  const year = req.query.year;

  if (!userID) {
    return res.status(400).json({ error: "ID do usuário não fornecido" });
  }

  try {
    let query = "SELECT * FROM transactions WHERE user_id = ?";
    const params = [userID];

    if (year) {
      query += " AND YEAR(paymentDate) = ?";
      params.push(year);
    }

    if (month) {
      query += " AND MONTH(paymentDate) = ?";
      params.push(month);
    }

    db.query(query, params, (err, results) => {
      if (err) {
        console.error("Erro ao buscar transações:", err);
        return res
          .status(500)
          .json({ error: "Erro interno ao buscar transações." });
      }

      const formattedResults = results.map((t) => ({
        ...t,
        dueDate: formatDate(t.dueDate),
        paymentDate: formatDate(t.paymentDate),
        created_at: formatDate(t.created_at),
        updated_at: formatDate(t.updated_at),
      }));

      res.status(200).json(formattedResults);
    });
  } catch (error) {
    console.error("Erro ao buscar transações:", error);
    res.status(500).json({ error: "Erro interno ao buscar transações." });
  }
});

// Rota para buscar transações por data de vencimento
router.get("/transactions-dueDate", authMiddleware, async (req, res) => {
  const userID = req.user.id;
  const month = req.query.month;
  const year = req.query.year;

  if (!userID) {
    return res.status(400).json({ error: "ID do usuário não fornecido" });
  }

  try {
    let query = "SELECT * FROM transactions WHERE user_id = ?";
    const params = [userID];

    if (year) {
      query += " AND YEAR(dueDate) = ?";
      params.push(year);
    }

    if (month) {
      query += " AND MONTH(dueDate) = ?";
      params.push(month);
    }

    db.query(query, params, (err, results) => {
      if (err) {
        console.error("Erro ao buscar transações:", err);
        return res
          .status(500)
          .json({ error: "Erro interno ao buscar transações." });
      }

      const formattedResults = results.map((t) => ({
        ...t,
        dueDate: formatDate(t.dueDate),
        paymentDate: formatDate(t.paymentDate),
        created_at: formatDate(t.created_at),
        updated_at: formatDate(t.updated_at),
      }));

      res.status(200).json(formattedResults);
    });
  } catch (error) {
    console.error("Erro ao buscar transações:", error);
    res.status(500).json({ error: "Erro interno ao buscar transações." });
  }
});

// Rota para criar uma nova transação
router.post(
  "/transactions",
  authMiddleware,
  body("dueDate").notEmpty().withMessage("Data de vencimento é obrigatória"),
  body("paymentDate"),
  body("type").notEmpty().withMessage("Tipo é obrigatório"),
  body("description").notEmpty().withMessage("Descrição é obrigatória"),
  body("value").isNumeric().withMessage("Valor deve ser um número"),
  body("bank_id").notEmpty().withMessage("ID do banco é obrigatório"),
  body("chart_of_account_id")
    .notEmpty()
    .withMessage("ID do plano de contas é obrigatório"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      dueDate,
      paymentDate,
      type,
      description,
      value,
      bank_id,
      chart_of_account_id,
    } = req.body;

    const userID = req.user.id;
    if (!userID) {
      return res.status(400).json({ error: "ID do usuário não fornecido" });
    }

    try {
      const query =
        "INSERT INTO transactions (dueDate, paymentDate, type, description, value, user_id, bank_id, chart_of_account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
      db.query(
        query,
        [
          dueDate,
          paymentDate,
          type,
          description,
          value,
          userID,
          bank_id,
          chart_of_account_id,
        ],
        (err, results) => {
          if (err) {
            console.error("Erro ao criar transação:", err);
            return res
              .status(500)
              .json({ error: "Erro interno ao criar transação" });
          }

          const transactionID = results.insertId;

          // Atualizar saldo do banco
          db.query(
            "SELECT currentBalance FROM banks WHERE id = ?",
            [bank_id],
            (err, bankResults) => {
              if (err) {
                console.error("Erro ao buscar saldo do banco:", err);
                return res
                  .status(500)
                  .json({ error: "Erro interno ao buscar saldo do banco" });
              }

              const currentBalance = bankResults[0].currentBalance;
              let newBalance;
              if (type === "Entrada") {
                newBalance = parseFloat(currentBalance) + parseFloat(value);
              } else if (type === "Saída") {
                newBalance = parseFloat(currentBalance) - parseFloat(value);
              } else {
                return res
                  .status(400)
                  .json({ error: "Tipo de transação inválido" });
              }

              db.query(
                "UPDATE banks SET currentBalance = ? WHERE id = ?",
                [newBalance, bank_id],
                (err) => {
                  if (err) {
                    console.error("Erro ao atualizar saldo do banco:", err);
                    return res
                      .status(500)
                      .json({
                        error: "Erro interno ao atualizar saldo do banco",
                      });
                  }

                  res
                    .status(201)
                    .json({
                      id: transactionID,
                      message: "Transação criada com sucesso.",
                    });
                }
              );
            }
          );
        }
      );
    } catch (error) {
      console.error("Erro ao criar a transação:", error);
      res.status(500).json({ error: "Erro ao criar a transação." });
    }
  }
);

// Rota para deletar uma transação
router.delete("/transactions/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userID = req.user.id;

  if (!userID) {
    return res.status(400).json({ error: "ID do usuário não fornecido" });
  }

  try {
    const query = "SELECT * FROM transactions WHERE id = ? AND user_id = ?";
    db.query(query, [id, userID], (err, results) => {
      if (err) {
        console.error("Erro ao buscar transação:", err);
        return res
          .status(500)
          .json({ error: "Erro interno ao buscar transação" });
      }
      if (results.length === 0) {
        return res.status(404).json({ error: "Transação não encontrada" });
      }

      const transaction = results[0];

      db.query(
        "DELETE FROM transactions WHERE id = ? AND user_id = ?",
        [id, userID],
        (err) => {
          if (err) {
            console.error("Erro ao deletar transação:", err);
            return res
              .status(500)
              .json({ error: "Erro interno ao deletar transação" });
          }

          // Atualizar saldo do banco
          db.query(
            "SELECT currentBalance FROM banks WHERE id = ?",
            [transaction.bank_id],
            (err, bankResults) => {
              if (err) {
                console.error("Erro ao buscar saldo do banco:", err);
                return res
                  .status(500)
                  .json({ error: "Erro interno ao buscar saldo do banco" });
              }

              const currentBalance = bankResults[0].currentBalance;
              let newBalance;
              if (transaction.type === "Entrada") {
                newBalance =
                  parseFloat(currentBalance) - parseFloat(transaction.value);
              } else if (transaction.type === "Saída") {
                newBalance =
                  parseFloat(currentBalance) + parseFloat(transaction.value);
              } else {
                return res
                  .status(400)
                  .json({ error: "Tipo de transação inválido" });
              }

              db.query(
                "UPDATE banks SET currentBalance = ? WHERE id = ?",
                [newBalance, transaction.bank_id],
                (err) => {
                  if (err) {
                    console.error("Erro ao atualizar saldo do banco:", err);
                    return res
                      .status(500)
                      .json({
                        error: "Erro interno ao atualizar saldo do banco",
                      });
                  }

                  res
                    .status(200)
                    .json({ message: "Transação deletada com sucesso." });
                }
              );
            }
          );
        }
      );
    });
  } catch (error) {
    console.error("Erro ao deletar transação:", error);
    res.status(500).json({ error: "Erro interno ao deletar transação." });
  }
});

// Rota para atualizar uma transação
router.put(
  "/transactions/:id",
  authMiddleware,
  body("dueDate").notEmpty().withMessage("Data de vencimento é obrigatória"),
  body("paymentDate").notEmpty().withMessage("Data de pagamento é obrigatória"),
  body("type").notEmpty().withMessage("Tipo é obrigatório"),
  body("description").notEmpty().withMessage("Descrição é obrigatória"),
  body("value").isNumeric().withMessage("Valor deve ser um número"),
  body("bank_id").notEmpty().withMessage("ID do banco é obrigatório"),
  body("chart_of_account_id")
    .notEmpty()
    .withMessage("ID do plano de contas é obrigatório"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const {
      dueDate,
      paymentDate,
      type,
      description,
      value,
      bank_id,
      chart_of_account_id,
    } = req.body;

    const userID = req.user.id;
    if (!userID) {
      return res.status(400).json({ error: "ID do usuário não fornecido" });
    }

    try {
      const query = "SELECT * FROM transactions WHERE id = ? AND user_id = ?";
      db.query(query, [id, userID], (err, results) => {
        if (err) {
          console.error("Erro ao buscar transação:", err);
          return res
            .status(500)
            .json({ error: "Erro interno ao buscar transação" });
        }
        if (results.length === 0) {
          return res.status(404).json({ error: "Transação não encontrada" });
        }

        const transaction = results[0];

        db.query(
          "UPDATE transactions SET dueDate = ?, paymentDate = ?, type = ?, description = ?, value = ?, bank_id = ?, chart_of_account_id = ? WHERE id = ? AND user_id = ?",
          [
            dueDate,
            paymentDate,
            type,
            description,
            value,
            bank_id,
            chart_of_account_id,
            id,
            userID,
          ],
          (err) => {
            if (err) {
              console.error("Erro ao atualizar transação:", err);
              return res
                .status(500)
                .json({ error: "Erro interno ao atualizar transação" });
            }

            // Atualizar saldo do banco
            db.query(
              "SELECT currentBalance FROM banks WHERE id = ?",
              [bank_id],
              (err, bankResults) => {
                if (err) {
                  console.error("Erro ao buscar saldo do banco:", err);
                  return res
                    .status(500)
                    .json({ error: "Erro interno ao buscar saldo do banco" });
                }

                const currentBalance = bankResults[0].currentBalance;
                let newBalance;
                if (transaction.type === "Entrada") {
                  newBalance =
                    parseFloat(currentBalance) - parseFloat(transaction.value);
                } else if (transaction.type === "Saída") {
                  newBalance =
                    parseFloat(currentBalance) + parseFloat(transaction.value);
                } else {
                  return res
                    .status(400)
                    .json({ error: "Tipo de transação inválido" });
                }

                if (type === "Entrada") {
                  newBalance = parseFloat(newBalance) + parseFloat(value);
                } else if (type === "Saída") {
                  newBalance = parseFloat(newBalance) - parseFloat(value);
                } else {
                  return res
                    .status(400)
                    .json({ error: "Tipo de transação inválido" });
                }

                db.query(
                  "UPDATE banks SET currentBalance = ? WHERE id = ?",
                  [newBalance, bank_id],
                  (err) => {
                    if (err) {
                      console.error("Erro ao atualizar saldo do banco:", err);
                      return res
                        .status(500)
                        .json({
                          error: "Erro interno ao atualizar saldo do banco",
                        });
                    }

                    res
                      .status(200)
                      .json({ message: "Transação atualizada com sucesso." });
                  }
                );
              }
            );
          }
        );
      });
    } catch (error) {
      console.error("Erro ao atualizar transação:", error);
      res.status(500).json({ error: "Erro interno ao atualizar transação." });
    }
  }
);

export default router;
