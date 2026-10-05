import assert from "node:assert/strict";

const API = process.env.API_URL ?? "http://localhost:3000/api";
const PASSWORD_DEMO = "demo1234";
// Las cuentas demo deben cambiar demo1234 en el primer ingreso: los tests usan esta.
const PASSWORD_PRUEBA = process.env.TEST_PASSWORD ?? "Integracion-2026!";

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

    if (response.headers.get("content-type")?.startsWith("image/")) {
      return { status: response.status, body: Buffer.from(await response.arrayBuffer()), headers: response.headers };
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

  login(email, password = PASSWORD_DEMO) {
    return this.json("/login.php", "POST", { email, password });
  }
}

function expectStatus(result, status, label) {
  assert.equal(result.status, status, `${label}: esperado HTTP ${status}, recibido ${result.status}: ${JSON.stringify(result.body)}`);
}

// Inicia sesion y, si la cuenta todavia tiene la contrasena demo marcada,
// la cambia por PASSWORD_PRUEBA. session.password guarda la contrasena vigente.
async function login(email, role) {
  let session = new PhpSession();
  let password = PASSWORD_DEMO;
  let result = await session.login(email, password);
  if (result.status === 401) {
    session = new PhpSession();
    password = PASSWORD_PRUEBA;
    result = await session.login(email, password);
  }
  expectStatus(result, 200, `login ${email}`);
  assert.equal(result.body?.usuario?.rol, role);
  assert.match(session.cookie, /^PHPSESSID=/);
  if (result.body.usuario.debeCambiarPassword) {
    expectStatus(
      await session.json("/cambiar_password.php", "POST", { actual: password, nueva: PASSWORD_PRUEBA }),
      200,
      `cambio de contraseña inicial de ${email}`
    );
    password = PASSWORD_PRUEBA;
  }
  session.password = password;
  return session;
}

