const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Permite peticiones del Frontend y procesa formato JSON[cite: 1]
app.use(cors());
app.use(express.json());

// 1. GET /api/tasks — Obtener todas las tareas[cite: 1]
app.get('/api/tasks', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM tasks ORDER BY created_at DESC');
        const formattedTasks = rows.map(task => ({
            ...task,
            completed: Boolean(task.completed)
        }));
        res.json(formattedTasks);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener las tareas.' });
    }
});

// 2. POST /api/tasks — Crear nueva tarea[cite: 1]
app.post('/api/tasks', async (req, res) => {
    const { title, description } = req.body;

    if (!title || title.trim() === '') {
        return res.status(400).json({ error: 'El título es obligatorio.' });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO tasks (title, description, completed) VALUES (?, ?, ?)',
            [title.trim(), description ? description.trim() : '', false]
        );

        const [newTask] = await db.query('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
        res.status(201).json({
            ...newTask[0],
            completed: Boolean(newTask[0].completed)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear la tarea.' });
    }
});

// 3. PUT /api/tasks/:id — Actualizar tarea o estado[cite: 1]
app.put('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    const { title, description, completed } = req.body;

    try {
        const [existing] = await db.query('SELECT * FROM tasks WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Tarea no encontrada.' });
        }

        const task = existing[0];
        const updatedTitle = title !== undefined ? title.trim() : task.title;
        const updatedDescription = description !== undefined ? description.trim() : task.description;
        const updatedCompleted = completed !== undefined ? completed : task.completed;

        if (updatedTitle === '') {
            return res.status(400).json({ error: 'El título no puede estar vacío.' });
        }

        await db.query(
            'UPDATE tasks SET title = ?, description = ?, completed = ? WHERE id = ?',
            [updatedTitle, updatedDescription, updatedCompleted, id]
        );

        const [updatedTask] = await db.query('SELECT * FROM tasks WHERE id = ?', [id]);
        res.json({
            ...updatedTask[0],
            completed: Boolean(updatedTask[0].completed)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar la tarea.' });
    }
});

// 4. DELETE /api/tasks/:id — Eliminar tarea por ID[cite: 1]
app.delete('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [existing] = await db.query('SELECT * FROM tasks WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Tarea no encontrada.' });
        }

        await db.query('DELETE FROM tasks WHERE id = ?', [id]);
        res.json({ message: 'Tarea eliminada exitosamente.', id: Number(id) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar la tarea.' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor Backend corriendo en http://localhost:${PORT}`);
});