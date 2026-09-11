import assert from "node:assert/strict";

const API = process.env.API_URL ?? "http://localhost:3000/api";

class PhpSession {
  cookie = "";

  async request(path, init = {}) {
    const headers = new Headers(init.headers);
    if (this.cookie) headers.set("Cookie", this.cookie);

    const response = await fetch(`${API}${path}`, {
      ...init,
      headers,
      redirect: "manual",
    });

    const setCookies = typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
    for (const value of setCookies) {
      const match = /^PHPSESSID=([^;]*)/i.exec(value);
      if (match) this.cookie = match[1] ? `PHPSESSID=${match[1]}` : "";
    }

    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        assert.fail(`${init.method ?? "GET"} ${path}: respuesta no JSON (${response.status}): ${text}`);
      }
    }
    return { status: response.status, body, headers: response.headers };
  }

  json(path, method, body) {
    return this.request(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  login(email) {
    return this.json("/login.php", "POST", { email, password: "demo1234" });
  }
}

function expectStatus(result, status, label) {
  assert.equal(result.status, status, `${label}: esperado HTTP ${status}, recibido ${result.status}: ${JSON.stringify(result.body)}`);
}

async function login(email, role) {
  const session = new PhpSession();
  const result = await session.login(email);
  expectStatus(result, 200, `login ${email}`);
  assert.equal(result.body?.usuario?.rol, role);
  assert.match(session.cookie, /^PHPSESSID=/);
  return session;
}

async function main() {
  console.log(`Probando API en ${API}`);

  const anonymous = new PhpSession();
  for (const endpoint of ["alumnos", "cursos", "asistencias", "notas", "reportes", "usuarios", "auditoria", "recursos", "reservas"]) {
    const result = await anonymous.request(`/${endpoint}.php`);
    expectStatus(result, 401, `${endpoint} sin sesion`);
  }

  const [admin, preceptor, directivo, alumno] = await Promise.all([
    login("admin@galileo.edu.ar", "admin"),
    login("preceptor@galileo.edu.ar", "preceptor"),
    login("directivo@galileo.edu.ar", "directivo"),
    login("alumno@galileo.edu.ar", "alumno"),
  ]);

  // ---- Alcance del preceptor (seed: Carlos Ramirez a cargo de 1A, 2A y 3A) ----
  const cursosPreceptor = await preceptor.request("/cursos.php");
  expectStatus(cursosPreceptor, 200, "cursos del preceptor");
  assert.deepEqual(cursosPreceptor.body.cursos.map((curso) => Number(curso.id)).sort(), [1, 3, 5]);

  const alumnosPreceptor = await preceptor.request("/alumnos.php");
  expectStatus(alumnosPreceptor, 200, "alumnos del preceptor");
  assert.equal(alumnosPreceptor.body.alumnos.length, 12);
  assert.ok(alumnosPreceptor.body.alumnos.every((item) => [1, 3, 5].includes(Number(item.cursoId))));

  // El GET de asistencias filtra por alcance: un alumno ajeno devuelve lista vacia (no datos).
  const asistenciasAjenas = await preceptor.request("/asistencias.php?alumnoId=5");
  expectStatus(asistenciasAjenas, 200, "preceptor consulta asistencia ajena (filtrada)");
  assert.equal(asistenciasAjenas.body.registros.length, 0);

  expectStatus(
    await preceptor.json("/asistencias.php", "POST", {
      alumnoId: 5,
      materia: "Matematica",
      fecha: "2026-06-09",
      estado: "presente",
    }),
    403,
    "preceptor registra asistencia ajena"
  );
  expectStatus(
    await preceptor.json("/alumnos.php", "POST", {
      nombre: "Prueba",
      apellido: "Bloqueada",
      curso: "1 B",
      email: "prueba.bloqueada@example.invalid",
    }),
    403,
    "preceptor crea alumno en curso ajeno"
  );
  expectStatus(
    await preceptor.request("/alumnos.php?id=5", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "demo1234" }),
    }),
    403,
    "preceptor elimina alumno ajeno"
  );

  const reportePreceptor = await preceptor.request("/reportes.php");
  expectStatus(reportePreceptor, 200, "reporte del preceptor");
  assert.equal(reportePreceptor.body.resumen.totalAlumnos, 12);

  const asistenciaPropia = await alumno.request("/asistencias.php?alumnoId=1");
  expectStatus(asistenciaPropia, 200, "alumno consulta asistencia propia");
  assert.equal(asistenciaPropia.body.registros.length, 4);
  // El alcance del alumno filtra por email: consultar a otro alumno no filtra datos ajenos.
  expectStatus(await alumno.request("/asistencias.php?alumnoId=2"), 200, "alumno consulta asistencia ajena (filtrada)");
  const notasAjenas = await alumno.request("/notas.php?alumnoId=2");
  expectStatus(notasAjenas, 200, "alumno consulta nota ajena (filtrada)");
  assert.equal(notasAjenas.body.notas.length, 0);
  expectStatus(await alumno.request("/auditoria.php"), 403, "alumno consulta auditoria");

  const reporteDirectivo = await directivo.request("/reportes.php");
  expectStatus(reporteDirectivo, 200, "reporte del directivo");
  assert.equal(reporteDirectivo.body.resumen.totalAlumnos, 35);

  const usuarios = await admin.request("/usuarios.php");
  expectStatus(usuarios, 200, "admin lista usuarios");
  assert.ok(usuarios.body.usuarios.some((usuario) => Number(usuario.id) === 3 && usuario.rol === "Preceptor"));
  assert.ok(Array.isArray(usuarios.body.roles));

  // ---- Asignacion de preceptores (cursos.php PUT + auditoria) ----
  const cursosAdmin = await admin.request("/cursos.php");
  expectStatus(cursosAdmin, 200, "admin lista cursos");
  const cursoDos = cursosAdmin.body.cursos.find((curso) => Number(curso.id) === 2);
  assert.ok(cursoDos, "No se encontro el curso 2 del seed");
  const preceptorAnterior = cursoDos.preceptorId ?? null;
  let asignacionCambiada = false;

  try {
    expectStatus(
      await admin.json("/cursos.php", "PUT", { id: 2, preceptorId: 5 }),
      400,
      "admin intenta asignar usuario no preceptor"
    );

    const asignacion = await admin.json("/cursos.php", "PUT", { id: 2, preceptorId: 3 });
    expectStatus(asignacion, 200, "admin asigna preceptor");
    asignacionCambiada = true;
    assert.equal(Number(asignacion.body.curso.preceptorId), 3);

    const cursosAmpliados = await preceptor.request("/cursos.php");
    assert.deepEqual(cursosAmpliados.body.cursos.map((curso) => Number(curso.id)).sort(), [1, 2, 3, 5]);

    const reporteAmpliado = await preceptor.request("/reportes.php");
    expectStatus(reporteAmpliado, 200, "reporte scoped tras asignacion");
    assert.equal(reporteAmpliado.body.resumen.totalAlumnos, 16);

    const auditoria = await admin.request("/auditoria.php?accion=cursos.asignar&entidad=curso&limit=10");
    expectStatus(auditoria, 200, "admin consulta auditoria");
    assert.ok(
      auditoria.body.registros.some((registro) => registro.entidadId === "2" && Number(registro.detalle?.despues?.preceptor_id) === 3),
      "No se encontro la auditoria de asignacion del curso 2"
    );
    expectStatus(await preceptor.request("/auditoria.php"), 403, "preceptor consulta auditoria");
  } finally {
    if (asignacionCambiada) {
      const restauracion = await admin.json("/cursos.php", "PUT", { id: 2, preceptorId: preceptorAnterior });
      expectStatus(restauracion, 200, "restauracion de asignacion");
    }
  }

  // ---- Filtros por ciclo y materia en asistencias / reportes ----
  const asistenciasCiclo = await preceptor.request("/asistencias.php?ciclo=2026");
  expectStatus(asistenciasCiclo, 200, "asistencias filtradas por ciclo");
  assert.equal(asistenciasCiclo.body.registros.length, 48);
  assert.ok(asistenciasCiclo.body.registros.every((r) => String(r.fecha).startsWith("2026-")));

  const reporteMateria = await preceptor.request("/reportes.php?materia=Matematica");
  expectStatus(reporteMateria, 200, "reporte filtrado por materia");
  assert.equal(reporteMateria.body.resumen.totalAlumnos, 12);

  // ---- Galiservas: acceso por rol y reservas con stock ----
  const fechaReserva = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  expectStatus(await alumno.request("/recursos.php"), 403, "alumno lista recursos");
  expectStatus(await directivo.request("/recursos.php"), 403, "directivo lista recursos");
  expectStatus(await alumno.request("/reservas.php"), 403, "alumno consulta reservas");

  const recursos = await preceptor.request("/recursos.php");
  expectStatus(recursos, 200, "preceptor lista recursos");
  const aula208 = recursos.body.recursos.find((r) => r.name === "Aula 208");
  assert.ok(aula208, "No se encontro el Aula 208");
  assert.equal(aula208.type, "desktop_pc");
  assert.equal(aula208.category, "hardware_pc");
  assert.ok(Number(aula208.capacity) >= 5, "El stock del Aula 208 debe ser al menos 5");
  assert.ok(Number(aula208.available) >= 5, "El Aula 208 debe estar disponible");

  const recursosStend = recursos.body.recursos.some((r) => r.category === "audiovisual" && String(r.location ?? "").toLowerCase() === "pañol");
  assert.ok(recursosStend, "Debe existir stock del pañol audiovisual");

  // Disponibilidad segun la UI (recursos.php con franja): arranca con el stock completo.
  const antesFranja = await preceptor.request(`/recursos.php?fecha=${fechaReserva}&hora_inicio=08:00&hora_fin=09:00`);
  expectStatus(antesFranja, 200, "disponibilidad por franja inicial");
  const aula208Antes = antesFranja.body.recursos.find((r) => r.name === "Aula 208");
  assert.equal(Number(aula208Antes.available), 5);

  const listadoPrevio = await preceptor.request("/reservas.php");
  expectStatus(listadoPrevio, 200, "listado de reservas previo");
  assert.ok(Array.isArray(listadoPrevio.body.reservas));

  expectStatus(
    await alumno.json("/reservas.php", "POST", {
      resourceId: aula208.id, date: fechaReserva, startTime: "08:00", endTime: "09:00", quantity: 1, reason: "no deberia",
    }),
    403,
    "alumno crea reserva"
  );

  const reservaOk = await preceptor.json("/reservas.php", "POST", {
    resourceId: aula208.id, date: fechaReserva, startTime: "08:00", endTime: "09:00", quantity: 5, reason: "test integracion",
  });
  expectStatus(reservaOk, 201, "preceptor reserva 5 computadoras");
  assert.equal(reservaOk.body.reserva.status, "confirmada");

  expectStatus(
    await preceptor.json("/reservas.php", "POST", {
      resourceId: aula208.id, date: fechaReserva, startTime: "08:00", endTime: "09:00", quantity: 5, reason: "superpuesta",
    }),
    409,
    "reserva que supera el stock disponible (5 ya reservadas)"
  );
  expectStatus(
    await preceptor.json("/reservas.php", "POST", {
      resourceId: aula208.id, date: fechaReserva, startTime: "08:00", endTime: "09:00", quantity: 30, reason: "overflow",
    }),
    409,
    "reserva que supera la capacidad del recurso"
  );
  expectStatus(
    await preceptor.json("/reservas.php", "POST", {
      resourceId: aula208.id, date: fechaReserva, startTime: "08:00", endTime: "09:00", quantity: 0, reason: "cero",
    }),
    400,
    "reserva con cantidad cero"
  );
  expectStatus(
    await preceptor.json("/reservas.php", "POST", {
      resourceId: aula208.id, date: fechaReserva, startTime: "99:99", endTime: "100:00", quantity: 1, reason: "horario",
    }),
    400,
    "reserva con horario invalido"
  );

  // Tras reservar el stock completo, la franja queda sin disponibilidad.
  const despuesFranja = await preceptor.request(`/recursos.php?fecha=${fechaReserva}&hora_inicio=08:00&hora_fin=09:00`);
  expectStatus(despuesFranja, 200, "disponibilidad por franja tras reservar");
  const aula208Despues = despuesFranja.body.recursos.find((r) => r.name === "Aula 208");
  assert.equal(Number(aula208Despues.available), 0);

  const listadoReservas = await preceptor.request("/reservas.php");
  expectStatus(listadoReservas, 200, "listado de reservas");
  assert.ok(
    listadoReservas.body.reservas.some((r) => r.recurso_nombre === "Aula 208" && Number(r.cantidad) === 5),
    "No se encontro la reserva recien creada en el listado"
  );

  const auditoriaReservas = await admin.request("/auditoria.php?accion=reservas.crear&limit=10");
  expectStatus(auditoriaReservas, 200, "auditoria de reservas");
  assert.ok(
    auditoriaReservas.body.registros.some(
      (registro) => registro.accion === "reservas.crear" && Number(registro.detalle?.resourceId) === Number(aula208.id) && registro.detalle?.date === fechaReserva
    ),
    "No se registró la creación de la reserva en la auditoría"
  );

  // ---- Re-autenticación del preceptor en acciones sensibles (alumnos) ----
  expectStatus(
    await preceptor.json("/alumnos.php", "PUT", {
      id: 1, nombre: "Sofia", apellido: "Gutierrez", curso: "3 A", email: "alumno@galileo.edu.ar",
    }),
    400,
    "preceptor cambia de curso sin reingresar la contraseña"
  );
  expectStatus(
    await preceptor.json("/alumnos.php", "PUT", {
      id: 1, nombre: "Sofia", apellido: "Gutierrez", curso: "3 A", email: "alumno@galileo.edu.ar",
      currentPassword: "incorrecta",
    }),
    401,
    "preceptor cambia de curso con contraseña incorrecta"
  );
  expectStatus(
    await preceptor.request("/alumnos.php?id=1", { method: "DELETE" }),
    400,
    "preceptor da de baja sin reingresar contraseña"
  );

  const alumnoTmp = await preceptor.json("/alumnos.php", "POST", {
    nombre: "Temporal", apellido: "Reauth", curso: "1 A", dni: "99999999",
  });
  expectStatus(alumnoTmp, 200, "preceptor crea alumno temporal");
  const idTmp = Number(alumnoTmp.body.alumno.id);

  expectStatus(
    await preceptor.json("/alumnos.php", "PUT", {
      id: idTmp, nombre: "Temporal", apellido: "Reauth2", curso: "3 A",
      currentPassword: "demo1234",
    }),
    200,
    "preceptor cambia de curso con contraseña correcta"
  );

  const bajaTmp = await preceptor.request(`/alumnos.php?id=${idTmp}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword: "demo1234" }),
  });
  expectStatus(bajaTmp, 200, "preceptor da de baja con contraseña correcta");

  expectStatus(await admin.request("/logout.php", { method: "POST" }), 200, "logout del admin");
  expectStatus(await admin.request("/usuarios.php"), 401, "sesion destruida tras logout");

  console.log("OK: autenticacion, RBAC, alcance por curso, auditoria, reservas con stock y re-autenticacion verificados.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});