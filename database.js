const mysql = require('mysql2/promise');

// Configuración de la conexión a HeidiSQL / MySQL
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',       // Tu usuario de MySQL en HeidiSQL
    password: '',       // Si no tienes contraseña, déjalo vacío
    database: 'todo_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;