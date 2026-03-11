import { verifyToken } from '$lib/server/auth.js';
import { redirect, type Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get('token');

	if (token) {
		const payload = verifyToken(token);
		event.locals.user = payload;
	} else {
		event.locals.user = null;
	}

	const path = event.url.pathname;

	// Public routes
	if (path === '/login' || path.startsWith('/api/auth')) {
		if (event.locals.user && path === '/login') {
			throw redirect(302, event.locals.user.role === 'admin' ? '/admin/dashboard' : '/vender');
		}
		return resolve(event);
	}

	// All other routes require auth
	if (!event.locals.user) {
		throw redirect(302, '/login');
	}

	// Admin routes: admin and supervisor
	if (path.startsWith('/admin') && event.locals.user.role === 'vendedor') {
		throw redirect(302, '/vender');
	}

	// Vender: only supervisor and vendedor (admin cannot sell)
	if (path.startsWith('/vender') && event.locals.user.role === 'admin') {
		throw redirect(302, '/admin/dashboard');
	}

	// Inventory: admin and supervisor only
	if (path.startsWith('/inventario') && event.locals.user.role === 'vendedor') {
		throw redirect(302, '/vender');
	}

	return resolve(event);
};
