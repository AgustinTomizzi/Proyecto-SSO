const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailValido(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/** Devuelve la lista de mensajes de validación del login. */
export function validarLogin(email: string, password: string): string[] {
  const errores: string[] = [];
  if (!email.trim()) errores.push("El email institucional es obligatorio.");
  else if (!emailValido(email)) errores.push("Ingresá un email válido.");
  if (!password) errores.push("La contraseña es obligatoria.");
  return errores;
}

/** Valida el formulario de alta/edición de alumno. */
export function validarAlumno(datos: {
  nombre?: string;
  apellido?: string;
  curso?: string;
  email?: string;
}): string[] {
  const errores: string[] = [];
  if (!datos.nombre?.trim()) errores.push("El nombre del alumno es obligatorio.");
  if (!datos.apellido?.trim()) errores.push("El apellido del alumno es obligatorio.");
  if (!datos.curso) errores.push("Seleccioná el curso.");
  if (datos.email?.trim() && !emailValido(datos.email)) {
    errores.push("El email no tiene un formato válido.");
  }
  return errores;
}

/** Valida la reserva de un recurso en Galiservas. */
export function validarReserva(datos: {
  recursoId?: number;
  fecha?: string;
  horario?: string;
  cantidad?: number;
}): string[] {
  const errores: string[] = [];
  if (!datos.recursoId || datos.recursoId <= 0) errores.push("Elegí un recurso para reservar.");
  if (!datos.fecha) errores.push("Elegí una fecha.");
  if (!datos.horario) errores.push("Elegí una franja horaria.");
  if (!datos.cantidad || datos.cantidad <= 0) errores.push("La cantidad debe ser mayor a cero.");
  return errores;
}