import type { PageServerLoad, Actions } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { users, shifts, orders, orderItems, products, areas } from '$lib/server/db/schema.js';
import { eq, desc, sql, gte, lte, and } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';

export const load: PageServerLoad = async ({ url, locals }) => {
	const allUsers = await db
		.select({
			id: users.id,
			username: users.username,
			role: users.role,
			createdAt: users.createdAt
		})
		.from(users);

	const userMap = Object.fromEntries(allUsers.map(u => [u.id, u.username]));

	const allAreas = await db.select().from(areas);

	const productCounts = await db
		.select({ areaId: products.areaId, count: sql<number>`count(*)::int` })
		.from(products)
		.groupBy(products.areaId);
	const areaProductCount: Record<number, number> = {};
	for (const row of productCounts) {
		if (row.areaId != null) areaProductCount[row.areaId] = row.count;
	}

	const recentShifts = await db
		.select()
		.from(shifts)
		.orderBy(desc(shifts.apertura))
		.limit(50);

	// Orders with filtering
	const dateFrom = url.searchParams.get('from');
	const dateTo = url.searchParams.get('to');
	const filterUser = url.searchParams.get('user');
	const filterMetodo = url.searchParams.get('metodo');

	const conditions = [];
	if (dateFrom) {
		const [year, month, day] = dateFrom.split('-').map(Number);
		conditions.push(gte(orders.createdAt, new Date(year, month - 1, day, 0, 0, 0, 0)));
	}
	if (dateTo) {
		const [year, month, day] = dateTo.split('-').map(Number);
		conditions.push(lte(orders.createdAt, new Date(year, month - 1, day, 23, 59, 59, 999)));
	}
	if (filterUser) conditions.push(eq(orders.userId, parseInt(filterUser)));
	if (filterMetodo && ['efectivo', 'tarjeta', 'transferencia'].includes(filterMetodo)) {
		conditions.push(eq(orders.metodoPago, filterMetodo as 'efectivo' | 'tarjeta' | 'transferencia'));
	}

	const allOrders = await db
		.select()
		.from(orders)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(orders.createdAt))
		.limit(200);

	// Get order items for detail
	const orderIds = allOrders.map(o => o.id);
	let allOrderItems: { orderId: number; productId: number; cantidad: number; precioUnitario: string; productName: string }[] = [];
	if (orderIds.length > 0) {
		const items = await db
			.select({
				orderId: orderItems.orderId,
				productId: orderItems.productId,
				cantidad: orderItems.cantidad,
				precioUnitario: orderItems.precioUnitario,
				productName: products.nombre
			})
			.from(orderItems)
			.leftJoin(products, eq(orderItems.productId, products.id));

		allOrderItems = items
			.filter(i => orderIds.includes(i.orderId))
			.map(i => ({ ...i, productName: i.productName ?? 'Producto eliminado' }));
	}

	return {
		role: locals.user!.role,
		users: allUsers,
		userMap,
		areas: allAreas,
		areaProductCount,
		shifts: recentShifts,
		orders: allOrders,
		orderItems: allOrderItems,
		filters: { from: dateFrom, to: dateTo, user: filterUser, metodo: filterMetodo }
	};
};

