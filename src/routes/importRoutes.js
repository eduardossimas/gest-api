
import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import knex from '../database/knex.js';
import moment from 'moment';
import { body, validationResult } from 'express-validator';

const router = express.Router();

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

const upload = multer({ storage: storage });

const validarDados = (dados) => {
    return dados.every(
        (item) =>
            item["Data Vencimento"] &&
            item["Data Pagamento"] &&
            item.Tipo &&
            item.Descrição &&
            item.Valor &&
            item.Banco &&
            item["Plano de Contas"]
    );
};

const excelDateToJSDate = (serial) => {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    const local_date = new Date(
        date_info.getTime() + date_info.getTimezoneOffset() * 60000
    );
    return local_date;
};

router.post('/importar-transacoes', 
    upload.single('arquivo'),
    async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ erro: "Nenhum arquivo enviado." });
        }

        try {
            const caminhoArquivo = path.join(uploadDir, req.file.filename);
            const workbook = xlsx.readFile(caminhoArquivo);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const dados = xlsx.utils.sheet_to_json(sheet);

            if (!validarDados(dados)) {
                fs.unlinkSync(caminhoArquivo);
                return res.status(400).json({ erro: "Planilha inválida. Verifique os campos obrigatórios." });
            }

            const user_id = req.query.userID || req.headers['user_id'];
            if (!user_id) {
                fs.unlinkSync(caminhoArquivo);
                return res.status(400).json({ erro: "ID do usuário não fornecido." });
            }

            await knex.transaction(async (trx) => {
                for (const item of dados) {
                    const {
                        "Data Vencimento": dueDate,
                        "Data Pagamento": paymentDate,
                        Tipo,
                        Descrição,
                        Valor,
                        Banco,
                        "Plano de Contas": chartOfAccount,
                    } = item;

                    const formattedDueDate = moment(excelDateToJSDate(dueDate)).format('YYYY-MM-DD');
                    const formattedPaymentDate = moment(excelDateToJSDate(paymentDate)).format('YYYY-MM-DD');

                    const bankRecord = await trx("banks")
                        .where({ nameBank: Banco, user_id })
                        .first();
                    const chartOfAccountRecord = await trx("chart_of_accounts")
                        .where({ description: chartOfAccount, user_id })
                        .first();

                    if (!bankRecord || !chartOfAccountRecord) {
                        throw new Error("Banco ou plano de contas inválido.");
                    }

                    const bank_id = bankRecord.id;
                    const chart_of_account_id = chartOfAccountRecord.id;

                    await trx("transactions").insert({
                        dueDate: formattedDueDate,
                        paymentDate: formattedPaymentDate,
                        type: Tipo,
                        description: Descrição,
                        value: Valor,
                        user_id,
                        bank_id,
                        chart_of_account_id,
                    });

                    let newBalance;
                    if (Tipo === "Entrada") {
                        newBalance = parseFloat(bankRecord.currentBalance) + parseFloat(Valor);
                    } else if (Tipo === "Saída" || Tipo === "Saida") {
                        newBalance = parseFloat(bankRecord.currentBalance) - parseFloat(Valor);
                    } else {
                        throw new Error("Tipo de transação inválido.");
                    }

                    await trx("banks")
                        .where({ id: bank_id })
                        .update({ currentBalance: newBalance });
                }
            });

            fs.unlinkSync(caminhoArquivo);
            res.status(200).json({ mensagem: "Transações importadas com sucesso!" });
        } catch (error) {
            console.error("Erro ao processar a planilha:", error);
            res.status(500).json({ erro: "Erro ao processar a planilha." });
        }
    }
);

export default router;