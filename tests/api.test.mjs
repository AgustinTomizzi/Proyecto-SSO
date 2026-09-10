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
  for (const endpoint of ["alumnos", "cursos", "asistencias", "notas", "reportes", "usuarios", "auditoria"]) {
    const result = await anonymous.request(`/${endpoint}.php`);
    expectStatus(result, 401, `${endpoint} sin sesion`);
  }

  const [admin, preceptor, directivo, alumno] = await Promise.all([
    login("admin@galileo.edu.ar", "admin"),
    login("preceptor@galileo.edu.ar", "preceptor"),
    login("directivo@galileo.edu.ar", "directivo"),
    login("alumno@galileo.edu.ar", "alumno"),
  ]);

  const cursosPreceptor = await preceptor.request("/cursos.php");
  expectStatus(cursosPreceptor, 200, "cursos del preceptor");
  assert.deepEqual(cursosPreceptor.body.cursos.map((curso) => Number(curso.id)), [1]);

  const alumnosPreceptor = await preceptor.request("/alumnos.php");
  expectStatus(alumnosPreceptor, 200, "alumnos del preceptor");
  assert.equal(alumnosPreceptor.body.alumnos.length, 3);
  assert.ok(alumnosPreceptor.body.alumnos.every((item) => Number(item.cursoId) === 1));

  expectStatus(
    await preceptor.request("/asistencias.php?alumnoId=4"),
    403,
    "preceptor consulta asistencia ajena"
  );
  expectStatus(
    await preceptor.json("/asistencias.php", "POST", {
      alumnoId: 4,
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
  expectStatus(await preceptor.request("/alumnos.php?id=4", { method: "DELETE" }), 403, "preceptor elimina alumno ajeno");

  const reportePreceptor = await preceptor.request("/reportes.php");
  expectStatus(reportePreceptor, 200, "reporte del preceptor");
  assert.equal(reportePreceptor.body.resumen.totalAlumnos, 3);

  const asistenciaPropia = await alumno.request("/asistencias.php?alumnoId=1");
  expectStatus(asistenciaPropia, 200, "alumno consulta asistencia propia");
  assert.equal(asistenciaPropia.body.registros.length, 8);
  expectStatus(await alumno.request("/asistencias.php?alumnoId=2"), 403, "alumno consulta asistencia ajena");
  expectStatus(await alumno.request("/notas.php?alumnoId=2"), 403, "alumno consulta nota ajena");
  expectStatus(await alumno.request("/auditoria.php"), 403, "alumno consulta auditoria");

  const reporteDirectivo = await directivo.request("/reportes.php");
  expectStatus(reporteDirectivo, 200, "reporte del directivo");
  assert.equal(reporteDirectivo.body.resumen.totalAlumnos, 15);

  const usuarios = await admin.request("/usuarios.php");
  expectStatus(usuarios, 200, "admin lista usuarios");
  assert.ok(usuarios.body.usuarios.some((usuario) => Number(usuario.id) === 2 && usuario.rol === "Preceptor"));

  const cursosAdmin = await admin.request("/cursos.php");
  expectStatus(cursosAdmin, 200, "admin lista cursos");
  const cursoDos = cursosAdmin.body.cursos.find((curso) => Number(curso.id) === 2);
  assert.ok(cursoDos, "No se encontro el curso 2 del seed");
  const preceptorAnterior = cursoDos.preceptorId ?? null;
  let asignacionCambiada = false;

  try {
    expectStatus(
      await admin.json("/cursos.php", "PUT", { id: 2, preceptorId: 4 }),
      400,
      "admin intenta asignar usuario no preceptor"
    );

    const asignacion = await admin.json("/cursos.php", "PUT", { id: 2, preceptorId: 2 });
    expectStatus(asignacion, 200, "admin asigna preceptor");
    asignacionCambiada = true;
    assert.equal(Number(asignacion.body.curso.preceptorId), 2);

    const cursosAmpliados = await preceptor.request("/cursos.php");
    assert.deepEqual(cursosAmpliados.body.cursos.map((curso) => Number(curso.id)), [1, 2]);

    const reporteAmpliado = await preceptor.request("/reportes.php");
    expectStatus(reporteAmpliado, 200, "reporte scoped tras asignacion");
    assert.equal(reporteAmpliado.body.resumen.totalAlumnos, 6);

    const auditoria = await admin.request("/auditoria.php?accion=cursos.asignar&entidad=curso&limit=10");
    expectStatus(auditoria, 200, "admin consulta auditoria");
    assert.ok(
      auditoria.body.registros.some((registro) => registro.entidadId === "2" && Number(registro.detalle?.preceptor_nuevo_id) === 2),
      "No se encontro la auditoria de asignacion del curso 2"
    );
    expectStatus(await preceptor.request("/auditoria.php"), 403, "preceptor consulta auditoria");
  } finally {
    if (asignacionCambiada) {
      const restauracion = await admin.json("/cursos.php", "PUT", { id: 2, preceptorId: preceptorAnterior });
      expectStatus(restauracion, 200, "restauracion de asignacion");
    }
  }

  expectStatus(await admin.request("/logout.php", { method: "POST" }), 200, "logout del admin");
  expectStatus(await admin.request("/usuarios.php"), 401, "sesion destruida tras logout");

  console.log("OK: autenticacion, RBAC, alcance por curso y auditoria verificados.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
