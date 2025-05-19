import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import pool from '../database/index.js';
import authMiddleware from '../middlewares/auth.js';

const router = express.Router();
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

const excelDateToJSDate = (serial) => {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);

    // Adiciona o deslocamento do fuso horário local
    const local_date = new Date(date_info.getTime() + date_info.getTimezoneOffset() * 60000);
    return local_date;
};

router.post('/importar-transacoes', authMiddleware, upload.single('arquivo'), async (req, res) => {
    if (!req.file) return res.status(400).json({ erro: "Nenhum arquivo enviado." });

    const userID = req.headers['user-id'];
    if (!userID) return res.status(400).json({ erro: "ID do usuário não fornecido." });

    const caminhoArquivo = path.join(uploadDir, req.file.filename);

    let connection;
    try {
        connection = await pool.promise().getConnection();
        await connection.beginTransaction();

        const workbook = xlsx.readFile(caminhoArquivo);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const dados = xlsx.utils.sheet_to_json(sheet);

        if (!dados.length) throw new Error("Planilha vazia ou inválida.");

        for (const [index, item] of dados.entries()) { // Adiciona o índice da linha
            try {
                // Validação dos campos da planilha
                if (!item["Data Vencimento"] || !item["Data Pagamento"] || !item["Tipo"] || !item["Descrição"] || !item["Valor"] || !item["Banco"] || !item["Plano de Contas"]) {
                    throw new Error(`Dados obrigatórios ausentes na linha ${index + 2}.`);
                }

                const dueDate = excelDateToJSDate(item["Data Vencimento"]);
                const paymentDate = excelDateToJSDate(item["Data Pagamento"]);
                const { Tipo, Descrição, Valor, Banco, "Plano de Contas": PlanoDeContas } = item;

                // Validação dos valores convertidos
                if (!dueDate || !paymentDate || !Tipo || !Descrição || !Valor || !Banco || !PlanoDeContas) {
                    throw new Error(`Dados inválidos na linha ${index + 2}.`);
                }

                const [bank] = await connection.execute(
                    'SELECT * FROM banks WHERE nameBank = ? AND userID = ?', 
                    [Banco, userID]
                );
                const [account] = await connection.execute(
                    'SELECT * FROM chart_of_accounts WHERE description = ? AND user_id = ?', 
                    [PlanoDeContas, userID]
                );

                if (!bank.length || !account.length) {
                    throw new Error(`Banco ou plano de contas inválido na linha ${index + 2}.`);
                }

                await connection.execute(
                    'INSERT INTO transactions (dueDate, paymentDate, type, description, value, user_id, bank_id, chart_of_account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
                    [dueDate, paymentDate, Tipo, Descrição, parseFloat(Valor), userID, bank[0].id, account[0].id]
                );

                const newBalance = Tipo.toLowerCase() === 'entrada' 
                    ? bank[0].currentBalance + parseFloat(Valor) 
                    : bank[0].currentBalance - parseFloat(Valor);

                await connection.execute(
                    'UPDATE banks SET currentBalance = ? WHERE id = ?', 
                    [newBalance, bank[0].id]
                );
            } catch (err) {
                console.error(`Erro na linha ${index + 2}:`, err.message);
                throw new Error(`Erro na linha ${index + 2}: ${err.message}`);
            }
        }

        await connection.commit();
        res.status(200).json({ mensagem: "Transações importadas com sucesso!" });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao processar a planilha:", error);
        res.status(500).json({ erro: error.message || "Erro ao processar a planilha." });
    } finally {
        if (connection) connection.release();
        fs.unlinkSync(caminhoArquivo);
    }
});

export default router;