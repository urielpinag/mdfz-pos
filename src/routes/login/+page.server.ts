import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { users } from '$lib/server/db/schema.js';
import { createToken } from '$lib/server/auth.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const formData = await request.formData();
		const username = formData.get('username') as string;
		const pin = formData.get('pin') as string;

		if (!username || !pin) {
			return fail(400, { error: 'Usuario y PIN son requeridos' });
		}

		const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

		if (!user) {
			return fail(401, { error: 'Credenciales incorrectas' });
		}

		const valid = await bcrypt.compare(pin, user.pin);
		if (!valid) {
			return fail(401, { error: 'Credenciales incorrectas' });
		}

		const token = createToken({ id: user.id, username: user.username, role: user.role });

		cookies.set('token', token, {
			path: '/',
			httpOnly: true,
			secure: url.protocol === 'https:',
			sameSite: 'strict',
			maxAge: 60 * 60 * 24 // 24 hours
		});

		throw redirect(302, '/vender');
	}
};
