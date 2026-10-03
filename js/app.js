"use strict";

const ui = {
  createForm: document.querySelector("#create-form"),
  title: document.querySelector("#title"),
  description: document.querySelector("#description"),
  titleError: document.querySelector("#title-error"),
  add: document.querySelector("#add-button"),
  list: document.querySelector("#task-list"),
  state: document.querySelector("#list-state"),
  refresh: document.querySelector("#refresh-button"),
  message: document.querySelector("#message"),
  dialog: document.querySelector("#edit-dialog"),
  editForm: document.querySelector("#edit-form"),
  editTitle: document.querySelector("#edit-title"),
  editDescription: document.querySelector("#edit-description"),
  editError: document.querySelector("#edit-error"),
  save: document.querySelector("#save-button"),
  cancel: document.querySelector("#cancel-edit")
};

let tasks = [];
let filter = "all";
let loaded = false;
let busy = false;
let editingId = null;
let messageTimer;

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function notify(text, isError = false) {
  clearTimeout(messageTimer);
  ui.message.className = isError ? "message error" : "message";
  ui.message.textContent = text;
  ui.message.hidden = false;
  if (!isError) messageTimer = setTimeout(() => { ui.message.hidden = true; }, 6000);
}

function report(error) {
  console.error(error);
  notify(error instanceof ApiError ? error.message : "No se pudo completar la operación. Inténtalo de nuevo.", true);
}

function setBusy(value) {
  busy = value;
  ui.list.setAttribute("aria-busy", String(value));
  [ui.add, ui.refresh, ui.save, ui.cancel,
    ...ui.list.querySelectorAll("button"),
    ...document.querySelectorAll("[data-filter]")].forEach(button => { button.disabled = value; });
  [ui.title, ui.description, ui.editTitle, ui.editDescription].forEach(input => { input.disabled = value; });
}

function validateTitle(input, error) {
  const valid = Boolean(input.value.trim());
  error.textContent = valid ? "" : "El título de la tarea es obligatorio.";
  error.hidden = valid;
  input.setAttribute("aria-invalid", String(!valid));
  if (!valid) input.focus();
  return valid;
}

function formatDate(value) {
  if (typeof value !== "string" || !value.trim()) return "Fecha no disponible";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" :
    "Creada: " + new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function taskCard(task) {
  const card = element("article", "task-card" + (task.completed ? " is-completed" : ""), "");
  card.append(element("h3", "", task.title));
  if (task.description) card.append(element("p", "description", task.description));
  const meta = element("div", "task-meta", "");
  meta.append(element("span", "badge", task.completed ? "● Completada" : "● Pendiente"),
    element("span", "task-date", formatDate(task.created_at)));
  const actions = element("div", "task-actions", "");
  const options = [
    ["toggle", "", task.completed ? "↶ Volver pendiente" : "✓ Completar"],
    ["edit", "edit", "Editar"],
    ["delete", "delete", "Eliminar"]
  ];
  options.forEach(([action, className, label]) => {
    const button = element("button", className, label);
    button.type = "button";
    button.dataset.action = action;
    button.dataset.id = String(task.id);
    button.setAttribute("aria-label", label + ": " + task.title);
    button.disabled = busy;
    actions.append(button);
  });
  card.append(meta, actions);
  return card;
}

function render() {
  const completed = tasks.filter(task => task.completed).length;
  document.querySelector("#total").textContent = loaded ? tasks.length : "—";
  document.querySelector("#pending").textContent = loaded ? tasks.length - completed : "—";
  document.querySelector("#completed").textContent = loaded ? completed : "—";
  const visible = tasks.filter(task => filter === "all" ||
    (filter === "completed" ? task.completed : !task.completed));
  ui.list.replaceChildren(...visible.map(taskCard));
  document.querySelectorAll("[data-filter]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.filter === filter));
  });
  if (loaded) {
    ui.state.hidden = visible.length > 0;
    ui.state.textContent = tasks.length === 0 ?
      "No hay tareas todavía.\n¡Agrega tu primera tarea!" :
      "No hay tareas " + (filter === "completed" ? "completadas" : "pendientes") + ".";
    document.querySelector("#list-summary").textContent =
      tasks.length === 0 ? "Tu próximo paso empieza aquí." : completed + " de " + tasks.length + " tareas completadas.";
  }
}

