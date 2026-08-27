import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SharedModule } from './modules/shared/index.js'
import { EvidenceModule } from './modules/evidence/index.js'
import { AccessModule } from './modules/access/index.js'
import { PolicyModule } from './modules/policy/index.js'

/**
 * ADR-01 — modular monolith.
 *
 * Feature modules are imported here and nowhere else. A module may consume
 * another module only through that module's `index.ts`; the lint rule
 * `import/no-restricted-paths` in eslint.config.mjs fails the build otherwise.
 *
 * Module map (03-FRD):
 *   shared   — FR-X-*  identity, roles, audit trail, notifications, files
 *   evidence — FR-A-*  Modul A · Evidence Vault
 *   access   — FR-B-*  Modul B · Access Review
 *   policy   — FR-C-*  Modul C · Policy Hub
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    SharedModule,
    EvidenceModule,
    AccessModule,
    PolicyModule,
  ],
})
export class AppModule {}
