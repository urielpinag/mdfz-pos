import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';

const logout: RequestHandler = async ({ cookies }) => {
	cookies.delete('token', { path: '/' });
	throw redirect(302, '/login');
};

export const POST = logout;
export const GET = logout;
