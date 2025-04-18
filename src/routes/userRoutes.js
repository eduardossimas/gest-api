import express from "express";
import bcrypt from "bcryptjs";
import { body, validationResult } from "express-validator";
import db from "../database/index.js";
const router = express.Router();

router.post(
  "/register",
  body("name").notEmpty().withMessage("Nome é obrigatório"),
  body("email").isEmail().withMessage("Email inválido"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("A senha deve ter pelo menos 6 caracteres"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const query =
        "INSERT INTO users (name, email, password) VALUES (?, ?, ?)";
      db.query(query, [name, email, hashedPassword], (err, results) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ id: results.insertId });
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.get("/users", (req, res) => {
  const userID = req.headers["user-id"]; // Obtém o userID do cabeçalho

  if (!userID) {
    return res.status(400).json({ error: "ID do usuário não fornecido." });
  }

  const query = "SELECT * FROM users WHERE id = ?";
  db.query(query, [userID], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    res.json(results[0]); // Retorna apenas o usuário encontrado
  });
});

export default router;
