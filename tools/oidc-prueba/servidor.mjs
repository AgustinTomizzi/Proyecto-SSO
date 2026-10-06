// Proveedor OIDC de PRUEBA (solo desarrollo y tests; nunca en producción).
// Implementa lo mínimo del Authorization Code Flow con PKCE: discovery, JWKS,
// authorize, token (id_token firmado RS256) y userinfo. No hay contraseñas:
// "inicia sesión" cualquier email que se indique (login_hint o el formulario).
//   OIDC_ISSUER        URL con la que lo ve el backend (http://oidc-prueba:9100)
//   OIDC_PUBLICO       URL con la que lo ve el navegador (http://localhost:9100)
//   OIDC_CLIENT_ID / OIDC_CLIENT_SECRET   credenciales de prueba del cliente
// Emails especiales: los que contienen "+noverificado" salen con
// email_verified=false; el parámetro "sub" fuerza el sub (para probar vínculos).
import { createHash, createSign, generateKeyPairSync, randomBytes } from "node:crypto";
import { createServer } from "node:http";

const PUERTO = Number(process.env.PORT ?? 9100);
const ISSUER = (process.env.OIDC_ISSUER ?? `http://localhost:${PUERTO}`).replace(/\/+$/, "");
const PUBLICO = (process.env.OIDC_PUBLICO ?? ISSUER).replace(/\/+$/, "");
const CLIENT_ID = process.env.OIDC_CLIENT_ID ?? "galileo-pruebas";
const CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET ?? "secreto-de-pruebas";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const KID = randomBytes(8).toString("hex");
const jwk = { ...publicKey.export({ format: "jwk" }), kid: KID, use: "sig", alg: "RS256" };
const codigos = new Map();
const accesos = new Map();

const b64url = (buffer) => Buffer.from(buffer).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
function firmar(payload) {
  const cabecera = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: KID }));
  const cuerpo = b64url(JSON.stringify(payload));
  const firma = createSign("RSA-SHA256").update(`${cabecera}.${cuerpo}`).sign(privateKey);
  return `${cabecera}.${cuerpo}.${b64url(firma)}`;
}
const json = (res, estado, datos) => { res.writeHead(estado, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(datos)); };
const escapar = (texto) => String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function leerCuerpo(req) {
  let datos = "";
  for await (const parte of req) datos += parte;
  return new URLSearchParams(datos);
}

createServer(async (req, res) => {
  const url = new URL(req.url, PUBLICO);
  try {
    if (url.pathname === "/.well-known/openid-configuration") {
      return json(res, 200, {
        issuer: ISSUER,
        authorization_endpoint: `${PUBLICO}/authorize`,
        token_endpoint: `${ISSUER}/token`,
        userinfo_endpoint: `${ISSUER}/userinfo`,
        jwks_uri: `${ISSUER}/jwks`,
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        scopes_supported: ["openid", "email", "profile"],
        token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
        code_challenge_methods_supported: ["S256"],
        claims_supported: ["sub", "email", "email_verified", "name"],
      });
    }
    if (url.pathname === "/jwks") return json(res, 200, { keys: [jwk] });

    if (url.pathname === "/authorize") {
      const p = url.searchParams;
      if (p.get("client_id") !== CLIENT_ID || p.get("response_type") !== "code" || !p.get("redirect_uri")) {
        return json(res, 400, { error: "invalid_request" });
      }
      const email = (p.get("login_hint") ?? "").trim().toLowerCase();
      if (!email) {
        const ocultos = [...p.entries()].map(([k, v]) => `<input type="hidden" name="${escapar(k)}" value="${escapar(v)}">`).join("");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(`<!doctype html><meta charset="utf-8"><title>Proveedor de prueba</title><body style="font-family:sans-serif;max-width:420px;margin:60px auto"><h1>Proveedor OIDC de prueba</h1><p>Solo para desarrollo. Escribí el email de una cuenta de Galisencia.</p><form method="get" action="/authorize">${ocultos}<input name="login_hint" type="email" required style="width:100%;padding:8px" placeholder="preceptor@galileo.edu.ar"><p><button>Continuar</button></p></form></body>`);
      }
      const codigo = randomBytes(24).toString("hex");
      codigos.set(codigo, {
        email, sub: p.get("sub") || `prueba-${createHash("sha256").update(email).digest("hex").slice(0, 20)}`,
        nonce: p.get("nonce"), redirect: p.get("redirect_uri"), challenge: p.get("code_challenge"), metodo: p.get("code_challenge_method"), vence: Date.now() + 60_000,
      });
      const destino = new URL(p.get("redirect_uri"));
      destino.searchParams.set("code", codigo);
      if (p.get("state")) destino.searchParams.set("state", p.get("state"));
      res.writeHead(302, { Location: destino.toString() });
      return res.end();
    }

    if (url.pathname === "/token" && req.method === "POST") {
      const cuerpo = await leerCuerpo(req);
      let [id, secreto] = [cuerpo.get("client_id"), cuerpo.get("client_secret")];
      const basic = /^Basic\s+(.+)$/i.exec(req.headers.authorization ?? "");
      if (basic) [id, secreto] = Buffer.from(basic[1], "base64").toString().split(":").map(decodeURIComponent);
      if (id !== CLIENT_ID || secreto !== CLIENT_SECRET) return json(res, 401, { error: "invalid_client" });
      const datos = codigos.get(cuerpo.get("code") ?? "");
      codigos.delete(cuerpo.get("code") ?? "");
      if (!datos || datos.vence < Date.now() || datos.redirect !== cuerpo.get("redirect_uri")) return json(res, 400, { error: "invalid_grant" });
      if (datos.challenge) {
        const calculado = b64url(createHash("sha256").update(cuerpo.get("code_verifier") ?? "").digest());
        if (datos.metodo !== "S256" || calculado !== datos.challenge) return json(res, 400, { error: "invalid_grant", error_description: "PKCE inválido" });
      }
      const ahora = Math.floor(Date.now() / 1000);
      const accessToken = randomBytes(24).toString("hex");
      accesos.set(accessToken, datos);
      const idToken = firmar({
        iss: ISSUER, aud: CLIENT_ID, sub: datos.sub, iat: ahora, exp: ahora + 300, nonce: datos.nonce,
        email: datos.email, email_verified: !datos.email.includes("+noverificado"), name: datos.email.split("@")[0],
      });
      return json(res, 200, { access_token: accessToken, token_type: "Bearer", expires_in: 300, id_token: idToken });
    }

    if (url.pathname === "/userinfo") {
      const datos = accesos.get((req.headers.authorization ?? "").replace(/^Bearer\s+/i, ""));
      if (!datos) return json(res, 401, { error: "invalid_token" });
      return json(res, 200, { sub: datos.sub, email: datos.email, email_verified: !datos.email.includes("+noverificado") });
    }
    json(res, 404, { error: "not_found" });
  } catch (error) {
    json(res, 500, { error: "server_error", error_description: String(error?.message ?? error) });
  }
}).listen(PUERTO, () => console.log(`Proveedor OIDC de prueba en ${PUERTO} (issuer ${ISSUER}, público ${PUBLICO})`));
