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
	if (dateFrom) conditions.push(gte(orders.createdAt, new Date(dateFrom)));
	if (dateTo) {
		const toDate = new Date(dateTo);
		toDate.setHours(23, 59, 59, 999);
		conditions.push(lte(orders.createdAt, toDate));
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
	}
};