async function main() {
  console.log(`Probando API en ${API}`);

  const anonymous = new PhpSession();
  for (const endpoint of ["alumnos", "cursos", "asistencias", "notas", "reportes", "usuarios", "auditoria", "recursos", "reservas", "horarios"]) {
    const result = await anonymous.request(`/${endpoint}.php`);
    expectStatus(result, 401, `${endpoint} sin sesion`);
  }

  // ---- Cambio obligatorio de contraseña (cuentas demo; requiere base recién creada) ----
  const docente = new PhpSession();
  const loginDocente = await docente.login("docente@galileo.edu.ar");
  expectStatus(loginDocente, 200, "login del docente con la contraseña demo");
  assert.equal(loginDocente.body.usuario.debeCambiarPassword, true, "las cuentas demo arrancan marcadas");
  const docenteBloqueado = await docente.request("/cursos.php");
  expectStatus(docenteBloqueado, 403, "cuenta marcada no puede operar");
  assert.equal(docenteBloqueado.body.codigo, "debe_cambiar_password");
  expectStatus(await docente.request("/sesion.php"), 200, "cuenta marcada consulta su sesion");
  expectStatus(await docente.json("/cambiar_password.php", "POST", { actual: PASSWORD_DEMO, nueva: PASSWORD_DEMO }), 400, "demo1234 no sirve como contraseña nueva");
  expectStatus(await docente.json("/cambiar_password.php", "POST", { actual: PASSWORD_DEMO, nueva: "corta" }), 400, "contraseña nueva demasiado corta");
  expectStatus(await docente.json("/cambiar_password.php", "POST", { actual: "incorrecta", nueva: PASSWORD_PRUEBA }), 401, "cambio con la contraseña actual incorrecta");
  expectStatus(await docente.json("/cambiar_password.php", "POST", { actual: PASSWORD_DEMO, nueva: PASSWORD_PRUEBA }), 200, "cambio de la contraseña inicial");
  const sesionDocente = await docente.request("/sesion.php");
  expectStatus(sesionDocente, 200, "sesion del docente tras el cambio");
  assert.equal(sesionDocente.body.usuario.debeCambiarPassword, false);
  assert.notEqual((await docente.request("/cursos.php")).body?.codigo, "debe_cambiar_password", "tras el cambio ya puede operar");
  expectStatus(await new PhpSession().login("docente@galileo.edu.ar", PASSWORD_DEMO), 401, "la contraseña demo ya no sirve");

  const [admin, academica, preceptor, directivo, alumno] = await Promise.all([
    login("admin@galileo.edu.ar", "admin"),
    login("academica@galileo.edu.ar", "admin"),
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
      body: JSON.stringify({ currentPassword: preceptor.password }),
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

  // ---- Horarios por curso: alcance, carga, imagen y eliminacion ----
  const horarioAlumno = await alumno.request("/horarios.php");
  expectStatus(horarioAlumno, 200, "alumno consulta horario");
  assert.deepEqual(horarioAlumno.body.cursos.map((curso) => Number(curso.id)), [1]);
  expectStatus(await alumno.request("/horarios.php?imagen=1&cursoId=2"), 403, "alumno consulta horario ajeno");
  expectStatus(await directivo.request("/horarios.php"), 403, "directivo consulta horarios sin permiso");
  expectStatus(await preceptor.request("/horarios.php"), 403, "preceptor consulta horarios sin permiso");

  const horarioPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const form = new FormData();
  form.append("cursoId", "10");
  form.append("imagen", new Blob([horarioPng], { type: "image/png" }), "horario-6a.png");
  expectStatus(await academica.request("/horarios.php", { method: "POST", body: form }), 201, "administradora academica publica horario");

  const horariosAdmin = await admin.request("/horarios.php?cursoId=10");
  expectStatus(horariosAdmin, 200, "admin consulta horario publicado");
  assert.equal(horariosAdmin.body.cursos[0].nombreArchivo, "horario-6a.png");
  const imagenHorario = await admin.request("/horarios.php?imagen=1&cursoId=10");
  expectStatus(imagenHorario, 200, "admin obtiene imagen de horario");
  assert.equal(imagenHorario.headers.get("content-type"), "image/png");
  assert.ok(Buffer.isBuffer(imagenHorario.body) && imagenHorario.body.length > 0);
  expectStatus(await admin.json("/horarios.php", "DELETE", { cursoId: 10 }), 200, "admin elimina horario");

  const reporteDirectivo = await directivo.request("/reportes.php");
  expectStatus(reporteDirectivo, 200, "reporte del directivo");
  assert.equal(reporteDirectivo.body.resumen.totalAlumnos, 35);

  const usuarios = await admin.request("/usuarios.php");
  expectStatus(usuarios, 200, "admin lista usuarios");
  assert.ok(usuarios.body.usuarios.some((usuario) => Number(usuario.id) === 3 && usuario.rol === "Preceptor"));
  assert.ok(Array.isArray(usuarios.body.roles));

  // ---- El rol se lee de la base en cada request (no de la sesion) ----
  const rolId = (nombre) => Number(usuarios.body.roles.find((rol) => rol.nombre === nombre)?.id);
  const emailRol = `cambio.rol.${Date.now()}@example.invalid`;
  const nuevoAdmin = await admin.json("/usuarios.php", "POST", {
    nombre: "Cambio", apellido: "De Rol", email: emailRol, password: "demo1234", rolId: rolId("Administrador"),
  });
  expectStatus(nuevoAdmin, 201, "admin crea usuario Administrador temporal");
  const sesionCambioRol = await login(emailRol, "admin");
  const asistenciasComoAdmin = await sesionCambioRol.request("/asistencias.php");
  expectStatus(asistenciasComoAdmin, 200, "administrador temporal lista asistencias");
  assert.ok(asistenciasComoAdmin.body.registros.length > 0);
  expectStatus(
    await admin.json("/usuarios.php", "PUT", { id: nuevoAdmin.body.usuario.id, rolId: rolId("Alumno") }),
    200,
    "admin pasa al administrador temporal a Alumno"
  );
  const asistenciasComoAlumno = await sesionCambioRol.request("/asistencias.php");
  expectStatus(asistenciasComoAlumno, 200, "ex administrador lista asistencias con la misma sesion");
  assert.equal(asistenciasComoAlumno.body.registros.length, 0, "con rol Alumno solo ve su propia asistencia");
  expectStatus(await sesionCambioRol.request("/usuarios.php"), 403, "ex administrador lista usuarios");
  const sesionRefrescada = await sesionCambioRol.request("/sesion.php");
  expectStatus(sesionRefrescada, 200, "sesion del ex administrador");
  assert.equal(sesionRefrescada.body.usuario.rol, "Alumno");

  // ---- Limite de intentos de login y tiempos parejos ----
  const crearUsuario = async (prefijo, rol) => {
    const email = `${prefijo}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.invalid`;
    const creado = await admin.json("/usuarios.php", "POST", { nombre: "Temporal", apellido: prefijo, email, password: "demo1234", rolId: rolId(rol) });
    expectStatus(creado, 201, `admin crea usuario ${prefijo}`);
    return { email, id: Number(creado.body.usuario.id) };
  };
  const intentoLogin = async (email, password) => {
    const inicio = performance.now();
    const result = await new PhpSession().json("/login.php", "POST", { email, password });
    return { result, ms: performance.now() - inicio };
  };
  const mediana = (valores) => [...valores].sort((a, b) => a - b)[Math.floor(valores.length / 2)];

  const usuarioTiempos = await crearUsuario("tiempos", "Alumno");
  const tiemposMala = [];
  const tiemposInexistente = [];
  for (let i = 0; i < 3; i++) {
    const mala = await intentoLogin(usuarioTiempos.email, "incorrecta");
    expectStatus(mala.result, 401, "login con contraseña incorrecta");
    tiemposMala.push(mala.ms);
    const inexistente = await intentoLogin(`no.existe.${Date.now()}.${i}@example.invalid`, "incorrecta");
    expectStatus(inexistente.result, 401, "login de usuario inexistente");
    assert.equal(inexistente.result.body.error, mala.result.body.error, "mismo mensaje para usuario inexistente y contraseña mala");
    tiemposInexistente.push(inexistente.ms);
  }
  assert.ok(
    mediana(tiemposInexistente) >= mediana(tiemposMala) * 0.5,
    `usuario inexistente responde mucho mas rapido (${mediana(tiemposInexistente).toFixed(1)} ms vs ${mediana(tiemposMala).toFixed(1)} ms)`
  );

  const usuarioBloqueo = await crearUsuario("bloqueo", "Alumno");
  for (let i = 1; i <= 5; i++) {
    expectStatus((await intentoLogin(usuarioBloqueo.email, "incorrecta")).result, 401, `intento fallido ${i}`);
  }
  const sexto = await intentoLogin(usuarioBloqueo.email, "demo1234");
  expectStatus(sexto.result, 429, "sexto intento bloqueado aun con la contraseña correcta");
  assert.ok(Number(sexto.result.headers.get("retry-after")) > 0, "429 incluye Retry-After");

  // ---- Limite de reconfirmaciones de contraseña (preceptor temporal en el curso 2) ----
  const preceptorTmp = await crearUsuario("reauth", "Preceptor");
  const cursoReauth = (await admin.request("/cursos.php")).body.cursos.find((curso) => Number(curso.id) === 2);
  const preceptorOriginalCurso2 = cursoReauth.preceptorId ?? null;
  expectStatus(await admin.json("/cursos.php", "PUT", { id: 2, preceptorId: preceptorTmp.id }), 200, "asigna curso 2 al preceptor temporal");
  try {
    const sesionReauth = await login(preceptorTmp.email, "preceptor");
    const alumnosCurso2 = await sesionReauth.request("/alumnos.php");
    expectStatus(alumnosCurso2, 200, "preceptor temporal lista alumnos");
    const alumnoCurso2 = alumnosCurso2.body.alumnos.find((item) => Number(item.cursoId) === 2);
    assert.ok(alumnoCurso2, "el curso 2 debe tener alumnos");
    const bajaConClave = (currentPassword) => sesionReauth.request(`/alumnos.php?id=${alumnoCurso2.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword }),
    });
    for (let i = 1; i <= 5; i++) {
      expectStatus(await bajaConClave("incorrecta"), 401, `reconfirmacion fallida ${i}`);
    }
    expectStatus(await bajaConClave("demo1234"), 429, "sexta reconfirmacion bloqueada");
    const sigueActivo = await admin.request("/alumnos.php");
    assert.ok(sigueActivo.body.alumnos.some((item) => String(item.id) === String(alumnoCurso2.id)), "el alumno no se dio de baja");
  } finally {
    expectStatus(await admin.json("/cursos.php", "PUT", { id: 2, preceptorId: preceptorOriginalCurso2 }), 200, "restaura preceptor del curso 2");
  }

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
      currentPassword: preceptor.password,
    }),
    200,
    "preceptor cambia de curso con contraseña correcta"
  );

  const bajaTmp = await preceptor.request(`/alumnos.php?id=${idTmp}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword: preceptor.password }),
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
