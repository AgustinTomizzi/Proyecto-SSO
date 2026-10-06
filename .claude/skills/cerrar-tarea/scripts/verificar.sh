#!/usr/bin/env bash
# Lint y build de los dos frontends y php -l de la API. Sale distinto de 0 si algo falla.
cd "$(git rev-parse --show-toplevel)" || exit 1
rc=0
for app in Galisencia Galiservas; do
  out=$(cd "$app/Frontend" && npm run lint 2>&1); e=$?
  echo "[$app] lint exit=$e"; [ $e -ne 0 ] && { echo "$out" | tail -20; rc=1; }
  out=$(cd "$app/Frontend" && npm run build 2>&1); e=$?
  echo "[$app] build exit=$e"; [ $e -ne 0 ] && { echo "$out" | tail -30; rc=1; }
done
PHP=$(command -v php || { [ -x /c/xampp/php/php.exe ] && echo /c/xampp/php/php.exe; })
if [ -z "$PHP" ]; then
  echo "[php -l] NO SE EJECUTÓ: php no está en el PATH (el CI lo corre igual)"
else
  bad=0
  while IFS= read -r f; do "$PHP" -l "$f" >/dev/null 2>&1 || { "$PHP" -l "$f"; bad=1; }; done < <(find Galisencia/Galileo_Auth -name '*.php' -not -path '*/vendor/*')
  echo "[php -l] $([ $bad -eq 0 ] && echo ok || echo FALLA)"; [ $bad -ne 0 ] && rc=1
fi
exit $rc
