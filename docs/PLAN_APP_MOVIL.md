# Plan: Galileo como app móvil

Este es el plan para llegar a las tiendas (Google Play y App Store) partiendo de lo que ya existe. **Todavía no está implementado.**

## Punto de partida

- **Galisencia ya es una PWA** (Fase 4.2):
  - Manifest, íconos 192, 512 y *maskable*, y un service worker propio.
  - Toma de asistencia sin conexión con una cola en IndexedDB.
  - Diseño adaptado al celular.
- Con HTTPS (`docs/DESPLIEGUE.md`) ya se instala sin tienda:
  - **Android (Chrome):** menú ⋮ → *Instalar app*.
  - **iPhone (Safari):** Compartir → *Agregar a pantalla de inicio*.
- **Galiservas** todavía no es PWA. Funciona en el navegador del celular.

Conclusión: **la app ya existe como PWA**. Publicar en las tiendas es empaquetarla, no reescribirla.

## Opciones

| Opción | Qué es | Tiendas | Esfuerzo | Costo |
|---|---|---|---|---|
| **A. PWA sola** (ya está) | Se instala desde el navegador | Ninguna | Nulo | USD 0 |
| **B. TWA (Bubblewrap)** | La PWA en un "contenedor" Android de Chrome | Google Play | Bajo (1–2 días) | USD 25 una vez |
| **C. Capacitor** | La misma SPA de React dentro de una app nativa (Android + iOS) con acceso a plugins nativos | Google Play y App Store | Medio (1–3 semanas) | USD 25 + USD 99/año |
| D. React Native / Flutter | App nativa reescrita | Ambas | Alto (meses) | Igual que C |

**Recomendación:** A ahora; B para estar en Play Store rápido; C cuando haga falta iPhone en App Store o notificaciones push nativas. D no se justifica: duplicaría el frontend.

## Etapa 1: PWA en producción (sin costo)

1. Desplegar en el servidor con HTTPS (`docs/DESPLIEGUE.md`).
2. Probar la instalación en Android y en iPhone.
3. Convertir **Galiservas** en PWA con el mismo esquema que Galisencia: manifest con `scope: /galiservas/`, íconos y service worker sin caché de `/api/`.
4. Revisar que todo funcione con la pantalla del iPhone (zona segura, `viewport-fit=cover`).

## Etapa 2: Google Play con TWA

1. Cuenta de **Google Play Console** (USD 25, pago único). Si la cuenta es personal (no de una organización), Google pide una prueba cerrada de 12 personas durante 14 días antes de publicar.
2. Generar el proyecto Android con Bubblewrap a partir del manifest:

   ```bash
   npx @bubblewrap/cli init --manifest https://<dominio>/manifest.webmanifest
   npx @bubblewrap/cli build
   ```

3. Publicar `https://<dominio>/.well-known/assetlinks.json` con la huella SHA-256 de la firma (lo da Bubblewrap o Play Console). Así la app abre sin la barra del navegador.
4. Ficha de la tienda:
   - Íconos (ya están).
   - Capturas de pantalla.
   - Descripción.
   - Clasificación de contenido.
   - **Política de privacidad pública:** `https://<dominio>/privacidad`, que ya existe pero tiene que revisarla un abogado.
   - Formulario de **Seguridad de los datos**: datos personales de menores, asistencia, notas y datos de salud de las justificaciones; cifrado en tránsito; sin venta a terceros.
5. Prueba interna → prueba cerrada → producción.

Las actualizaciones del sistema se ven solas, porque la app carga el sitio. Solo hace falta volver a subir la app si cambia el ícono, el nombre o el dominio.

## Etapa 3: App Store (y Android nativo) con Capacitor

1. Cuenta de **Apple Developer Program** (USD 99 por año) y **una Mac con Xcode** para compilar y subir. Si no hay Mac, se puede usar una Mac en la nube o un servicio de builds (Codemagic, Ionic Appflow), con costo aparte.
2. Agregar Capacitor a `Galisencia/Frontend`:

   ```bash
   npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
   npx cap init Galisencia ar.edu.eest5.galisencia --web-dir dist
   npx cap add android && npx cap add ios
   npm run build && npx cap sync
   ```

3. Cambios técnicos:
   - **URL de la API:** dentro de la app el origen es `capacitor://localhost` (iOS) o `https://localhost` (Android), no el dominio. El cliente tiene que llamar a `https://<dominio>/api`, y el backend tiene que aceptar esos orígenes en `CORS_ALLOWED_ORIGINS` con credenciales.
   - **Sesión:** la cookie `SameSite` entre orígenes distintos es frágil en iOS (WKWebView), así que la opción más robusta es pasar a un token de sesión en un header para la app. Cambia el backend (`_common.php`, `login.php`): hay que diseñarlo y testearlo.
   - **OIDC (Google o Microsoft):** el login institucional dentro de la app tiene que usar el navegador del sistema (`@capacitor/browser`) y volver por un *deep link* (`ar.edu.eest5.galisencia://callback`). Google bloquea el login dentro de WebViews.
   - **Service worker:** dentro de Capacitor no hace falta. La cola sin conexión ya usa IndexedDB y sigue funcionando.
4. Revisión de Apple (la más exigente):
   - Apple **rechaza las apps que son solo un sitio web envuelto** (guía 4.2). Hay que aportar algo nativo: notificaciones push, funcionamiento sin conexión (ya está), atajos y *haptics*.
   - Hay que dar una **cuenta de prueba** para el revisor.
   - Hay que completar las etiquetas de privacidad (*App Privacy*).
5. Distribución: TestFlight para probar con la escuela y después publicar.

## Notificaciones push (mejora para ambas tiendas)

Hoy los avisos a familias salen por email. Para push:

- **Web Push** (PWA): funciona en Android, y en iPhone solo con la PWA instalada (iOS 16.4 o posterior). Necesita una tabla de suscripciones, claves VAPID en el `.env` y el envío desde el `notificador`.
- **Nativo** (Capacitor): Firebase Cloud Messaging (Android) y APNs (iOS), con `@capacitor/push-notifications`.

Lleva la misma regla del proyecto: una migración nueva, tests, documentación y preferencias por usuario como las del email.

## Costos resumidos

| Concepto | Costo |
|---|---|
| Servidor (Oracle Always Free) y dominio (DuckDNS) | USD 0 |
| Google Play Console | USD 25 una vez |
| Apple Developer Program | USD 99 por año |
| Mac para compilar iOS (si no hay) | Mac propia, o alquiler o servicio de builds |
| Dominio propio en vez de DuckDNS (opcional, recomendado para las tiendas) | Aprox. USD 10–15 por año, o `.com.ar` en NIC Argentina |

## Riesgos

- **Datos de menores:** las tiendas son estrictas. La política de privacidad y los formularios de datos tienen que ser exactos, y conviene la revisión legal pendiente (`docs/PROTECCION_DE_DATOS.md`).
- **Dominio de DuckDNS:** si cambia, la TWA deja de validar (`assetlinks.json`). Para las tiendas conviene un dominio propio desde el principio.
- **Apple 4.2:** sin funciones nativas reales, el rechazo es probable.

## Orden sugerido

1. Desplegar en el servidor (pendiente: la cuenta de Oracle y el dominio).
2. Usar la PWA en la escuela y juntar devoluciones.
3. Hacer de Galiservas una PWA.
4. Publicar la TWA en Google Play.
5. Hacer Web Push.
6. Pasar a Capacitor y la App Store, con token de sesión, OIDC por navegador del sistema y push nativo.
