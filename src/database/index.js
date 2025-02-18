import mysql from 'mysql2';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
    connectionLimit: 10, 
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 10000,
    waitForConnections: true,
    queueLimit: 0
});

pool.on('connection', () => {
    console.log('Nova conexão com o banco de dados estabelecida.');
});

pool.on('error', (err) => {
    console.error('Erro na conexão do banco de dados:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.error('Conexão perdida. Tentando reconectar...');
    }
});

export default pool;
