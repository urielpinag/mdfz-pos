import type { PageServerLoad, Actions } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { products, orderItems, areas } from '$lib/server/db/schema.js';
import { eq, sql, desc } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
	const allProducts = await db.select().from(products);
	const allAreas = await db.select().from(areas);

	// Most-sold products stats
	const topProducts = await db
		.select({
			productId: orderItems.productId,
			nombre: products.nombre,
			totalVendido: sql<number>`cast(sum(${orderItems.cantidad}) as int)`,
			ingresos: sql<string>`cast(sum(${orderItems.cantidad} * ${orderItems.precioUnitario}) as numeric(10,2))`
		})
		.from(orderItems)
		.leftJoin(products, eq(orderItems.productId, products.id))
		.groupBy(orderItems.productId, products.nombre)
		.orderBy(desc(sql`sum(${orderItems.cantidad})`))
		.limit(10);

	return { products: allProducts, areas: allAreas, topProducts };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const formData = await request.formData();
		const nombre = formData.get('nombre') as string;
		const precio = formData.get('precio') as string;
		const stock = parseInt(formData.get('stock') as string);
		const areaIdStr = formData.get('areaId') as string;
		const areaId = areaIdStr ? parseInt(areaIdStr) : null;

		if (!nombre || !precio || isNaN(stock)) {
			return fail(400, { error: 'Todos los campos son requeridos' });
		}

		await db.insert(products).values({ nombre, precio, stock, areaId });
		return { success: true };
	},

	update: async ({ request }) => {
		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);
		const nombre = formData.get('nombre') as string;
		const precio = formData.get('precio') as string;
		const stock = parseInt(formData.get('stock') as string);
		const activo = formData.get('activo') === 'true';
		const areaIdStr = formData.get('areaId') as string;
		const areaId = areaIdStr ? parseInt(areaIdStr) : null;

		await db
			.update(products)
			.set({ nombre, precio, stock, activo, areaId })
			.where(eq(products.id, id));

		return { success: true };
	},

	delete: async ({ request }) => {
		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);
		await db.delete(products).where(eq(products.id, id));
		return { success: true };
	}
};
