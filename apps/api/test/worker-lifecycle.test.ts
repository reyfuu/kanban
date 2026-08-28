import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The worker must outlive its own bootstrap.
 *
 * It did not, for a while, and the way it failed is the reason this test exists
 * rather than a comment. Under Node a registered SIGTERM handler is itself a
 * reason for the process to stay running, so a promise that only ever settles
 * from a signal handler was enough to keep the worker alive. Bun does not count
 * signal handlers as event-loop references, so the same code printed "SIGAP
 * worker siap" and exited perhaps a millisecond later.
 *
 * Nothing about that looked broken. The startup line still appeared in
 * `.dev/worker.log`, so the log of a dead worker was byte-identical to the log
 * of a healthy one; only `dev.sh status` showed "stopped", and only because it
 * checks the process table instead of the log. A unit test cannot catch this at
 * all -- the bug lives in whether the process stays up, which is observable only
 * by starting one and watching the clock.
 *
 * So this spawns the real entrypoint under the real runtime and asserts both
 * halves of the contract: it stays alive with no queues to consume, and it still
 * exits promptly on SIGTERM rather than needing to be killed.
 */

const WORKER = fileURLToPath(new URL('../src/worker.ts', import.meta.url))
const API_DIR = fileURLToPath(new URL('..', import.meta.url))

// Long enough that an immediate exit is unambiguous, short enough to keep the
// suite quick. The regression exited within milliseconds of printing "siap".
const ALIVE_MS = 3_000
const SHUTDOWN_MS = 10_000

describe('worker · tetap hidup tanpa antrean (ADR-08)', () => {
  it(
    'tidak keluar sendiri setelah bootstrap, lalu berhenti saat SIGTERM',
    async () => {
      // `cwd` is apps/api on purpose: Bun reads tsconfig.json from the working
      // directory, and only that one enables the decorator metadata NestJS
      // needs. Running from the repo root fails inside node_modules with
      // "undefined is not an object (evaluating 'descriptor.value')".
      // Spawned with `bun` by name, not `process.execPath`. Vitest itself runs
      // under Node here, so execPath would start the worker on the wrong
      // runtime -- which fails on the very first import (`./load-env.js` does
      // not exist on disk; Bun resolves it to the .ts source) and would have
      // made this test report a runtime mismatch as a lifecycle bug.
      const child = spawn('bun', [WORKER], {
        cwd: API_DIR,
        env: { ...process.env, NODE_ENV: 'development' },
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let exitedEarly = false
      let exitSignal: string | null = null
      child.once('exit', (_code, signal) => {
        exitedEarly = true
        exitSignal = signal
      })

      let output = ''
      child.stdout.on('data', (b: Buffer) => (output += b.toString()))
      child.stderr.on('data', (b: Buffer) => (output += b.toString()))

      await new Promise((r) => setTimeout(r, ALIVE_MS))

      expect(
        exitedEarly,
        `worker keluar sendiri sebelum ${ALIVE_MS}ms. Keluaran:\n${output}`,
      ).toBe(false)
      expect(output, `worker tidak pernah melaporkan siap. Keluaran:\n${output}`).toContain(
        'SIGAP worker siap',
      )

      // The other half: keeping the loop open must not make it unkillable.
      const stopped = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`worker tidak berhenti dalam ${SHUTDOWN_MS}ms`)),
          SHUTDOWN_MS,
        )
        child.once('exit', () => {
          clearTimeout(timer)
          resolve()
        })
      })

      child.kill('SIGTERM')
      await stopped

      // The shutdown must be the handled kind, not the process being cut down
      // where it stood. The log line is the evidence: it is only written from
      // inside the handler, so it cannot appear if the signal killed the
      // process outright.
      //
      // Note what is deliberately NOT asserted: that the exit signal is null.
      // `enableShutdownHooks` re-raises the same signal via
      // `process.kill(process.pid, signal)` once the context has closed, so a
      // correctly shut-down worker still reports SIGTERM to its parent. That
      // was read out of @nestjs/core rather than guessed, after this assertion
      // failed against a worker that had in fact shut down perfectly.
      expect(output, `worker tidak menjalankan penanganan SIGTERM:\n${output}`).toContain(
        'Menerima SIGTERM',
      )
      expect(exitSignal === null || exitSignal === 'SIGTERM').toBe(true)
    },
    SHUTDOWN_MS + ALIVE_MS + 20_000,
  )
})
