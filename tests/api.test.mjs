import assert from "node:assert/strict";

const API = process.env.API_URL ?? "http://localhost:3000/api";
const PASSWORD_DEMO = "demo1234";
// Las cuentas demo deben cambiar demo1234 en el primer ingreso: los tests usan esta.
const PASSWORD_PRUEBA = process.env.TEST_PASSWORD ?? "Integracion-2026!";

class PhpSession {
  cookie = "";

  // Las escrituras llevan X-Requested-With: galileo como los frontends;
  // init.sinCsrf = true lo omite para probar la proteccion CSRF.
  async request(path, init = {}) {
    const headers = new Headers(init.headers);
    if (this.cookie) headers.set("Cookie", this.cookie);
    const metodo = (init.method ?? "GET").toUpperCase();
    if (metodo !== "GET" && !init.sinCsrf) headers.set("X-Requested-With", "galileo");

    const { sinCsrf: _sinCsrf, ...fetchInit } = init;
    const response = await fetch(`${API}${path}`, {
      ...fetchInit,
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

  // ---- Cabeceras de seguridad, CORS y cookie de sesion ----
  const respuestaApi = await fetch(`${API}/sesion.php`, { headers: { Origin: "http://evil.example" } });
  assert.equal(respuestaApi.headers.get("x-content-type-options"), "nosniff");
  assert.equal(respuestaApi.headers.get("x-frame-options"), "DENY");
  assert.match(respuestaApi.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.equal(respuestaApi.headers.get("access-control-allow-origin"), null, "CORS no habilita origenes ajenos");
  const respuestaLocal = await fetch(`${API}/sesion.php`, { headers: { Origin: "http://localhost:5173" } });
  assert.equal(respuestaLocal.headers.get("access-control-allow-origin"), "http://localhost:5173", "CORS habilita localhost en APP_ENV=dev");

  const respuestaSpa = await fetch(new URL("/", API));
  expectStatus({ status: respuestaSpa.status, body: null }, 200, "index del frontend");
  assert.match(respuestaSpa.headers.get("content-security-policy") ?? "", /default-src 'self'/, "nginx envia CSP");
  assert.equal(respuestaSpa.headers.get("x-frame-options"), "DENY");
  assert.equal(respuestaSpa.headers.get("x-content-type-options"), "nosniff");
  assert.ok(respuestaSpa.headers.get("referrer-policy"), "nginx envia Referrer-Policy");

  const loginCookie = await fetch(`${API}/login.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Requested-With": "galileo" },
    body: JSON.stringify({ email: "academica@galileo.edu.ar", password: "incorrecta-a-proposito" }),
  });
  expectStatus({ status: loginCookie.status, body: null }, 401, "login fallido para inspeccionar cookie");
  const sesionInventada = await fetch(`${API}/sesion.php`, { headers: { Cookie: "PHPSESSID=inventadaporelcliente123" } });
  const cookieNueva = (sesionInventada.headers.getSetCookie?.() ?? []).find((value) => value.startsWith("PHPSESSID="));
  assert.ok(cookieNueva, "strict mode: un ID de sesion inventado se reemplaza");
  assert.ok(!cookieNueva.startsWith("PHPSESSID=inventadaporelcliente123"), "strict mode: no adopta el ID del cliente");
  assert.match(cookieNueva, /HttpOnly/i);
  assert.match(cookieNueva, /SameSite=Lax/i);

  // ---- CSRF: escrituras sin X-Requested-With o con otro Content-Type ----
  const sinHeader = await new PhpSession().request("/login.php", {
    method: "POST",
    sinCsrf: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@galileo.edu.ar", password: "x" }),
  });
  expectStatus(sinHeader, 403, "POST sin X-Requested-With");
  assert.equal(sinHeader.body.codigo, "csrf");
  const textoPlano = await new PhpSession().request("/login.php", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ email: "admin@galileo.edu.ar", password: "x" }),
  });
  expectStatus(textoPlano, 415, "POST con text/plain");
  const formulario = await new PhpSession().request("/login.php", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "email=admin%40galileo.edu.ar&password=x",
  });
  expectStatus(formulario, 415, "POST de formulario urlencoded");
  const multipartAjeno = new FormData();
  multipartAjeno.append("email", "admin@galileo.edu.ar");
  expectStatus(await new PhpSession().request("/login.php", { method: "POST", body: multipartAjeno }), 415, "multipart fuera de horarios");

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
  expectStatus(await directivo.request("/horarios.php"), 200, "directivo consulta horarios (horarios.ver)");
  expectStatus(await preceptor.request("/horarios.php"), 200, "preceptor consulta horarios (horarios.ver)");

  // La imagen quedó como histórico de solo lectura: el horario se carga en la grilla.
  const horarioPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const form = new FormData();
  form.append("cursoId", "10");
  form.append("imagen", new Blob([horarioPng], { type: "image/png" }), "horario-6a.png");
  expectStatus(await academica.request("/horarios.php", { method: "POST", body: form }), 410, "subir imagen de horario (solo lectura)");
  expectStatus(await admin.json("/horarios.php", "DELETE", { cursoId: 10 }), 410, "borrar imagen de horario (solo lectura)");
  const horariosAdmin = await admin.request("/horarios.php?cursoId=10");
  expectStatus(horariosAdmin, 200, "consulta del histórico de imágenes");
  assert.equal(horariosAdmin.body.cursos[0].horarioId, null);

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

  // ---- Grilla de horarios (horario_grilla.php), formato del colegio ----
  // El seed trae los horarios reales: las pruebas usan el vespertino (módulos
  // 9 a 12), libre en 1º y 2º año, y un aula libre en esos módulos.
  {
    const docenteA = await crearUsuario("docente.a", "Docente");
    const docenteB = await crearUsuario("docente.b", "Docente");
    const materiasGrilla = (await academica.request("/materias.php")).body.materias;
    const idMateria = (nombre) => materiasGrilla.find((m) => m.nombre === nombre).id;
    expectStatus(await academica.request("/horario_grilla.php"), 400, "grilla sin filtro");
    const catalogosGrilla = await academica.request("/horario_grilla.php?catalogos=1");
    expectStatus(catalogosGrilla, 200, "catálogos para editar la grilla");
    assert.ok(catalogosGrilla.body.docentes.some((d) => Number(d.id) === docenteA.id), "docentes con rol Docente");
    assert.ok(!catalogosGrilla.body.docentes.some((d) => Number(d.id) === 3), "un preceptor no aparece como docente");
    assert.ok(catalogosGrilla.body.aulas.some((a) => a.nombre === "Playón" && a.compartida), "aulas compartidas");
    expectStatus(await alumno.request("/horario_grilla.php?catalogos=1"), 403, "alumno no ve los catálogos de edición");

    const grillaReal = await academica.request("/horario_grilla.php?cursoId=1&fecha=2026-04-06");
    expectStatus(grillaReal, 200, "grilla real del curso 1º A");
    assert.equal(grillaReal.body.franjas.length, 12, "doce módulos de 07:40 a 21:40");
    assert.equal(grillaReal.body.franjas[0].horaInicio, "07:40");
    assert.equal(grillaReal.body.franjas[11].horaFin, "21:40");
    assert.ok(grillaReal.body.clases.length >= 30, "el seed carga el horario real de 1º A");
    assert.ok(grillaReal.body.clases.some((c) => c.grupo === 1) && grillaReal.body.clases.some((c) => c.grupo === 2), "celdas partidas en grupos");
    assert.equal(grillaReal.body.curso.division, "A");
    const franja = (orden) => grillaReal.body.franjas.find((f) => f.orden === orden);

    // Un aula no compartida libre el viernes en el vespertino.
    let aulaLibre = null;
    for (const aula of catalogosGrilla.body.aulas.filter((a) => !a.compartida)) {
      const ocupacion = await academica.request(`/horario_grilla.php?aulaId=${aula.id}&fecha=2026-04-06`);
      if (!ocupacion.body.clases.some((c) => c.dia === 5 && c.orden >= 9)) { aulaLibre = aula; break; }
    }
    assert.ok(aulaLibre, "hay un aula libre para la prueba");
    const playon = catalogosGrilla.body.aulas.find((a) => a.nombre === "Playón");

    const base = { cursoId: 1, dia: 5, franjaId: franja(9).id, grupo: 0, materiaId: idMateria("Matemática"), docenteId: docenteA.id, aulaId: aulaLibre.id, vigenteDesde: "2026-03-01" };
    const creadas = [];
    try {
      const bloque = await academica.json("/horario_grilla.php", "POST", { ...base, franjaHastaId: franja(10).id });
      expectStatus(bloque, 201, "alta de un bloque de dos módulos");
      assert.equal(bloque.body.clases.length, 2);
      assert.deepEqual(bloque.body.clases.map((c) => c.orden), [9, 10]);
      creadas.push(...bloque.body.clases.map((c) => c.id));

      expectStatus(await academica.json("/horario_grilla.php", "POST", { ...base, grupo: 1, docenteId: docenteB.id, aulaId: null }), 409, "un grupo no entra donde cursa el curso completo");
      const choqueDocente = await academica.json("/horario_grilla.php", "POST", { ...base, cursoId: 3, aulaId: null });
      expectStatus(choqueDocente, 409, "docente en dos cursos a la vez");
      assert.match(choqueDocente.body.error, /docente/);
      const choqueAula = await academica.json("/horario_grilla.php", "POST", { ...base, cursoId: 3, docenteId: docenteB.id });
      expectStatus(choqueAula, 409, "aula ocupada por dos cursos");
      assert.match(choqueAula.body.error, /aula/);
      // El aula de la clase 1º A se cambia al Playón (compartida) y otro curso la usa a la vez.
      expectStatus(await academica.json("/horario_grilla.php", "PUT", { ids: bloque.body.clases.map((c) => c.id), aulaId: playon.id }), 200, "pasar el bloque al Playón");
      const compartida = await academica.json("/horario_grilla.php", "POST", { ...base, cursoId: 3, docenteId: null, aulaId: playon.id });
      expectStatus(compartida, 201, "aula compartida admite otra clase a la vez");
      creadas.push(...compartida.body.clases.map((c) => c.id));
      expectStatus(await academica.json("/horario_grilla.php", "PUT", { ids: bloque.body.clases.map((c) => c.id), aulaId: aulaLibre.id }), 200, "volver al aula original");

      // Celda partida: grupos 1 y 2 conviven en el mismo módulo.
      const grupo1 = await academica.json("/horario_grilla.php", "POST", { ...base, franjaId: franja(11).id, grupo: 1, docenteId: docenteB.id, aulaId: null });
      expectStatus(grupo1, 201, "grupo 1");
      creadas.push(grupo1.body.clase.id);
      const grupo2 = await academica.json("/horario_grilla.php", "POST", { ...base, franjaId: franja(11).id, grupo: 2, materiaId: idMateria("Lengua"), docenteId: null, aulaId: null });
      expectStatus(grupo2, 201, "grupo 2 en paralelo");
      creadas.push(grupo2.body.clase.id);
      expectStatus(await academica.json("/horario_grilla.php", "POST", { ...base, franjaId: franja(11).id, grupo: 2, docenteId: null, aulaId: null }), 409, "el mismo grupo dos veces");
      expectStatus(await academica.json("/horario_grilla.php", "POST", { ...base, franjaId: franja(11).id, grupo: 0, docenteId: null, aulaId: null }), 409, "curso completo sobre grupos");

      expectStatus(await academica.json("/horario_grilla.php", "POST", { ...base, dia: 6 }), 400, "día fuera de lunes a viernes");
      expectStatus(await academica.json("/horario_grilla.php", "POST", { ...base, grupo: 3 }), 400, "grupo inválido");
      expectStatus(await academica.json("/horario_grilla.php", "POST", { ...base, franjaId: franja(10).id, franjaHastaId: franja(9).id }), 400, "bloque hacia arriba");
      expectStatus(await academica.json("/horario_grilla.php", "POST", { ...base, cursoId: 3, docenteId: 3, aulaId: null }), 400, "docente sin rol Docente");

      // Editar el bloque entero y cerrar su vigencia libera el horario.
      const editado = await academica.json("/horario_grilla.php", "PUT", { ids: bloque.body.clases.map((c) => c.id), materiaId: idMateria("Historia"), vigenteHasta: "2026-12-31" });
      expectStatus(editado, 200, "editar un bloque completo");
      assert.ok(editado.body.clases.every((c) => c.materia === "Historia" && c.vigenteHasta === "2026-12-31"));
      expectStatus(await academica.json("/horario_grilla.php", "PUT", { ids: bloque.body.clases.map((c) => c.id), dia: 4 }), 400, "mover un bloque de a varias clases");
      const siguiente = await academica.json("/horario_grilla.php", "POST", { ...base, cursoId: 2, vigenteDesde: "2027-03-01" });
      expectStatus(siguiente, 201, "mismo docente y aula en otro curso con vigencia posterior");
      creadas.push(siguiente.body.clase.id);

      const porDocente = await academica.request(`/horario_grilla.php?docenteId=${docenteA.id}&fecha=2026-04-06`);
      expectStatus(porDocente, 200, "grilla por docente");
      assert.ok(porDocente.body.clases.every((c) => c.cursoId === "1"));

      // Alumno: solo su curso (seed: 1º A).
      expectStatus(await alumno.request("/horario_grilla.php?cursoId=3"), 403, "alumno pide la grilla de otro curso");
      const grillaAlumno = await alumno.request("/horario_grilla.php?fecha=2026-04-06");
      expectStatus(grillaAlumno, 200, "alumno ve la grilla de su curso");
      assert.ok(grillaAlumno.body.clases.length > 0 && grillaAlumno.body.clases.every((c) => c.cursoId === "1"));
      expectStatus(await alumno.json("/horario_grilla.php", "POST", { ...base, dia: 2 }), 403, "alumno no gestiona la grilla");

      const auditoriaGrilla = await admin.request("/auditoria.php?accion=horarios.gestionar&entidad=horario_clase&limit=40");
      expectStatus(auditoriaGrilla, 200, "auditoría de la grilla");
      assert.ok(auditoriaGrilla.body.registros.some((r) => r.entidadId === String(bloque.body.clases[0].id) && r.detalle?.accion === "editar"));
    } finally {
      if (creadas.length) {
        expectStatus(await academica.json("/horario_grilla.php", "DELETE", { ids: creadas }), 200, "borra las clases de prueba");
      }
    }
    expectStatus(await academica.json("/horario_grilla.php", "DELETE", { id: creadas[0] }), 404, "clase ya borrada");
  }

  // ---- Alcance del Docente según la grilla (cursos y materias que dicta) ----
  {
    const docenteId = Number((await docente.request("/sesion.php")).body.usuario.id);
    const materiasCat = (await academica.request("/materias.php")).body.materias;
    const idMat = (nombre) => materiasCat.find((m) => m.nombre === nombre).id;
    const modulo = (await academica.request("/horario_grilla.php?cursoId=1")).body.franjas.find((f) => f.orden === 12);
    const clase = await academica.json("/horario_grilla.php", "POST", {
      cursoId: 1, dia: 3, franjaId: modulo.id, materiaId: idMat("Matemática"), docenteId, vigenteDesde: "2026-01-01",
    });
    expectStatus(clase, 201, "asigna al docente Matemática en 1 A");
    try {
      const todos = (await admin.request("/alumnos.php")).body.alumnos;
      const deCurso1 = todos.filter((a) => Number(a.cursoId) === 1);
      const deOtroCurso = todos.find((a) => Number(a.cursoId) === 2);

      const alumnosDocente = await docente.request("/alumnos.php");
      expectStatus(alumnosDocente, 200, "docente lista alumnos");
      assert.equal(alumnosDocente.body.alumnos.length, deCurso1.length, "solo los alumnos de los cursos que dicta");
      assert.ok(alumnosDocente.body.alumnos.every((a) => Number(a.cursoId) === 1));
      const cursosDocente = await docente.request("/cursos.php");
      assert.deepEqual(cursosDocente.body.cursos.map((c) => Number(c.id)), [1], "docente ve solo sus cursos");

      const fecha = "2025-10-20";
      expectStatus(await docente.json("/asistencias.php", "POST", { alumnoId: deCurso1[0].id, materiaId: idMat("Matemática"), fecha, estado: "presente" }), 200, "docente registra en la materia que dicta");
      expectStatus(await docente.json("/asistencias.php", "POST", { alumnoId: deCurso1[0].id, materiaId: idMat("Lengua"), fecha, estado: "presente" }), 403, "docente registra en una materia que no dicta");
      expectStatus(await docente.json("/asistencias.php", "POST", { alumnoId: deOtroCurso.id, materiaId: idMat("Matemática"), fecha, estado: "presente" }), 403, "docente registra en un curso que no dicta");
      expectStatus(await docente.json("/notas.php", "POST", { alumnoId: deCurso1[0].id, materiaId: idMat("Lengua"), fecha, nota: 8 }), 403, "docente carga nota en una materia que no dicta");
      expectStatus(await docente.json("/notas.php", "POST", { alumnoId: deOtroCurso.id, materiaId: idMat("Matemática"), fecha, nota: 8 }), 403, "docente carga nota en un curso que no dicta");
      expectStatus(await docente.json("/notas.php", "POST", { alumnoId: deCurso1[0].id, materiaId: idMat("Matemática"), fecha, nota: 8 }), 200, "docente carga nota en la materia que dicta");

      const asistenciasDocente = await docente.request("/asistencias.php");
      expectStatus(asistenciasDocente, 200, "docente lista asistencias");
      assert.ok(asistenciasDocente.body.registros.length > 0);
      assert.ok(asistenciasDocente.body.registros.every((r) => r.materia === "Matemática" && deCurso1.some((a) => String(a.id) === String(r.alumnoId))), "solo sus pares curso/materia");
      const notasDocente = await docente.request("/notas.php");
      assert.ok(notasDocente.body.notas.every((n) => n.materia === "Matemática"));

      expectStatus(await docente.request(`/historial_alumno.php?id=${deOtroCurso.id}`), 403, "docente ve historial de un curso que no dicta");
      const historial = await docente.request(`/historial_alumno.php?id=${deCurso1[0].id}`);
      expectStatus(historial, 200, "docente ve historial de su alumno");
      assert.ok(historial.body.asistencia.every((h) => h.materia === "Matemática"));

      const reporte = await docente.request("/reportes.php");
      expectStatus(reporte, 200, "docente consulta reportes de sus cursos");
      assert.equal(reporte.body.resumen.totalAlumnos, deCurso1.length);
      expectStatus(await docente.request("/reportes.php?cursoId=2"), 403, "docente pide reporte de otro curso");

      const misClases = await docente.request(`/horario_grilla.php?docenteId=${docenteId}`);
      expectStatus(misClases, 200, "docente consulta sus clases (horarios.ver)");
      assert.equal(misClases.body.clases.length, 1);
    } finally {
      expectStatus(await academica.json("/horario_grilla.php", "DELETE", { id: clase.body.clase.id }), 200, "borra la clase del docente");
    }
    const sinClases = await docente.request("/alumnos.php");
    assert.equal(sinClases.body.alumnos.length, 0, "sin clases vigentes el docente no ve alumnos");
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

  // ---- Materias como catálogo (materia_id) ----
  const catalogo = await preceptor.request("/materias.php");
  expectStatus(catalogo, 200, "catálogo de materias");
  const matematica = catalogo.body.materias.find((m) => m.nombre === "Matemática");
  assert.ok(matematica, "el catálogo tiene Matemática con tilde");
  const porTexto = await preceptor.json("/asistencias.php", "POST", { alumnoId: 1, materia: "matematica", fecha: "2025-09-15", estado: "presente" });
  expectStatus(porTexto, 200, "asistencia con materia en texto (sin tilde ni mayúscula)");
  assert.equal(porTexto.body.registro.materia, "Matemática");
  assert.equal(String(porTexto.body.registro.materiaId), String(matematica.id));
  const porId = await preceptor.json("/asistencias.php", "POST", { alumnoId: 1, materiaId: matematica.id, fecha: "2025-09-15", estado: "tarde" });
  expectStatus(porId, 200, "corrección de la misma asistencia por materiaId");
  assert.equal(porId.body.registro.id, porTexto.body.registro.id, "texto e id resuelven al mismo registro");
  expectStatus(
    await preceptor.json("/asistencias.php", "POST", { alumnoId: 1, materia: "Astrología", fecha: "2025-09-15", estado: "presente" }),
    400,
    "materia fuera del catálogo"
  );
  expectStatus(await preceptor.json("/asistencias.php", "POST", { alumnoId: 1, fecha: "2025-09-15", estado: "presente" }), 400, "asistencia sin materia");
  const filtradas = await preceptor.request(`/asistencias.php?alumnoId=1&materiaId=${matematica.id}`);
  expectStatus(filtradas, 200, "asistencias filtradas por materiaId");
  assert.ok(filtradas.body.registros.length > 0 && filtradas.body.registros.every((r) => r.materia === "Matemática"));
  expectStatus(await preceptor.request("/asistencias.php?materiaId=99999"), 400, "filtro con materia inexistente");

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

  // ---- Zona horaria: "hoy" es la fecha argentina, no la UTC ----
  const fechaArgentina = (instante) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(instante);
  const hoyArgentina = fechaArgentina(new Date());
  const ayerArgentina = fechaArgentina(new Date(Date.now() - 24 * 3600 * 1000));
  const reservaHoy = await preceptor.json("/reservas.php", "POST", {
    resourceId: aula208.id, date: hoyArgentina, startTime: "23:00", endTime: "23:30", quantity: 1, reason: "test zona horaria",
  });
  expectStatus(reservaHoy, 201, `reserva para hoy en Argentina (${hoyArgentina})`);
  expectStatus(
    await preceptor.json("/reservas.php", "POST", {
      resourceId: aula208.id, date: ayerArgentina, startTime: "23:00", endTime: "23:30", quantity: 1, reason: "ayer",
    }),
    400,
    "reserva para ayer"
  );

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
