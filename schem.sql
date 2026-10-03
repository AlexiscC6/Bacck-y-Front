-- 1. Crear la base de datos si no existe
CREATE DATABASE IF NOT EXISTS todo_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

-- 2. Seleccionar la base de datos
USE todo_db;

-- 3. Crear la tabla de tareas
CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);