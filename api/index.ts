import { handle } from 'hono/vercel';
import app from '../server/app.js';

// Vercel function entry. vercel.json rewrites every /api/* request here and
// Hono routes it by the original path.
export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
