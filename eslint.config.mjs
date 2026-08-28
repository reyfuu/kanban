import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'

/**
 * ADR-01 enforcement — modular monolith module boundaries.
 *
 * Modules may not reach into each other's internals. The only legal way for one
 * module to consume another is through that module's public interface file
 * (`index.ts`). Everything else is private.
 *
 * The zones below are generated from MODULES rather than written out by hand:
 * adding a module to the list wires up its boundaries in both directions. A
 * hand-written zone list would silently leave a new module unguarded, which is
 * precisely the failure ADR-01 exists to prevent.
 */
export const MODULES = ['shared', 'evidence', 'access', 'policy']
const MODULE_ROOT = './apps/api/src/modules'

const boundaryZones = MODULES.flatMap((target) =>
  MODULES.filter((from) => from !== target).map((from) => ({
    target: `${MODULE_ROOT}/${target}`,
    from: `${MODULE_ROOT}/${from}`,
    except: ['./index.ts'],
    message: `ADR-01: impor lintas modul hanya melalui ${from}/index.ts.`,
  })),
)

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/coverage/**',
      'packages/db/src/generated/**',
      // Harness pengembangan, bukan kode aplikasi. Skrip di sini punya
      // gerbangnya sendiri (verify.py) dan tidak tunduk pada aturan arsitektur
      // yang mengikat aplikasi.
      '.claude/**',
      // Dibangkitkan Next.js pada setiap build dan bertuliskan "do not edit".
      // Melintnya berarti melaporkan galat pada berkas yang tidak boleh diperbaiki.
      'apps/web/next-env.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx,mts}'],
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': {
        typescript: {
          project: ['./tsconfig.json', './apps/*/tsconfig.json', './packages/*/tsconfig.json'],
          noWarnOnMultipleProjects: true,
        },
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  // NestJS resolves constructor dependencies from `design:paramtypes` metadata,
  // which TypeScript only emits for imports kept as VALUES. `import type` erases
  // them, and the failure is a runtime DI error at boot, not a compile error --
  // so the rule that "helps" here actively breaks the application.
  {
    files: ['apps/api/src/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },

  // ADR-01 — module boundaries inside the NestJS monolith.
  {
    files: ['apps/api/src/modules/**/*.ts'],
    plugins: { import: importPlugin },
    rules: {
      'import/no-restricted-paths': ['error', { zones: boundaryZones }],
    },
  },

  // ADR-03 — the LLM Gateway is the only egress to an external language
  // provider. No other file may import a provider SDK directly.
  {
    files: ['apps/api/src/**/*.ts'],
    ignores: ['apps/api/src/modules/shared/llm-gateway/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@google/generative-ai', '@google/genai', 'openai', '@anthropic-ai/*'],
              message:
                'ADR-03: seluruh panggilan ke penyedia bahasa eksternal lewat LLM Gateway. Tidak ada jalur lain.',
            },
          ],
        },
      ],
    },
  },

  // Aturan kode #6 — warna semantik hanya lewat token, tidak pernah heksadesimal
  // langsung. Lihat 06-DESIGN §2.
  //
  // Cakupannya TS/TSX saja: di sanalah heksadesimal menyelinap lewat gaya
  // sebaris dan nilai arbitrer Tailwind. Definisi tokennya sendiri hidup di
  // berkas CSS, yang memang berisi heksadesimal dan tidak dilint di sini.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/]",
          message: 'Gunakan token warna dari 06-DESIGN, bukan nilai heksadesimal langsung.',
        },
      ],
    },
  },

  // Tests assert against JSON payloads whose shape is the thing under test --
  // typing them precisely would restate the assertion in the type system and
  // hide the failure the test exists to catch.
  {
    files: ['**/test/**/*.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
