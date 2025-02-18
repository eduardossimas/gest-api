import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import banksRoutes from './routes/banksRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import plansRoutes from './routes/planRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import dotenv from 'dotenv';
import authMiddleware from './middlewares/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = ['http://localhost:3000', 'http://localhost:5173', 'https://gest-app.vercel.app'];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) === -1) {
            const message = 'A política de CORS para este site não permite acesso a partir da origem fornecida.';
            return callback(new Error(message), false);
        }

        return callback(null, true);
    },
    credentials: true
}));

app.use(cookieParser());
app.use(express.json());

app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', banksRoutes);
app.use('/api', categoryRoutes);
app.use('/api', plansRoutes);
app.use('/api', transactionRoutes);

app.use('/api/protected', authMiddleware);


app.get('/api/protected', (req, res) => {
    res.json({ message: 'Você está autenticado', user: req.user });
});

// Adicione outras rotas protegidas aqui
// app.get('/api/protected/another-route', authMiddleware, (req, res) => { ... });

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});