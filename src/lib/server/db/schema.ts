import { pgTable, serial, varchar, boolean, integer, numeric, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('user_role', ['admin', 'supervisor', 'vendedor']);
export const metodoPagoEnum = pgEnum('metodo_pago', ['efectivo', 'tarjeta', 'transferencia']);

export const users = pgTable('users', {
	id: serial('id').primaryKey(),
	username: varchar('username', { length: 50 }).notNull().unique(),
	role: roleEnum('role').notNull().default('vendedor'),
	pin: varchar('pin', { length: 255 }).notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const areas = pgTable('areas', {
	id: serial('id').primaryKey(),
	nombre: varchar('nombre', { length: 100 }).notNull().unique(),
	activo: boolean('activo').notNull().default(true)
});

export const products = pgTable('products', {
	id: serial('id').primaryKey(),
	nombre: varchar('nombre', { length: 255 }).notNull(),
	precio: numeric('precio', { precision: 10, scale: 2 }).notNull(),
	stock: integer('stock').notNull().default(0),
	activo: boolean('activo').notNull().default(true),
	areaId: integer('area_id').references(() => areas.id)
});

export const shifts = pgTable('shifts', {
	id: serial('id').primaryKey(),
	apertura: timestamp('apertura').defaultNow().notNull(),
	cierre: timestamp('cierre'),
	montoEsperado: numeric('monto_esperado', { precision: 10, scale: 2 }).notNull().default('0'),
	montoTarjeta: numeric('monto_tarjeta', { precision: 10, scale: 2 }).notNull().default('0'),
	montoTransferencia: numeric('monto_transferencia', { precision: 10, scale: 2 }).notNull().default('0'),
	montoReal: numeric('monto_real', { precision: 10, scale: 2 }),
	userId: integer('user_id').notNull().references(() => users.id),
	supervisorId: integer('supervisor_id').references(() => users.id)
});

export const orders = pgTable('orders', {
	id: serial('id').primaryKey(),
	total: numeric('total', { precision: 10, scale: 2 }).notNull(),
	metodoPago: metodoPagoEnum('metodo_pago').notNull(),
	userId: integer('user_id').notNull().references(() => users.id),
	shiftId: integer('shift_id').notNull().references(() => shifts.id),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const orderItems = pgTable('order_items', {
	id: serial('id').primaryKey(),
	orderId: integer('order_id').notNull().references(() => orders.id),
	productId: integer('product_id').notNull().references(() => products.id),
	cantidad: integer('cantidad').notNull(),
	precioUnitario: numeric('precio_unitario', { precision: 10, scale: 2 }).notNull()
});
