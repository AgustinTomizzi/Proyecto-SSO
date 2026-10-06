<?php

/*
 * Cliente SMTP mínimo (sin dependencias) para el worker de notificaciones.
 * Configuración por entorno:
 *   SMTP_HOST        servidor (vacío = envío deshabilitado)
 *   SMTP_PORT        25, 587 (STARTTLS) o 465 (TLS directo)
 *   SMTP_SECURE      "starttls", "tls" o "none"
 *   SMTP_USER/PASS   credenciales (opcionales; AUTH LOGIN)
 *   SMTP_FROM        remitente, por ejemplo "Galileo <no-responder@escuela.edu.ar>"
 */

final class SmtpError extends RuntimeException
{
}

function smtp_config()
{
    return [
        "host" => trim((string) getenv("SMTP_HOST")),
        "port" => (int) (getenv("SMTP_PORT") ?: 587),
        "secure" => strtolower(trim((string) (getenv("SMTP_SECURE") ?: "starttls"))),
        "user" => (string) getenv("SMTP_USER"),
        "pass" => (string) getenv("SMTP_PASS"),
        "from" => trim((string) (getenv("SMTP_FROM") ?: "Galileo <no-responder@galileo.local>")),
    ];
}

/** Separa "Nombre <correo>" en [correo, encabezado From]. */
function smtp_remitente($from)
{
    if (preg_match('/^\s*(.*?)\s*<([^>]+)>\s*$/', $from, $m)) {
        $nombre = trim($m[1], " \"");
        return [$m[2], $nombre === "" ? $m[2] : "=?UTF-8?B?" . base64_encode($nombre) . "?= <{$m[2]}>"];
    }
    return [$from, $from];
}

final class SmtpCliente
{
    /** @var resource */
    private $socket;

    public function __construct(private array $cfg)
    {
        $transporte = $cfg["secure"] === "tls" ? "ssl" : "tcp";
        $socket = @stream_socket_client("$transporte://{$cfg["host"]}:{$cfg["port"]}", $errno, $error, 15);
        if (!$socket) {
            throw new SmtpError("no se pudo conectar a {$cfg["host"]}:{$cfg["port"]} ($error)");
        }
        stream_set_timeout($socket, 20);
        $this->socket = $socket;
        $this->esperar([220]);
        $this->ehlo();
        if ($cfg["secure"] === "starttls") {
            $this->comando("STARTTLS", [220]);
            if (!stream_socket_enable_crypto($this->socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new SmtpError("no se pudo iniciar TLS");
            }
            $this->ehlo();
        }
        if ($cfg["user"] !== "") {
            $this->comando("AUTH LOGIN", [334]);
            $this->comando(base64_encode($cfg["user"]), [334]);
            $this->comando(base64_encode($cfg["pass"]), [235]);
        }
    }

    private function ehlo()
    {
        $this->comando("EHLO " . (gethostname() ?: "galileo"), [250]);
    }

    private function esperar(array $codigos)
    {
        $respuesta = "";
        while (($linea = fgets($this->socket, 1024)) !== false) {
            $respuesta .= $linea;
            if (strlen($linea) < 4 || $linea[3] !== "-") {
                break;
            }
        }
        $codigo = (int) substr($respuesta, 0, 3);
        if (!in_array($codigo, $codigos, true)) {
            throw new SmtpError("respuesta SMTP inesperada: " . trim(substr($respuesta, 0, 200)));
        }
        return $respuesta;
    }

    private function comando($linea, array $codigos)
    {
        fwrite($this->socket, $linea . "\r\n");
        return $this->esperar($codigos);
    }

    /** Envía un mensaje de texto plano UTF-8. */
    public function enviar($para, $asunto, $cuerpo)
    {
        [$correo, $encabezadoFrom] = smtp_remitente($this->cfg["from"]);
        $this->comando("MAIL FROM:<$correo>", [250]);
        $this->comando("RCPT TO:<$para>", [250, 251]);
        $this->comando("DATA", [354]);
        $dominio = substr(strrchr($correo, "@") ?: "@galileo.local", 1);
        $encabezados = [
            "Date: " . date(DATE_RFC2822),
            "From: $encabezadoFrom",
            "To: <$para>",
            "Subject: =?UTF-8?B?" . base64_encode($asunto) . "?=",
            "Message-ID: <" . bin2hex(random_bytes(12)) . "@$dominio>",
            "MIME-Version: 1.0",
            "Content-Type: text/plain; charset=UTF-8",
            "Content-Transfer-Encoding: base64",
            "Auto-Submitted: auto-generated",
        ];
        $mensaje = implode("\r\n", $encabezados) . "\r\n\r\n" . rtrim(chunk_split(base64_encode($cuerpo), 76, "\r\n")) . "\r\n.";
        $this->comando($mensaje, [250]);
    }

    public function cerrar()
    {
        if (is_resource($this->socket)) {
            @fwrite($this->socket, "QUIT\r\n");
            fclose($this->socket);
        }
    }
}
