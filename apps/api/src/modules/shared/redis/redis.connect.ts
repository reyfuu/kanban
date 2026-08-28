import type Redis from 'ioredis'

/**
 * Brings a `lazyConnect` client up before its first command.
 *
 * Every Redis client here is created with `lazyConnect` and
 * `enableOfflineQueue: false` -- deliberately, so that a Redis outage fails a
 * request loudly instead of queueing commands that appear to succeed. The cost
 * of that choice is that the first command on a cold client would fail unless
 * something connects first, and the concurrent case is worse: two requests
 * arriving together would both call `connect()`, and the second throws
 * "Redis is already connecting".
 *
 * One function, shared, rather than the same fifteen lines in each service:
 * connection lifecycle is precisely the sort of code that gets copied once and
 * then fixed in only one of the copies.
 */
export async function ensureRedisReady(redis: Redis): Promise<void> {
  if (redis.status === 'ready') return

  if (redis.status === 'connecting' || redis.status === 'connect') {
    await new Promise<void>((resolve, reject) => {
      redis.once('ready', resolve)
      redis.once('error', reject)
    })
    return
  }

  await redis.connect()
}
