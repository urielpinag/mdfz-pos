# Super Importante
POS super ultra mega vibe codeado

# POS MDFZ - Sistema Punto de Venta

Sistema de Punto de Venta minimalista con tres roles: **Admin**, **Supervisor** y **Vendedor**.

## Stack

- **Framework:** SvelteKit + Tailwind CSS v4
- **Base de Datos:** PostgreSQL con Drizzle ORM
- **Auth:** JWT en cookies (httpOnly, secure), expiración 24h
- **Entorno:** NixOS (Nix Flakes)

## Instalación paso a paso

### 1. Entrar al entorno de desarrollo

```bash
nix develop
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar la base de datos

Asegúrate de que PostgreSQL esté corriendo en `localhost:5432` con el usuario admin `postgres` y contraseña `AnPi3412`.

```bash
chmod +x setup-db.sh
bash setup-db.sh
```

Esto crea la base de datos `pos_db` y el usuario `pos_user`.

### 4. Sincronizar el esquema con la base de datos

```bash
npm run db:push
```

### 5. Poblar datos iniciales (seed)

```bash
npm run db:seed
```

Crea 3 usuarios y 8 productos de ejemplo.

### 6. Iniciar el servidor de desarrollo

```bash
npm run dev
```

Abre http://localhost:5173

## Usuarios por defecto

| Usuario      | Contraseña | Rol        | PIN  |
| ------------ | ---------- | ---------- | ---- |
| `admin`      | `1234`     | admin      | 0000 |
| `supervisor` | `1234`     | supervisor | 0000 |
| `vendedor`   | `1234`     | vendedor   | 0000 |

## Rutas

| Ruta               | Acceso                 | Descripción                              |
| ------------------ | ---------------------- | ---------------------------------------- |
| `/login`           | Público                | Inicio de sesión (contraseña de 4 dígitos) |
| `/vender`          | Todos los roles        | POS: grid de productos, carrito, cobrar  |
| `/inventario`      | Admin, Supervisor      | CRUD de productos                        |
| `/admin/dashboard` | Admin                  | Gestión de usuarios, turnos, resumen de ventas |

## Flujo de Corte de Caja

1. El vendedor presiona "Corte de Caja" en `/vender`
2. Se muestra un resumen del turno (ventas, efectivo esperado)
3. Ingresa el efectivo real en caja
4. Se requiere el PIN de un supervisor o admin para validar
5. El turno se cierra y se redirige al login

## Tickets (Impresión Térmica)

Se incluye la utilidad `src/lib/server/ticket.ts` que genera un buffer ESC/POS listo para enviar via WebUSB a una impresora térmica.

## Scripts disponibles

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run preview      # Preview del build
npm run check        # Type checking
npm run db:push      # Sincronizar esquema -> DB
npm run db:generate  # Generar migraciones
npm run db:migrate   # Ejecutar migraciones
npm run db:seed      # Poblar datos iniciales
```
