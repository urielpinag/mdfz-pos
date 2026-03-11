import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET ?? 'pos-mdfz-jwt-secret-k3y-2024-s3cur3';

export interface TokenPayload {
	id: number;
	username: string;
	role: 'admin' | 'supervisor' | 'vendedor';
}

export function createToken(user: TokenPayload): string {
	return jwt.sign(
		{ id: user.id, username: user.username, role: user.role },
		JWT_SECRET,
		{ expiresIn: '24h' }
	);
}

export function verifyToken(token: string): TokenPayload | null {
	try {
		return jwt.verify(token, JWT_SECRET) as TokenPayload;
	} catch {
		return null;
	}
}

export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	return bcrypt.compare(password, hash);
}
