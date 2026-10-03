"use strict";

const API_URL = "http://localhost:3000/api";

class ApiError extends Error {
  constructor(message, kind) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
  }
}

async function request(path, method = "GET", body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(API_URL + path, {
      method,
      headers: body === undefined ? { Accept: "application/json" } : {
        Accept: "application/json", "Content-Type": "application/json"
      },
      signal: controller.signal,
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    if (!response.ok) {
      throw new ApiError("El servidor no pudo completar la operación. Inténtalo de nuevo.", "http");
    }
    const raw = await response.text();
    if (!raw.trim()) {
      if (method === "GET") throw new ApiError("El servidor devolvió una respuesta inesperada.", "invalid");
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch {
      throw new ApiError("El servidor devolvió una respuesta inesperada.", "invalid");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("No se pudo conectar con el servidor. Verifica que el Backend esté ejecutándose.", "connection");
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeTask(task) {
  if (!task || typeof task !== "object" ||
      !["string", "number"].includes(typeof task.id) ||
      String(task.id).trim() === "" ||
      (typeof task.id === "number" && !Number.isFinite(task.id)) ||
      typeof task.title !== "string" ||
      ![true, false, 0, 1, "0", "1"].includes(task.completed) ||
      (task.description != null && typeof task.description !== "string")) {
    throw new ApiError("El servidor devolvió una respuesta inesperada.", "invalid");
  }
  return { ...task, description: task.description ?? "",
    completed: task.completed === true || task.completed === 1 || task.completed === "1" };
}

async function getTasks() {
  const data = await request("/tasks");
  if (!Array.isArray(data)) throw new ApiError("El servidor devolvió una respuesta inesperada.", "invalid");
  const tasks = data.map(normalizeTask);
  if (new Set(tasks.map(task => String(task.id))).size !== tasks.length) {
    throw new ApiError("El servidor devolvió una respuesta inesperada.", "invalid");
  }
  return tasks;
}

function createTask(task) { return request("/tasks", "POST", task); }
function updateTask(id, task) { return request("/tasks/" + encodeURIComponent(id), "PUT", task); }
function deleteTask(id) { return request("/tasks/" + encodeURIComponent(id), "DELETE"); }
