#!/bin/sh
set -e

echo "=========================================================="
echo "    [Matriz Hub - Backoffice API] Iniciando contenedor    "
echo "=========================================================="

echo "[Matriz Hub] Esperando disponibilidad de PostgreSQL Backoffice..."
until pnpm prisma db push --accept-data-loss; do
  echo "[Matriz Hub] PostgreSQL no listo aún para inicializar esquema. Reintentando en 3s..."
  sleep 3
done

echo "[Matriz Hub] Esquema PostgreSQL sincronizado con éxito."

if [ -f "scripts/seed-admin.mjs" ]; then
  echo "[Matriz Hub] Verificando usuario administrador por defecto (TEST)..."
  node scripts/seed-admin.mjs || true
fi

if [ -f "scripts/seed-initial-store.mjs" ]; then
  echo "[Matriz Hub] Verificando registro de tienda inicial (001)..."
  node scripts/seed-initial-store.mjs || true
fi

echo "[Matriz Hub] Arrancando servicio en puerto ${PORT:-3089}..."
exec node dist/main.js
