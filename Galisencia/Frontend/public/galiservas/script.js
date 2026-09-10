// =====================================================================
// Galiservas — reservas de aulas y recursos (backend PHP + stock real)
// =====================================================================

// Los horarios disponibles los devuelve la API (reservas.php?recursoId&fecha).
const WEEKDAYS_START_MONDAY = true;

const SESSION_KEY = "galisencia.session";
const API_BASE = window.GALISERVAS_API_BASE || "/api";
const ROL_LABELS = { preceptor: "Preceptor", admin: "Administrador", docente: "Docente", alumno: "Alumno", directivo: "Directivo" };

// Roles habilitados para Galiservas. Docente ya se normaliza a "preceptor".
const ALLOWED_ROLES = ["preceptor", "admin"];

const state = {
  sessionUser: null,
  canBook: false,
  recursos: [],
  categorias: [],
  categoriaActual: "",
  recurso: null,            // { id, nombre, tipo, categoria, stock }
  fecha: null,              // ISO YYYY-MM-DD
  horario: null,
  disponibilidad: [],       // [{ horario, reservado, disponible }]
  reservando: false,
};

const today = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
let viewYear = today.getFullYear();
let viewMonth = today.getMonth();

const MONTH_NAMES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

// ---------- helpers ----------
function $(id) { return document.getElementById(id); }

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getSessionUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.usuario ? data.usuario : null;
  } catch { return null; }
}

function showToast(msg) {
  const toast = $("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

async function api(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    ...opts,
  });
  let data = null;
  try { data = await res.json(); } catch { /* sin JSON */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ---------- sesión SSO ----------
function renderSession() {
  const chip = $("session-chip");
  const btn = $("logout-btn");
  const denied = $("access-denied");
  const content = $("app-content");

  state.sessionUser = getSessionUser();
  state.canBook = !!state.sessionUser && ALLOWED_ROLES.includes(state.sessionUser.rol);

  if (!state.canBook) {
    chip.textContent = state.sessionUser
      ? `🔐 ${state.sessionUser.nombre} · ${ROL_LABELS[state.sessionUser.rol] || state.sessionUser.rol}`
      : "🔐 No hay sesión activa";
    denied.hidden = false;
    content.hidden = true;
    return;
  }

  chip.textContent = `🔐 ${state.sessionUser.nombre} · ${ROL_LABELS[state.sessionUser.rol] || state.sessionUser.rol}`;
  chip.classList.add("chip-ok");
  btn.hidden = false;
  denied.hidden = true;
  content.hidden = false;
}

async function logout() {
  try { await api("/logout.php", { method: "POST" }); } catch { /* best effort */ }
  localStorage.removeItem(SESSION_KEY);
  window.location.href = "/";
}

// ---------- recursos ----------
async function loadRecursos() {
  const data = await api("/recursos.php");
  state.recursos = data.recursos || [];
  state.categorias = data.categorias || [];
  renderRooms();
  renderCats();
  renderPanel();
}

function renderRooms() {
  const grid = $("room-grid");
  grid.innerHTML = "";
  state.recursos
    .filter((r) => r.tipo === "aula")
    .forEach((r) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "room-card" + (state.recurso && state.recurso.id === r.id ? " on" : "");
      card.innerHTML = `
        <span class="room-card__nombre">${r.nombre}</span>
        <span class="room-card__cap">${r.stock} computadoras</span>
      `;
      card.addEventListener("click", () => selectRecurso(r));
      grid.appendChild(card);
    });
}

function renderCats() {
  const pills = $("cat-pills");
  pills.innerHTML = "";
  const categorias = ["", ...state.categorias.map((c) => c.nombre)];
  categorias.forEach((cat) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = (state.categoriaActual === cat ? "on" : "");
    b.textContent = cat || "Todo el pañol";
    b.addEventListener("click", () => {
      state.categoriaActual = cat;
      renderCats();
      renderPanel();
    });
    pills.appendChild(b);
  });
}

function renderPanel() {
  const list = $("panel-list");
  list.innerHTML = "";
  const items = state.recursos.filter((r) =>
    r.tipo === "pañol" && (!state.categoriaActual || r.categoria === state.categoriaActual)
  );
  if (items.length === 0) {
    list.innerHTML = '<div class="hint">No hay recursos en esta categoría.</div>';
    return;
  }
  items.forEach((r) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "panel-item" + (state.recurso && state.recurso.id === r.id ? " on" : "");
    card.innerHTML = `
      <span class="panel-item__nombre">${r.nombre}</span>
      <span class="panel-item__cat">${r.categoria || "Pañol"}</span>
      <span class="panel-item__stock">Stock: ${r.stock}</span>
    `;
    card.addEventListener("click", () => selectRecurso(r));
    list.appendChild(card);
  });
}

