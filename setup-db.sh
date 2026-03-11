#!/usr/bin/env bash
set -euo pipefail

PG_HOST="localhost"
PG_PORT="5432"
PG_ADMIN_USER="postgres"
PG_ADMIN_PASS="AnPi3412"

DB_NAME="pos_db"
DB_USER="pos_user"
DB_PASS="P0s_s3cur3_2024!"

export PGPASSWORD="$PG_ADMIN_PASS"

echo "=== Configurando base de datos POS ==="

# Crear usuario si no existe
psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_ADMIN_USER" -tc \
  "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
  psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_ADMIN_USER" -c \
  "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"

echo "✓ Usuario $DB_USER listo"

# Crear base de datos si no existe
psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_ADMIN_USER" -tc \
  "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
  psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_ADMIN_USER" -c \
  "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

echo "✓ Base de datos $DB_NAME lista"

# Otorgar permisos
psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_ADMIN_USER" -c \
  "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_ADMIN_USER" -d "$DB_NAME" -c \
  "GRANT ALL ON SCHEMA public TO $DB_USER;"

echo "✓ Permisos otorgados"
echo "=== Base de datos configurada exitosamente ==="
echo ""
echo "Cadena de conexión:"
echo "postgresql://$DB_USER:$DB_PASS@$PG_HOST:$PG_PORT/$DB_NAME"
