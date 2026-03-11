import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { users } from '$lib/server/db/schema.js';
import { createToken, verifyPassword } from '$lib/server/auth.js';
import { eq } from 'drizzle-orm';

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const formData = await request.formData();
		const username = formData.get('username') as string;
		const password = formData.get('password') as string;

		if (!username || !password) {
			return fail(400, { error: 'Usuario y contraseña son requeridos' });
		}

		const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

		if (!user) {
			return fail(401, { error: 'Credenciales incorrectas' });
		}

		const valid = await verifyPassword(password, user.passwordHash);
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