// ---------- selección de recurso ----------
function selectRecurso(r) {
  state.recurso = r;
  state.horario = null;
  state.disponibilidad = [];
  renderRooms();
  renderPanel();
  if (state.fecha) fetchDisponibilidad();
  else renderSlots();
  updateQuantityRow();
  updateConfirmBar();
}

// ---------- disponibilidad (por franja) ----------
async function fetchDisponibilidad() {
  if (!state.recurso || !state.fecha) return;
  const data = await api(`/reservas.php?recursoId=${state.recurso.id}&fecha=${state.fecha}`);
  if (state.recurso && state.fecha) {
    state.disponibilidad = data.disponibilidad || [];
    renderSlots();
    updateQuantityRow();
    updateConfirmBar();
  }
}

function maxDisponibleParaHorario() {
  if (!state.disponibilidad.length || !state.horario) return 0;
  const it = state.disponibilidad.find((d) => d.horario === state.horario);
  return it ? Math.min(state.recurso.stock, it.disponible) : 0;
}

// ---------- calendario ----------
function renderCalendar() {
  $("cal-month-label").textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;
  const container = $("cal-days");
  container.innerHTML = "";

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  let startWeekday = firstOfMonth.getDay();
  if (WEEKDAYS_START_MONDAY) startWeekday = (startWeekday + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  for (let i = 0; i < startWeekday; i++) {
    const empty = document.createElement("div");
    empty.className = "cal-day empty";
    container.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cellDate = new Date(viewYear, viewMonth, day);
    cellDate.setHours(0, 0, 0, 0);
    const iso = isoDate(cellDate);

    const cell = document.createElement("div");
    cell.className = "cal-day";
    cell.textContent = day;
    if (cellDate.getTime() === today.getTime()) cell.classList.add("today");

    if (cellDate < today) {
      cell.classList.add("past");
    } else {
      cell.addEventListener("click", () => {
        document.querySelectorAll(".cal-day").forEach((c) => c.classList.remove("selected"));
        cell.classList.add("selected");
        state.fecha = iso;
        state.horario = null;
        if (state.recurso) fetchDisponibilidad();
        else renderSlots();
        updateQuantityRow();
        updateConfirmBar();
      });
    }
    if (iso === state.fecha) cell.classList.add("selected");
    container.appendChild(cell);
  }
}

function changeMonth(delta) {
  viewMonth += delta;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  renderCalendar();
}

// ---------- franjas ----------
function renderSlots() {
  const list = $("slot-list");
  list.innerHTML = "";

  if (!state.recurso || !state.fecha) {
    const msg = document.createElement("div");
    msg.className = "hint";
    msg.style.marginTop = "0";
    msg.textContent = state.recurso
      ? "Elegí una fecha para ver la disponibilidad."
      : "Elegí primero un aula o un recurso.";
    list.appendChild(msg);
    return;
  }

  if (!state.disponibilidad.length) {
    const msg = document.createElement("div");
    msg.className = "hint";
    msg.style.marginTop = "0";
    msg.textContent = "Consultando disponibilidad…";
    list.appendChild(msg);
    return;
  }

  state.disponibilidad.forEach((d) => {
    const libre = d.disponible > 0;
    const row = document.createElement("div");
    row.className = "slot " + (libre ? "free" : "occupied") + (d.horario === state.horario ? " selected" : "");

    const time = document.createElement("span");
    time.className = "time";
    time.textContent = d.horario;

    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = libre ? `${d.disponible} libre${d.disponible !== 1 ? "s" : ""}` : "Sin stock";

    row.appendChild(time);
    row.appendChild(tag);

    if (libre && state.canBook && state.recurso && d.horario) {
      row.addEventListener("click", () => {
        state.horario = (state.horario === d.horario) ? null : d.horario;
        renderSlots();
        updateQuantityRow();
        updateConfirmBar();
      });
    }
    list.appendChild(row);
  });
}

// ---------- cantidad ----------
function updateQuantityRow() {
  const row = $("quantity-row");
  const input = $("quantity");
  const maxLabel = $("quantity-max");
  const max = maxDisponibleParaHorario();

  if (!state.recurso || !state.fecha || !state.horario || max <= 0) {
    row.hidden = true;
    return;
  }
  row.hidden = false;
  input.max = String(max);
  if (!input.value || Number(input.value) > max) input.value = String(max);
  if (Number(input.value) < 1) input.value = "1";
  maxLabel.textContent = `de ${max} disponible${max !== 1 ? "s" : ""}`;
}

// ---------- barra de confirmación ----------
function updateConfirmBar() {
  const summary = $("confirm-summary");
  const btn = $("confirm-btn");

  if (!state.canBook) {
    summary.textContent = "Tu rol no tiene acceso a reservas. Iniciá sesión con una cuenta de Preceptor, Docente o Administrador.";
    btn.disabled = true;
    return;
  }
  if (state.recurso && state.fecha && state.horario && maxDisponibleParaHorario() > 0) {
    const [y, m, d] = state.fecha.split("-");
    summary.innerHTML = `<b>${state.recurso.nombre}</b> · ${d}/${m}/${y} · <b>${state.horario}</b> · ${$("quantity").value} unidad(es)`;
    btn.disabled = state.reservando;
  } else {
    const parts = [];
    if (!state.recurso) parts.push("un recurso");
    if (!state.fecha) parts.push("una fecha");
    if (!state.horario) parts.push("una franja");
    summary.textContent = `Falta elegir: ${parts.join(", ")}.`;
    btn.disabled = true;
  }
}

// ---------- confirmar reserva ----------
async function confirmBooking() {
  const errorEl = $("reserve-error");
  errorEl.hidden = true;

  if (!state.canBook) {
    showToast("No tenés permisos para reservar.");
    return;
  }
  if (!state.recurso || !state.fecha || !state.horario) return;

  const cantidad = Number($("quantity").value) || 1;
  const max = maxDisponibleParaHorario();
  if (cantidad < 1 || cantidad > max) {
    errorEl.textContent = `Elegí una cantidad entre 1 y ${max}.`;
    errorEl.hidden = false;
    updateConfirmBar();
    return;
  }

  state.reservando = true;
  updateConfirmBar();
  try {
    await api("/reservas.php", {
      method: "POST",
      body: JSON.stringify({
        recursoId: state.recurso.id,
        fecha: state.fecha,
        horario: state.horario,
        cantidad,
      }),
    });
    showToast(`Reserva confirmada: ${state.recurso.nombre} ✓`);
    state.horario = null;
    await fetchDisponibilidad();
    await loadMisReservas();
  } catch (err) {
    errorEl.textContent =
      err instanceof Error && err.message
        ? err.message
        : "No se pudo confirmar la reserva.";
    errorEl.hidden = false;
    await fetchDisponibilidad().catch(() => {});
  } finally {
    state.reservando = false;
    updateQuantityRow();
    updateConfirmBar();
  }
}

// ---------- mis reservas ----------
async function loadMisReservas() {
  try {
    const data = await api("/reservas.php");
    const reservas = (data.reservas || []).filter((r) => r.usuario === state.sessionUser.email);
    const wrap = $("mis-reservas");
    const list = $("my-reservas-list");
    if (reservas.length === 0) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    list.innerHTML = "";
    reservas.forEach((r) => {
      const [y, m, d] = r.fecha.split("-");
      const item = document.createElement("div");
      item.className = "my-reserva";
      item.innerHTML = `<b>${r.recurso}</b> · ${d}/${m}/${y} · ${r.horario} · ${r.cantidad} unidad(es)`;
      list.appendChild(item);
    });
  } catch { /* sin backend: oculto */ }
}

// ---------- init ----------
document.addEventListener("DOMContentLoaded", () => {
  $("prev-month").addEventListener("click", () => changeMonth(-1));
  $("next-month").addEventListener("click", () => changeMonth(1));
  $("logout-btn").addEventListener("click", logout);
  $("quantity").addEventListener("input", updateConfirmBar);
  $("confirm-btn").addEventListener("click", confirmBooking);

  renderSession();
  if (!state.canBook) return;

  renderCalendar();
  loadRecursos()
    .then(loadMisReservas)
    .catch((err) => {
      showToast(err instanceof Error ? err.message : "No se pudieron cargar los recursos.");
      if (typeof err === "object" && err && err.status === 403) {
        $("access-denied").hidden = false;
        $("app-content").hidden = true;
      }
    });
});