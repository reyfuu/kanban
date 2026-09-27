/** Minimal Upstash Redis REST client: one command per request. */
export async function redis<T = unknown>(...command: (string | number)[]): Promise<T> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Database Upstash Redis belum diatur di server (KV_REST_API_URL/KV_REST_API_TOKEN).', { cause: 'config' });
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(command), cache: 'no-store' });
  const body = await response.json() as { result?: T; error?: string };
  if (!response.ok || body.error) throw new Error(body.error ?? `Redis ${response.status}`);
  return body.result as T;
}