export const actions: Actions = {
	createUser: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') return fail(403, { error: 'No autorizado' });
		const formData = await request.formData();
		const username = formData.get('username') as string;
		const pin = formData.get('pin') as string;
		const role = formData.get('role') as 'admin' | 'supervisor' | 'vendedor';

		if (!username || !pin || !role) {
			return fail(400, { error: 'Todos los campos son requeridos' });
		}

		const pinHash = await bcrypt.hash(pin, 10);

		try {
			await db.insert(users).values({ username, role, pin: pinHash });
		} catch {
			return fail(400, { error: 'El usuario ya existe' });
		}

		return { success: true };
	},

	updateUser: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') return fail(403, { error: 'No autorizado' });
		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);
		const username = formData.get('username') as string;
		const role = formData.get('role') as 'admin' | 'supervisor' | 'vendedor';
		const pin = formData.get('pin') as string;

		const updates: Record<string, any> = { username, role };
		if (pin) {
			updates.pin = await bcrypt.hash(pin, 10);
		}

		await db.update(users).set(updates).where(eq(users.id, id));
		return { success: true };
	},

	resetPin: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') return fail(403, { error: 'No autorizado' });
		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);
		const pinHash = await bcrypt.hash('0000', 10);
		await db.update(users).set({ pin: pinHash }).where(eq(users.id, id));
		return { resetSuccess: true };
	},

	deleteUser: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') return fail(403, { error: 'No autorizado' });
		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);
		const adminId = locals.user!.id;

		if (id === adminId) {
			return fail(400, { error: 'No puedes eliminarte a ti mismo' });
		}

		// Reassign shifts owned by this user to the admin
		await db.update(shifts).set({ userId: adminId }).where(eq(shifts.userId, id));
		// Reassign supervisor references to the admin
		await db.update(shifts).set({ supervisorId: adminId }).where(eq(shifts.supervisorId, id));
		// Reassign orders to the admin
		await db.update(orders).set({ userId: adminId }).where(eq(orders.userId, id));
		// Now safe to delete the user
		await db.delete(users).where(eq(users.id, id));

		return { success: true };
	},

	deleteOrder: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') return fail(403, { error: 'No autorizado' });
		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);
		// Delete order items first, then order
		await db.delete(orderItems).where(eq(orderItems.orderId, id));
		await db.delete(orders).where(eq(orders.id, id));
		return { success: true };
	},

	updateOrder: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') return fail(403, { error: 'No autorizado' });
		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);
		const total = formData.get('total') as string;
		const metodoPago = formData.get('metodoPago') as 'efectivo' | 'tarjeta' | 'transferencia';
		await db.update(orders).set({ total, metodoPago }).where(eq(orders.id, id));
		return { success: true };
	},

	deleteShift: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') return fail(403, { error: 'No autorizado' });
		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);
		// Delete related orders and their items first
		const shiftOrders = await db.select({ id: orders.id }).from(orders).where(eq(orders.shiftId, id));
		for (const o of shiftOrders) {
			await db.delete(orderItems).where(eq(orderItems.orderId, o.id));
		}
		await db.delete(orders).where(eq(orders.shiftId, id));
		await db.delete(shifts).where(eq(shifts.id, id));
		return { success: true };
	},

	updateShift: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') return fail(403, { error: 'No autorizado' });
		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);
		const montoEsperado = formData.get('montoEsperado') as string;
		const montoTarjeta = formData.get('montoTarjeta') as string;
		const montoTransferencia = formData.get('montoTransferencia') as string;
		const montoReal = formData.get('montoReal') as string;
		const updates: Record<string, any> = {};
		if (montoEsperado) updates.montoEsperado = montoEsperado;
		if (montoTarjeta) updates.montoTarjeta = montoTarjeta;
		if (montoTransferencia) updates.montoTransferencia = montoTransferencia;
		if (montoReal) updates.montoReal = montoReal;
		if (Object.keys(updates).length > 0) {
			await db.update(shifts).set(updates).where(eq(shifts.id, id));
		}
		return { success: true };
	},

	createArea: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') return fail(403, { error: 'No autorizado' });
		const formData = await request.formData();
		const nombre = formData.get('nombre') as string;
		if (!nombre) return fail(400, { error: 'El nombre es requerido' });
		try {
			await db.insert(areas).values({ nombre });
		} catch {
			return fail(400, { error: 'El área ya existe' });
		}
		return { success: true };
	},

	deleteArea: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') return fail(403, { error: 'No autorizado' });
		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);
		// Unlink products from this area first
		await db.update(products).set({ areaId: null }).where(eq(products.areaId, id));
		await db.delete(areas).where(eq(areas.id, id));
		return { success: true };
	},

	updateArea: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') return fail(403, { error: 'No autorizado' });
		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);
		const nombre = formData.get('nombre') as string;
		const activo = formData.get('activo') === 'true';
		const imprimirComanda = formData.get('imprimirComanda') === 'true';
		await db.update(areas).set({ nombre, activo, imprimirComanda }).where(eq(areas.id, id));
		return { success: true };
	},

	importCSV: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') return fail(403, { error: 'No autorizado' });
		const formData = await request.formData();
		const file = formData.get('csvFile') as File;
		const assignUserId = parseInt(formData.get('assignUserId') as string);

		if (!file || !assignUserId) {
			return fail(400, { error: 'Archivo CSV y usuario son requeridos' });
		}

		const csvText = await file.text();
		// Remove BOM if present
		const cleanText = csvText.replace(/^\uFEFF/, '');
		const lines = cleanText.split('\n').filter(l => l.trim());

		if (lines.length < 2) {
			return fail(400, { error: 'El archivo CSV está vacío o no tiene registros' });
		}

		// Skip header
		const dataLines = lines.slice(1);

		// Parse CSV rows — handle quoted fields properly
		function parseCSVLine(line: string): string[] {
			const fields: string[] = [];
			let current = '';
			let inQuotes = false;
			for (let i = 0; i < line.length; i++) {
				const ch = line[i];
				if (ch === '"') {
					inQuotes = !inQuotes;
				} else if (ch === ',' && !inQuotes) {
					fields.push(current.trim());
					current = '';
				} else {
					current += ch;
				}
			}
			fields.push(current.trim());
			return fields;
		}

		// Parse date: "13/3/2026, 9:54:46 p.m." -> Date
		function parseDate(dateStr: string): Date {
			// dateStr comes as two CSV fields merged: "13/3/2026" and " 9:54:46 p.m."
			// But since the date contains a comma, we receive it already split
			// We'll handle this in the row parsing
			return new Date(dateStr);
		}

		// Parse rows — note the date field contains a comma so it spans 2 CSV columns
		// Columns: ID, Fecha(date part), Fecha(time part), Usuario, Método de Pago, Total, Productos
		interface CSVRow {
			id: number;
			fecha: Date;
			metodoPago: 'efectivo' | 'tarjeta' | 'transferencia';
			total: number;
			productos: { cantidad: number; nombre: string }[];
		}

		const rows: CSVRow[] = [];

		for (const line of dataLines) {
			const fields = parseCSVLine(line);
			if (fields.length < 7) continue;

			const [idStr, datePart, timePart, _usuario, metodoPago, totalStr, productosStr] = fields;

			// Parse "13/3/2026" + "9:54:46 p.m." -> Date
			const [day, month, year] = datePart.split('/').map(Number);
			const timeClean = timePart.trim();
			const isPM = timeClean.toLowerCase().includes('p.m.');
			const isAM = timeClean.toLowerCase().includes('a.m.');
			const timeOnly = timeClean.replace(/\s*(a\.m\.|p\.m\.)\s*/gi, '').trim();
			const [hours, minutes, seconds] = timeOnly.split(':').map(Number);

			let hour24 = hours;
			if (isPM && hours !== 12) hour24 = hours + 12;
			if (isAM && hours === 12) hour24 = 0;

			const fecha = new Date(year, month - 1, day, hour24, minutes, seconds);

			// Parse products: "4x LLAVERO - COLORES; 1x SEPARADORES - COLORES"
			const productos = productosStr.split(';').map(p => p.trim()).filter(Boolean).map(p => {
				const match = p.match(/^(\d+)x\s+(.+)$/);
				if (!match) return null;
				return { cantidad: parseInt(match[1]), nombre: match[2].trim() };
			}).filter(Boolean) as { cantidad: number; nombre: string }[];

			rows.push({
				id: parseInt(idStr),
				fecha,
				metodoPago: metodoPago as 'efectivo' | 'tarjeta' | 'transferencia',
				total: parseFloat(totalStr),
				productos
			});
		}

		if (rows.length === 0) {
			return fail(400, { error: 'No se encontraron registros válidos en el CSV' });
		}

		// Load all products from DB for name matching
		const allProducts = await db.select().from(products);
		const productByName: Record<string, typeof allProducts[0]> = {};
		for (const p of allProducts) {
			productByName[p.nombre.toUpperCase()] = p;
		}

		// Check that all product names exist
		const missingProducts: string[] = [];
		for (const row of rows) {
			for (const item of row.productos) {
				if (!productByName[item.nombre.toUpperCase()]) {
					if (!missingProducts.includes(item.nombre)) {
						missingProducts.push(item.nombre);
					}
				}
			}
		}

		if (missingProducts.length > 0) {
			return fail(400, { error: `Productos no encontrados en la BD: ${missingProducts.join(', ')}` });
		}

		// Sort rows by date ascending to find first and last
		rows.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
		const firstDate = rows[0].fecha;
		const lastDate = rows[rows.length - 1].fecha;

		// Calculate shift totals by payment method
		let montoEfectivo = 0;
		let montoTarjeta = 0;
		let montoTransferencia = 0;
		for (const row of rows) {
			if (row.metodoPago === 'efectivo') montoEfectivo += row.total;
			else if (row.metodoPago === 'tarjeta') montoTarjeta += row.total;
			else if (row.metodoPago === 'transferencia') montoTransferencia += row.total;
		}

		// Create shift
		const [newShift] = await db.insert(shifts).values({
			apertura: firstDate,
			cierre: lastDate,
			userId: assignUserId,
			montoEsperado: montoEfectivo.toFixed(2),
			montoTarjeta: montoTarjeta.toFixed(2),
			montoTransferencia: montoTransferencia.toFixed(2)
		}).returning();

		// Create orders and order items, deduct stock
		let importedCount = 0;
		for (const row of rows) {
			const [order] = await db.insert(orders).values({
				total: row.total.toFixed(2),
				metodoPago: row.metodoPago,
				userId: assignUserId,
				shiftId: newShift.id,
				createdAt: row.fecha
			}).returning();

			for (const item of row.productos) {
				const product = productByName[item.nombre.toUpperCase()];
				await db.insert(orderItems).values({
					orderId: order.id,
					productId: product.id,
					cantidad: item.cantidad,
					precioUnitario: product.precio
				});

				// Deduct stock
				await db
					.update(products)
					.set({ stock: sql`${products.stock} - ${item.cantidad}` })
					.where(eq(products.id, product.id));
			}
			importedCount++;
		}

		return { importSuccess: true, importedCount, shiftId: newShift.id };
	}
};
