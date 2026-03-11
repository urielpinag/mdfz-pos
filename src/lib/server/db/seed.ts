import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from './schema.js';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://pos_user:P0s_s3cur3_2024!@localhost:5432/pos_db';
const client = postgres(connectionString);
const db = drizzle(client);

async function seed() {
	console.log('Seeding database...');

	const pinHash = await bcrypt.hash('0000', 10);

	// Create admin user
	await db.insert(users).values({
		username: 'admin',
		role: 'admin',
		pin: pinHash
	}).onConflictDoNothing();

	console.log('Seed completed!');
	console.log('Usuario admin creado: admin / PIN: 0000');
	await client.end();
}

seed().catch((e) => {
	console.error('Seed failed:', e);
	process.exit(1);
});