async function loadTasks() {
  if (busy) return;
  setBusy(true);
  ui.refresh.textContent = "Cargando…";
  if (!loaded) { ui.state.hidden = false; ui.state.textContent = "Cargando tareas…"; }
  try {
    tasks = await getTasks();
    loaded = true;
    ui.message.hidden = true;
    render();
  } catch (error) {
    report(error);
    if (!loaded) ui.state.textContent = "No pudimos cargar tus tareas.\nComprueba el Backend y pulsa Actualizar.";
  } finally {
    setBusy(false);
    ui.refresh.textContent = "↻ Actualizar";
  }
}

// Una sola operación a la vez evita cambios simultáneos sobre una tarea.
async function mutate(button, pendingText, operation, successText, afterSuccess) {
  if (busy) return;
  const originalText = button.textContent;
  setBusy(true);
  button.textContent = pendingText;
  try {
    await operation();
    if (afterSuccess) afterSuccess();
    // Volver a leer permite aceptar respuestas de escritura con objeto, mensaje o cuerpo vacío.
    try {
      tasks = await getTasks();
      loaded = true;
      render();
      notify(successText);
    } catch (error) {
      console.error(error);
      render();
      notify(successText + " No se pudo recargar la lista; pulsa Actualizar para sincronizarla.", true);
    }
  } catch (error) {
    report(error);
  } finally {
    button.textContent = originalText;
    setBusy(false);
  }
}

ui.createForm.addEventListener("submit", event => {
  event.preventDefault();
  if (busy || !validateTitle(ui.title, ui.titleError)) return;
  const task = { title: ui.title.value.trim(), description: ui.description.value.trim() };
  mutate(ui.add, "Agregando…", () => createTask(task), "Tarea creada correctamente.", () => {
    ui.createForm.reset();
  });
});

ui.list.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button || busy) return;
  const task = tasks.find(item => String(item.id) === button.dataset.id);
  if (!task) return;
  if (button.dataset.action === "edit") {
    editingId = task.id;
    ui.editTitle.value = task.title;
    ui.editDescription.value = task.description;
    ui.editError.hidden = true;
    ui.editTitle.removeAttribute("aria-invalid");
    ui.dialog.showModal();
    ui.editTitle.focus();
  } else if (button.dataset.action === "delete") {
    if (!window.confirm("¿Seguro que deseas eliminar esta tarea?")) return;
    mutate(button, "Eliminando…", () => deleteTask(task.id), "Tarea eliminada correctamente.", () => {
      tasks = tasks.filter(item => String(item.id) !== String(task.id));
    });
  } else {
    const completed = !task.completed;
    mutate(button, "Guardando…", () => updateTask(task.id, { completed }),
      completed ? "¡Tarea completada!" : "Tarea marcada como pendiente.", () => {
        task.completed = completed;
        render();
      });
  }
});

ui.editForm.addEventListener("submit", event => {
  event.preventDefault();
  if (busy || !validateTitle(ui.editTitle, ui.editError)) return;
  const task = tasks.find(item => String(item.id) === String(editingId));
  if (!task) return;
  const changes = { title: ui.editTitle.value.trim(), description: ui.editDescription.value.trim(), completed: task.completed };
  mutate(ui.save, "Guardando…", () => updateTask(task.id, changes), "Cambios guardados correctamente.", () => {
    Object.assign(task, changes);
    ui.dialog.close();
    editingId = null;
    render();
  });
});

ui.cancel.addEventListener("click", () => { if (!busy) ui.dialog.close(); });
ui.dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
ui.dialog.addEventListener("close", () => { editingId = null; });
ui.refresh.addEventListener("click", loadTasks);
document.querySelectorAll("[data-filter]").forEach(button => {
  button.addEventListener("click", () => {
    if (busy) return;
    filter = button.dataset.filter;
    render();
  });
});
[[ui.title, ui.titleError], [ui.editTitle, ui.editError]].forEach(([input, error]) => {
  input.addEventListener("input", () => {
    if (input.value.trim()) {
      error.hidden = true;
      input.removeAttribute("aria-invalid");
    }
  });
});

loadTasks();
