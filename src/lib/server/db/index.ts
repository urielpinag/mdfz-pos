import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://pos_user:P0s_s3cur3_2024!@localhost:5432/pos_db';

const client = postgres(connectionString);
export const db = drizzle(client, { schema });
