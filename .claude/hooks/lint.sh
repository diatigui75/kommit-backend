#!/usr/bin/env bash
# Hook Stop : lance `pnpm lint` quand Claude a fini de répondre.
# Si le lint échoue, renvoie les erreurs à Claude (exit 2) pour qu'il les corrige.

input=$(cat)

# Claude est déjà relancé par ce hook : on ne bloque pas une 2e fois, pour éviter une boucle.
if echo "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 0

if ! output=$(pnpm --silent lint 2>&1); then
  echo "pnpm lint a échoué, corrige ces erreurs :" >&2
  echo "$output" >&2
  exit 2
fi

exit 0
