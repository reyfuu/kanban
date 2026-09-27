import { cookies } from 'next/headers';
import { readSession, SESSION_COOKIE } from '../../../lib/auth';
import { parseBackup } from '../../../lib/backup';
import { redis } from '../../../lib/redis';

async function currentUser() {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** The signed-in player's board as a backup document; 204 when nothing is stored yet. */
export async function GET() {
  const user = await currentUser();
  if (!user) return new Response(null, { status: 401 });
  const data = await redis<string | null>('GET', `data:${user}`);
  return new Response(data, { status: data ? 200 : 204, headers: { 'content-type': 'application/json', 'x-user': user } });
}

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return new Response(null, { status: 401 });
  const text = await request.text();
  if (text.length > 2 * 1024 * 1024) return new Response('Data terlalu besar.', { status: 413 });
  try { parseBackup(text); } catch { return new Response('Data tidak valid.', { status: 400 }); }
  await redis('SET', `data:${user}`, text);
  return new Response(null, { status: 204 });
}
