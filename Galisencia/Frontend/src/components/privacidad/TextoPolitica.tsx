// Texto de la política de privacidad. BORRADOR: tiene que revisarlo un abogado
// (Ley 25.326 de Protección de los Datos Personales, datos de menores) antes de
// usarse en una institución real. Si cambia el contenido, subir la versión en
// config_institucion (privacidad.version_politica) para volver a pedir la
// aceptación.
export default function TextoPolitica() {
  return (
    <div className="politica">
      <p className="politica__aviso" role="note">
        <strong>Borrador sujeto a revisión legal.</strong> Este texto describe cómo funciona el sistema y tiene que ser revisado y completado por un abogado antes de usarse oficialmente.
      </p>

      <h3>1. Quién es responsable de tus datos</h3>
      <p>La E.E.S.T. N.º 5 «Gral. San Martín» es responsable de las bases de datos de Galisencia (asistencia y gestión académica) y Galiservas (reservas de espacios y equipos). Consultas y pedidos: en preceptoría o por los canales oficiales de la escuela.</p>

      <h3>2. Para qué usamos los datos</h3>
      <ul>
        <li>Registrar y consultar la asistencia, las notas y los horarios de los alumnos.</li>
        <li>Gestionar cursos, suplencias, promociones y justificaciones de inasistencias.</li>
        <li>Reservar aulas y equipos, y avisar por email sobre esas reservas.</li>
        <li>Avisar a las familias vinculadas cuando un alumno falta.</li>
        <li>Mantener la seguridad del sistema (registro de accesos y de cambios).</li>
      </ul>
      <p>No usamos los datos para publicidad ni los compartimos con terceros fuera de la escuela, salvo obligación legal.</p>

      <h3>3. Qué datos tratamos</h3>
      <ul>
        <li><strong>Alumnos:</strong> nombre, apellido, DNI, dirección, email, curso, asistencias, notas y movimientos (cambios de curso, promoción, egreso).</li>
        <li><strong>Datos de salud:</strong> el motivo y el certificado de las justificaciones. Solo los ven quienes justifican (preceptoría y administración), el propio alumno y su familia.</li>
        <li><strong>Familias:</strong> nombre, email y parentesco con el alumno.</li>
        <li><strong>Personal:</strong> nombre, email, rol y, si usa el ingreso institucional, su identificador en Google o Microsoft.</li>
        <li><strong>Uso del sistema:</strong> reservas, avisos enviados, intentos de ingreso y registro de auditoría (quién hizo qué cambio y cuándo, sin contraseñas ni DNI).</li>
      </ul>

      <h3>4. Menores de edad</h3>
      <p>La mayoría de los alumnos son menores de edad. Sus datos se tratan solo para fines educativos, con acceso limitado por rol: cada docente ve los cursos que dicta, cada preceptor los suyos, y cada familia solo a sus hijos vinculados.</p>

      <h3>5. Cuánto tiempo los guardamos</h3>
      <ul>
        <li>Registro de auditoría: 24 meses.</li>
        <li>Certificados adjuntos de justificaciones: 24 meses (después se borra el archivo y queda la justificación).</li>
        <li>Avisos por email ya enviados: 6 meses.</li>
        <li>Intentos de ingreso: 30 días.</li>
        <li>Los datos académicos (asistencias, notas, movimientos) se conservan mientras lo exija la normativa educativa.</li>
      </ul>

      <h3>6. Tus derechos</h3>
      <p>Podés pedir <strong>acceso</strong> a tus datos (o a los de tu hijo o hija), su <strong>rectificación</strong> si son incorrectos y su <strong>supresión</strong> cuando ya no sean necesarios, sin costo. El acceso lo podés ejercer directamente desde esta página con «Descargar mis datos»; para rectificar o suprimir, acercate a la escuela. La escuela responde dentro de los plazos de la Ley 25.326 (10 días corridos para el acceso y 5 días hábiles para la rectificación o supresión).</p>
      <p>La Agencia de Acceso a la Información Pública (AAIP), órgano de control de la Ley 25.326, atiende las denuncias y reclamos por incumplimiento.</p>

      <h3>7. Seguridad</h3>
      <p>Las contraseñas se guardan cifradas, las sesiones vencen por inactividad, cada acción se autoriza en el servidor según el rol y la conexión debe usar HTTPS. La aplicación instalada en el celular no guarda datos de alumnos en el dispositivo.</p>
    </div>
  );
}
