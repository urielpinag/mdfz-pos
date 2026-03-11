import type { PageServerLoad, Actions } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { products, orders, orderItems, shifts, areas } from '$lib/server/db/schema.js';
import { eq, and, isNull, sql, gt } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	const activeProducts = await db
		.select()
		.from(products)
		.where(and(eq(products.activo, true), gt(products.stock, 0)));

	const allAreas = await db
		.select()
		.from(areas)
		.where(eq(areas.activo, true));

	// Find or create active shift for this user
	let [activeShift] = await db
		.select()
		.from(shifts)
		.where(and(eq(shifts.userId, locals.user!.id), isNull(shifts.cierre)))
		.limit(1);

	if (!activeShift) {
		[activeShift] = await db
			.insert(shifts)
			.values({ userId: locals.user!.id, montoEsperado: '0' })
			.returning();
	}

	// Get shift orders for summary
	const shiftOrders = await db
		.select()
		.from(orders)
		.where(eq(orders.shiftId, activeShift.id));

	return {
		products: activeProducts,
		areas: allAreas,
		shift: activeShift,
		shiftOrders
	};
};

export const actions: Actions = {
	cobrar: async ({ request, locals }) => {
		const formData = await request.formData();
		const cartJson = formData.get('cart') as string;
		const metodoPago = formData.get('metodo_pago') as 'efectivo' | 'tarjeta' | 'transferencia';

		if (!cartJson || !metodoPago) {
			return fail(400, { error: 'Datos incompletos' });
		}

		const cart: { id: number; cantidad: number; precio: string }[] = JSON.parse(cartJson);

		if (cart.length === 0) {
			return fail(400, { error: 'El carrito está vacío' });
		}

		// Find active shift
		const [activeShift] = await db
			.select()
			.from(shifts)
			.where(and(eq(shifts.userId, locals.user!.id), isNull(shifts.cierre)))
			.limit(1);

		if (!activeShift) {
			return fail(400, { error: 'No hay turno activo' });
		}

		// Calculate total
		const total = cart.reduce((sum, item) => sum + parseFloat(item.precio) * item.cantidad, 0);

		// Create order
		const [order] = await db
			.insert(orders)
			.values({
				total: total.toFixed(2),
				metodoPago,
				userId: locals.user!.id,
				shiftId: activeShift.id
			})
			.returning();

		// Create order items and update stock
		for (const item of cart) {
			await db.insert(orderItems).values({
				orderId: order.id,
				productId: item.id,
				cantidad: item.cantidad,
				precioUnitario: item.precio
			});

			await db
				.update(products)
				.set({ stock: sql`${products.stock} - ${item.cantidad}` })
				.where(eq(products.id, item.id));
		}

		// Update shift expected amount if cash
		if (metodoPago === 'efectivo') {
			await db
				.update(shifts)
				.set({ montoEsperado: sql`${shifts.montoEsperado}::numeric + ${total.toFixed(2)}::numeric` })
				.where(eq(shifts.id, activeShift.id));
		} else if (metodoPago === 'tarjeta') {
			await db
				.update(shifts)
				.set({ montoTarjeta: sql`${shifts.montoTarjeta}::numeric + ${total.toFixed(2)}::numeric` })
				.where(eq(shifts.id, activeShift.id));
		} else if (metodoPago === 'transferencia') {
			await db
				.update(shifts)
				.set({ montoTransferencia: sql`${shifts.montoTransferencia}::numeric + ${total.toFixed(2)}::numeric` })
				.where(eq(shifts.id, activeShift.id));
		}

		return { success: true, orderId: order.id, total: total.toFixed(2) };
	}
};
