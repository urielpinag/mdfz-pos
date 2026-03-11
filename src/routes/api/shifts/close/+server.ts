import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { users, shifts } from '$lib/server/db/schema.js';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'No autenticado' }, { status: 401 });
	}

	const { pin, montoReal } = await request.json();

	if (!pin || montoReal === undefined) {
		return json({ error: 'PIN y monto real son requeridos' }, { status: 400 });
	}

	// Find supervisors and admins
	const supervisors = await db
		.select()
		.from(users)
		.where(inArray(users.role, ['supervisor', 'admin']));

	// Validate PIN against any supervisor/admin
	let validSupervisor = null;
	for (const sup of supervisors) {
		if (sup.pin && await bcrypt.compare(pin, sup.pin)) {
			validSupervisor = sup;
			break;
		}
	}

	if (!validSupervisor) {
		return json({ error: 'PIN de supervisor inválido' }, { status: 403 });
	}

	// Find active shift for current user
	const [activeShift] = await db
		.select()
		.from(shifts)
		.where(and(eq(shifts.userId, locals.user.id), isNull(shifts.cierre)))
		.limit(1);

	if (!activeShift) {
		return json({ error: 'No hay turno activo' }, { status: 404 });
	}

	// Close the shift
	await db
		.update(shifts)
		.set({
			cierre: new Date(),
			montoReal: parseFloat(montoReal).toFixed(2),
			supervisorId: validSupervisor.id
		})
		.where(eq(shifts.id, activeShift.id));

	return json({ success: true });
};
