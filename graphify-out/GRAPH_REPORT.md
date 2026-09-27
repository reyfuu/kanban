# Graph Report - kanban  (2026-09-27)

## Corpus Check
- 66 files · ~1,483,618 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2482 nodes · 5422 edges · 139 communities (123 shown, 16 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 260 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `affec474`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- SigapRequest
- app_user
- ui.tsx
- EvidenceController
- llm-gateway.service.ts
- campaign-builder.service.ts
- evidence-package.service.ts
- auth.service.ts
- evidence-stage2.integration.test.ts
- load-env.ts
- dependencies
- review-board.tsx
- review-decision.service.ts
- seed.ts
- feedback.tsx
- kebijakan/[id]/page.tsx
- detection.service.ts
- engagement.controller.ts
- escalation.service.ts
- policy-attestation.integration.test.ts
- Principal
- Workspace.tsx
- kampanye/[id]/page.tsx
- (app)/page.tsx
- DocumentSearchRepository
- unit-of-work.ts
- PrismaService
- document.service.ts
- verify.py
- RequiresStepUp
- escalation.integration.test.ts
- devDependencies
- SnapshotService
- document.controller.ts
- compilerOptions
- db/package.json
- compilerOptions
- allow
- scripts
- anomaly.controller.ts
- application.controller.ts
- snapshot.controller.ts
- application-form.tsx
- hasPermission
- policy-document.integration.test.ts
- Browser
- main.ts
- ADR-03 LLM Gateway Sole Egress
- compilerOptions
- snapshot-csv.ts
- devDependencies
- FRD — Functional Requirements Document
- requireUser
- wizard.tsx
- apiFetch
- @prisma/client
- access.module.ts
- evidence-item.service.ts
- SIGAP Platform
- evidence.module.ts
- dev.sh
- 2. Epics & User Stories (dengan Acceptance Criteria)
- shared.module.ts
- access-detection.integration.test.ts
- ReviewItemRepository
- EngagementService
- ExternalAccessService
- DocumentApprovalService
- document-chunker.ts
- policy-approval.integration.test.ts
- FRD — Functional Requirements Document
- snapshot-upload.integration.test.ts
- SnapshotUploadService
- snapshot-upload.service.ts
- tiket/actions.ts
- 85 Functional Requirements
- document-diff.ts
- AuditController
- package.json
- compilerOptions
- Ten Critical Controls K-1 to K-10
- TRD — Technical Requirements Document
- eslint.config.mjs
- tsconfig.seed.json
- nest-cli.json
- shared/index.ts
- check-mermaid.mjs
- TRD — Technical Requirements Document
- campaign.service.ts
- Design System: HoyoKanban
- app/layout.tsx
- Design Token System
- BRD — Business Requirements Document
- worker-lifecycle.test.ts
- next.config.mjs
- app/not-found.tsx
- next-env.d.ts
- db-migrator Agent
- TransactionClient
- FindingService
- web/package.json
- CLAUDE.md
- module-c.ts
- RequestItemService
- auth-actions.ts
- models.go
- campaign.controller.ts
- module-b.ts
- document-search.service.ts
- dependencies
- web/vercel.json
- vercel.json
- Product
- SodService
- access-review.integration.test.ts
- Grill Guardian — Spesifikasi & Stress-Testing Desain
- gate.py
- 2. Modul 1: Papan Kanban Build Karakter (FR-KB)
- Sumber data HoyoKanban
- HoyoKanban 🎯
- jejak-audit/actions.ts
- HoyoKanban — Panduan Asisten AI & Pengembangan Sistem
- Backend Implementor — Go 1.22 & Gin Framework
- Frontend Implementor — Next.js 15, React 19 & Vercel Engine
- Graphify Mapper — Arsitektur & Peta Dependensi Kode
- 3. Modul 2: Profil & Target Build Karakter (FR-CH)
- 5. Modul 4: Stamina Hub & Rutinitas Game (FR-ST)
- 9. Modul 8: Manajemen Data & Portabilitas (FR-DM)
- Superpowers: Disciplined Engineering & TDD Workflow
- sync-catalog.py
- hoyokanban-api

## God Nodes (most connected - your core abstractions)
1. `Principal` - 186 edges
2. `SigapRequest` - 172 edges
3. `PrismaService` - 87 edges
4. `UnitOfWork` - 63 edges
5. `@prisma/client` - 41 edges
6. `TransactionClient` - 36 edges
7. `apiFetch()` - 33 edges
8. `runWithRequestContext()` - 32 edges
9. `app_user` - 32 edges
10. `requireUser()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `guardrail-audit Skill` --references--> `33 Guardrails`  [EXTRACTED]
  .claude/skills/guardrail-audit/SKILL.md → docs/09-GUARDRAILS.md
- `Local Infrastructure Stack` --references--> `ADR-02 Hybrid Search in PostgreSQL`  [INFERRED]
  docker-compose.yml → docs/04-TRD.md
- `spec-guardian Agent` --implements--> `Docs Are Source of Truth`  [INFERRED]
  .claude/agents/spec-guardian.md → CLAUDE.md
- `Engineering Handoff Notes` --references--> `Bun Runtime Decision`  [INFERRED]
  HANDOFF.md → README.md
- `security-reviewer Agent` --references--> `Ten Critical Controls K-1 to K-10`  [INFERRED]
  .claude/agents/security-reviewer.md → docs/10-TEST-PLAN.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Audit and Evidence Integrity Stack** — docs_04_trd_adr_04, docs_10_test_plan_k7, docs_10_test_plan_k8, docs_03_frd_fr_x_008, claude_unit_of_work_rule, packages_db_readme_migration_role [EXTRACTED 1.00]
- **LLM Gateway Egress Control Chain** — docs_04_trd_adr_03, docs_03_frd_fr_c_014, docs_03_frd_fr_c_015, docs_03_frd_fr_c_016, docs_03_frd_fr_c_017, docs_04_trd_egress_proxy [EXTRACTED 1.00]
- **Three Modules Sharing One Evidence Store** — docs_00_readme_modul_a, docs_00_readme_modul_b, docs_00_readme_modul_c, docs_00_readme_shared_evidence_store [EXTRACTED 1.00]

## Communities (139 total, 16 thin omitted)

### Community 0 - "SigapRequest"
Cohesion: 0.21
Nodes (4): CampaignController, presentPack(), presentTicket(), SigapRequest

### Community 1 - "app_user"
Cohesion: 0.07
Nodes (53): app_user, audit_log, audit_log_no_delete, audit_log_no_truncate, audit_log_no_update, delegation, employee, notification (+45 more)

### Community 2 - "ui.tsx"
Cohesion: 0.08
Nodes (30): dynamic, STATUS_LABEL, STATUS_TONE, Task, CampaignRow, STATUS_LABEL, STATUS_TONE, Comparison (+22 more)

### Community 3 - "EvidenceController"
Cohesion: 0.09
Nodes (10): ControlService, clampTake(), EvidenceController, RISK_LEVELS, CreateControlDto, CreateMappingDto, FrameworkItemImportRow, ImportFrameworkItemsDto (+2 more)

### Community 4 - "llm-gateway.service.ts"
Cohesion: 0.05
Nodes (34): ANSWERABLE_STATUSES, DocumentAnswerService, ADR-0003, applyClassificationGate(), Chunk, GateVerdict, maySendExternally(), SENDABLE (+26 more)

### Community 5 - "campaign-builder.service.ts"
Cohesion: 0.10
Nodes (14): CampaignBuilderService, CampaignPreview, CreateCampaignInput, MAX_SNAPSHOT_AGE_DAYS, nextCampaignCode(), Directory, parseReviewerRule(), ResolvableLine (+6 more)

### Community 6 - "evidence-package.service.ts"
Cohesion: 0.15
Nodes (11): CampaignRow, canonicalJson(), computeFlaggedReviewers(), DecisionRow, EvidencePackageService, fingerprintOf(), FlaggedReviewer, iso() (+3 more)

### Community 7 - "auth.service.ts"
Cohesion: 0.08
Nodes (12): ContextMiddleware, Public(), AuthController, LoginDto, StepUpDto, AuthService, LoginResult, IssuedSession (+4 more)

### Community 8 - "evidence-stage2.integration.test.ts"
Cohesion: 0.07
Nodes (37): RequestContext, runWithRequestContext(), storage, asUser(), campaigns, capturedAt, ids, packs (+29 more)

### Community 9 - "load-env.ts"
Cohesion: 0.20
Nodes (7): applyEnvFile(), loadWorkspaceEnv(), ADR-0008, WorkerModule, ADR-0008, OWNED, ADR-0004

### Community 10 - "dependencies"
Cohesion: 0.05
Nodes (43): dependencies, class-transformer, class-validator, helmet, ioredis, @nestjs/common, @nestjs/config, @nestjs/core (+35 more)

### Community 11 - "review-board.tsx"
Cohesion: 0.13
Nodes (27): ActionError, ActionResult, bulkDecide(), decideItem(), signoffCampaign(), toActionError(), BulkSection(), apply() (+19 more)

### Community 12 - "review-decision.service.ts"
Cohesion: 0.14
Nodes (21): daysSince(), presentReviewItem(), BulkRejection, DECIDABLE_CAMPAIGN_STATUSES, DecisionInput, ADR-0004, BULK_MAX_ITEMS, bulkExclusionReason() (+13 more)

### Community 13 - "seed.ts"
Cohesion: 0.15
Nodes (14): PERMISSIONS, ROLE_PERMISSIONS, ROLES, CONTROLS, Ctx, ISO_ITEMS, MAPPINGS, seedModuleA() (+6 more)

### Community 15 - "kebijakan/[id]/page.tsx"
Cohesion: 0.15
Nodes (11): ActionResult, submitAttestation(), AttestationPanel(), attest(), ApprovalStep, CLASSIFICATION_TONE, DocumentDetail, STATUS_TONE (+3 more)

### Community 16 - "detection.service.ts"
Cohesion: 0.17
Nodes (12): DetectedAnomaly, DetectedSodViolation, DetectionLine, detectPerSnapshotAnomalies(), EmployeeHolding, evaluateSodRules(), resolveGroupEntitlementIds(), SodRuleDef (+4 more)

### Community 17 - "engagement.controller.ts"
Cohesion: 0.10
Nodes (15): clampTake(), EngagementController, CreateEngagementDto, CreateFindingDto, CreateRemediationDto, CreateRequestItemDto, DateRangeDto, EngagementTransitionDto (+7 more)

### Community 18 - "escalation.service.ts"
Cohesion: 0.22
Nodes (9): daysFromDue(), ESCALATION_LADDER, EscalationAudience, EscalationStage, isCritical(), stageFor(), EscalationService, ADR-0008 (+1 more)

### Community 19 - "policy-attestation.integration.test.ts"
Cohesion: 0.07
Nodes (22): AttestationController, asStringArray(), AttestationService, CreateAttestationCampaignInput, percent(), ADR-0001, AttestDto, CreateAttestationCampaignDto (+14 more)

### Community 20 - "Principal"
Cohesion: 0.14
Nodes (4): AnomalyService, EvidenceService, DocumentService, Principal

### Community 21 - "Workspace.tsx"
Cohesion: 0.06
Nodes (66): metadata, AddCharacterModal(), CharacterDetailModal(), Header(), NAVIGATION, KanbanBoard(), KanbanCard(), StaminaHub() (+58 more)

### Community 22 - "kampanye/[id]/page.tsx"
Cohesion: 0.13
Nodes (19): ActionError, ActionResult, cancelCampaign(), extendCampaign(), generateEvidencePackage(), launchCampaign(), lifecycle(), SimpleResult (+11 more)

### Community 23 - "(app)/page.tsx"
Cohesion: 0.11
Nodes (23): AppLayout(), Bar(), BerandaPage(), buildStats(), CampaignData, CampaignPanel(), Legend(), loadCampaigns() (+15 more)

### Community 25 - "unit-of-work.ts"
Cohesion: 0.09
Nodes (22): AuditRecorder, ADR-0004, AuditEntry, MissingActorError, MissingAuditTrailError, isSensitiveKey(), REDACTED, redactSensitive() (+14 more)

### Community 26 - "PrismaService"
Cohesion: 0.06
Nodes (25): ANOMALY_LABELS, AnomalyExceptionInput, AnomalyFilter, ApplicationInput, ControlInput, ControlListFilter, ControlPatch, FindingInput (+17 more)

### Community 27 - "document.service.ts"
Cohesion: 0.21
Nodes (13): addMonths(), canTransition(), DEFAULT_REVIEW_CYCLE_MONTHS, defaultReviewCycleMonths(), DOCUMENT_TRANSITIONS, mayReference(), nextVersion(), NORMATIVE_RANK (+5 more)

### Community 28 - "verify.py"
Cohesion: 0.18
Nodes (21): block(), check_fences(), check_fr_in_matrix(), check_ids(), check_json(), check_links(), check_readme_counts(), check_terminology() (+13 more)

### Community 29 - "RequiresStepUp"
Cohesion: 0.16
Nodes (8): clampTake(), EvidenceItemController, AddEvidenceVersionDto, ApproveDeletionDto, CreateEvidenceDto, CreateEvidenceLinkDto, EvidenceLegalHoldDto, RequiresStepUp()

### Community 30 - "escalation.integration.test.ts"
Cohesion: 0.06
Nodes (26): NotificationController, BY_CODE, NOTIFICATION_MATRIX, NotificationChannel, NotificationSpec, sendsEmail(), sendsInApp(), specFor() (+18 more)

### Community 31 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, tailwindcss, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom, typescript, vitest (+9 more)

### Community 32 - "SnapshotService"
Cohesion: 0.22
Nodes (5): change(), CompareLine, key(), SnapshotChangeType, SnapshotService

### Community 33 - "document.controller.ts"
Cohesion: 0.14
Nodes (12): DocumentController, ApprovalDecisionDto, AskDocumentDto, CancelFlowDto, CreateDocumentDto, CreateVersionDto, LinkControlDto, PutIntoForceDto (+4 more)

### Community 34 - "compilerOptions"
Cohesion: 0.07
Nodes (26): compilerOptions, allowJs, incremental, isolatedModules, jsx, lib, module, moduleResolution (+18 more)

### Community 35 - "db/package.json"
Cohesion: 0.08
Nodes (24): dependencies, @prisma/client, description, devDependencies, prisma, typescript, engines, bun (+16 more)

### Community 36 - "compilerOptions"
Cohesion: 0.08
Nodes (23): compilerOptions, baseUrl, emitDecoratorMetadata, experimentalDecorators, lib, module, moduleResolution, noEmit (+15 more)

### Community 37 - "allow"
Cohesion: 0.06
Nodes (31): permissions, allow, deny, $schema, Bash(git branch:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*) (+23 more)

### Community 38 - "scripts"
Cohesion: 0.08
Nodes (26): scripts, build, db:deploy, db:generate, db:migrate, db:seed, db:setup, db:validate (+18 more)

### Community 39 - "anomaly.controller.ts"
Cohesion: 0.18
Nodes (8): AnomalyExceptionDto, SodExceptionDto, SodSimulateDto, ANOMALY_CODES, AnomalyController, clampTake(), FINDING_STATUSES, RISK_LEVELS

### Community 40 - "application.controller.ts"
Cohesion: 0.22
Nodes (4): CreateApplicationDto, UpdateApplicationDto, ApplicationController, ApplicationService

### Community 41 - "snapshot.controller.ts"
Cohesion: 0.25
Nodes (5): CommitUploadDto, sendCsv(), SnapshotController, MAX_UPLOAD_BYTES, UploadedFile

### Community 42 - "application-form.tsx"
Cohesion: 0.14
Nodes (17): ActionError, ActionResult, ApplicationFormInput, createApplication(), deactivateApplication(), toBody(), toError(), updateApplication() (+9 more)

### Community 43 - "hasPermission"
Cohesion: 0.27
Nodes (6): BulkDecisionDto, DecisionDto, clampTake(), parseStatus(), ReviewItemController, hasPermission()

### Community 44 - "policy-document.integration.test.ts"
Cohesion: 0.13
Nodes (17): approvals, approveEveryStep(), asUser(), bringIntoForce(), documents, FORCE_FROM, forceInPlace(), ids (+9 more)

### Community 45 - "Browser"
Cohesion: 0.16
Nodes (11): main(), main(), Browser, campaign_in_progress(), check(), free_port(), login(), main() (+3 more)

### Community 46 - "main.ts"
Cohesion: 0.12
Nodes (9): AppModule, ADR-0001, ADR-0008, REQUIRES_STEP_UP, StepUpGuard, stepUpRequired(), StepUpService, ttlSeconds() (+1 more)

### Community 47 - "ADR-03 LLM Gateway Sole Egress"
Cohesion: 0.12
Nodes (20): guardrail-audit Skill, Local Infrastructure Stack, FR-C-010 Entitlement Filtering, FR-C-013 Answer Generation, FR-C-014 Classification Gate, FR-C-015 Sensitive Data Redaction, FR-C-016 Gateway Logging, FR-C-017 Circuit Breaker (+12 more)

### Community 48 - "compilerOptions"
Cohesion: 0.10
Nodes (19): test/**/*.ts, vitest.config.ts, compilerOptions, allowJs, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, lib (+11 more)

### Community 49 - "snapshot-csv.ts"
Cohesion: 0.16
Nodes (17): ACCOUNT_STATUSES, buildErrorFile(), buildTemplate(), csvCell(), detectDelimiter(), FileFormatError, KNOWN_COLUMNS, parseDate() (+9 more)

### Community 50 - "devDependencies"
Cohesion: 0.13
Nodes (15): eslint, eslint-import-resolver-typescript, @eslint/js, eslint-plugin-import, devDependencies, eslint, eslint-import-resolver-typescript, @eslint/js (+7 more)

### Community 51 - "FRD — Functional Requirements Document"
Cohesion: 0.05
Nodes (41): 10. Matriks Prioritas Kebutuhan (MoSCoW), 1. Peta Modul Sistem, 2. Modul 1: Papan Kanban Build Karakter (FR-KB), 3. Modul 2: Profil & Target Build Karakter (FR-CH), 4. Modul 3: Kalkulator Defisit Material (FR-MC), 5. Modul 4: Stamina Hub & Rutinitas Game (FR-ST), 6. Modul 5: Kalender Rotasi Farming Harian (FR-FS), 7. Modul 6: Tabungan Gacha & Pity Planner (FR-GC) (+33 more)

### Community 52 - "requireUser"
Cohesion: 0.13
Nodes (28): AplikasiPage(), AttestationPage(), AuditRow, JejakAuditPage(), KampanyeBaruPage(), CampaignDetailPage(), KampanyePage(), BandingkanPage() (+20 more)

### Community 53 - "wizard.tsx"
Cohesion: 0.25
Nodes (12): CampaignPreview, createCampaign(), fail(), launchCampaign(), previewCampaign(), Result, CampaignWizard(), goToPreview() (+4 more)

### Community 54 - "apiFetch"
Cohesion: 0.14
Nodes (24): ApplicationRow, CRITICALITY_TONE, SessionUser, bearer(), commitUpload(), fetchCsv(), fetchErrorFile(), fetchTemplate() (+16 more)

### Community 55 - "@prisma/client"
Cohesion: 0.40
Nodes (3): prisma, ADR-0004, @prisma/client

### Community 56 - "access.module.ts"
Cohesion: 0.14
Nodes (6): AccessModule, ADR-0001, MANUAL_TRANSITIONS, RevocationService, VerificationOutcome, applicationScope()

### Community 57 - "evidence-item.service.ts"
Cohesion: 0.23
Nodes (11): EvidenceInput, LinkInput, VersionInput, coversPeriod(), isExpired(), iso(), Period, PeriodVerdict (+3 more)

### Community 58 - "SIGAP Platform"
Cohesion: 0.14
Nodes (16): Modul A - Evidence Vault, Modul B - Access Review, Modul C - Policy Hub, Shared Evidence Store, SIGAP Platform, OJK Regulatory Obligation, Manual UAR Cost Problem, FR-A-008 Reminder and Escalation (+8 more)

### Community 59 - "evidence.module.ts"
Cohesion: 0.22
Nodes (7): ENGAGEMENT_CODE_PREFIX, EngagementInput, EngagementListFilter, FIRM_WIDE_ROLES, TRANSITIONS, EvidenceModule, ADR-0001

### Community 60 - "dev.sh"
Cohesion: 0.26
Nodes (8): cmd_status(), is_running(), main(), resolve_targets(), say(), dev.sh script, start_one(), stop_one()

### Community 61 - "2. Epics & User Stories (dengan Acceptance Criteria)"
Cohesion: 0.09
Nodes (21): 1. Visi Produk & Nilai Pengguna (Product Vision), 2. Epics & User Stories (dengan Acceptance Criteria), 3. Desain Pengalaman Pengguna (UX & Design Guidelines), 4. Matriks Rilis & Kriteria Peluncuran (Launch Checklist), Epic 1: Manajemen Papan Kanban (Kanban Board Management), Epic 2: Profil & Kalkulator Defisit Karakter (Character Progression & Calculator), Epic 3: Stamina Hub & Rutinitas Game (Stamina Hub & Daily Checklist), Epic 4: Kalender Rotasi Farming Harian (Daily Farming Schedule) (+13 more)

### Community 62 - "shared.module.ts"
Cohesion: 0.13
Nodes (15): AuditService, ChainVerification, ADR-0004, assertProviderAllowed(), AuthenticatedPrincipal, Credentials, IdentityProvider, ADR-0006 (+7 more)

### Community 63 - "access-detection.integration.test.ts"
Cohesion: 0.16
Nodes (13): anomalyService, asUser(), createdSnapshots, detection, file(), ids, ingest(), prisma (+5 more)

### Community 68 - "document-chunker.ts"
Cohesion: 0.27
Nodes (12): approximateTokens(), Chunk, chunkDocument(), Heading, HEADING_PATTERNS, makeChunk(), matchHeading(), overlapTail() (+4 more)

### Community 69 - "policy-approval.integration.test.ts"
Cohesion: 0.21
Nodes (11): approvals, approveReviews(), asUser(), createDoc(), documents, ids, principalOf(), prisma (+3 more)

### Community 70 - "FRD — Functional Requirements Document"
Cohesion: 0.10
Nodes (20): 10. Matriks Prioritas Kebutuhan (MoSCoW), 1. Peta Modul Sistem, 4. Modul 3: Kalkulator Defisit Material (FR-MC), 6. Modul 5: Kalender Rotasi Farming Harian (FR-FS), 7. Modul 6: Tabungan Gacha & Pity Planner (FR-GC), 8. Modul 7: Eksperimen Backend Go (Gin Framework) (FR-EX), FR-EX-001: Optimizer Jalur Farming Resin (Resin Farming Optimizer), FR-EX-002: Sinkronisasi Showcase UID Publik (Enka.Network Adapter) (+12 more)

### Community 71 - "snapshot-upload.integration.test.ts"
Cohesion: 0.18
Nodes (12): asUser(), createdSnapshots, file(), ids, ingest(), prisma, revocations, snapshots (+4 more)

### Community 72 - "SnapshotUploadService"
Cohesion: 0.21
Nodes (4): SnapshotStagingStore, contentHash(), SnapshotUploadService, ensureRedisReady()

### Community 73 - "snapshot-upload.service.ts"
Cohesion: 0.36
Nodes (8): RowIssue, StagedRow, StagedUpload, StagedWarning, CommitInput, ROW_COUNT_DROP_THRESHOLD, unique(), ValidationPreview

### Community 74 - "tiket/actions.ts"
Cohesion: 0.24
Nodes (11): ActionError, ActionResult, claimTicket(), completeTicket(), exceptTicket(), run(), verifyTicketNow(), TicketActions() (+3 more)

### Community 75 - "85 Functional Requirements"
Cohesion: 0.17
Nodes (12): spec-guardian Agent, Docs Are Source of Truth, verify-docs Skill, Eight User Personas, 41 User Stories, 85 Functional Requirements, REST API Contract, Implementation Progress Report (+4 more)

### Community 76 - "document-diff.ts"
Cohesion: 0.23
Nodes (10): buildDiff(), collapseUnchanged(), diffDocuments(), DiffHunk, DiffKind, DiffLine, DiffSummary, DocumentDiff (+2 more)

### Community 78 - "package.json"
Cohesion: 0.12
Nodes (15): description, engines, bun, node, name, packageManager, private, trustedDependencies (+7 more)

### Community 79 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, composite, noEmit, outDir, rootDir, extends, include, src (+1 more)

### Community 80 - "Ten Critical Controls K-1 to K-10"
Cohesion: 0.25
Nodes (9): security-reviewer Agent, critical-controls Skill, Every Write Goes Through UnitOfWork, FR-X-008 Audit Trail, ADR-04 Evidence and Audit Integrity, Ten Critical Controls K-1 to K-10, K-7 Audit Log Immutability, K-8 Evidence Integrity (+1 more)

### Community 81 - "TRD — Technical Requirements Document"
Cohesion: 0.10
Nodes (19): 1.1 Diagram Topologi & Strategi Dual-Mode, 1. Arsitektur Sistem (System Architecture), 2.1 Lapisan Frontend (Next.js di Vercel), 2.2 Lapisan Backend Eksperimen (Go / Gin Framework), 2. Spesifikasi Tumpukan Teknologi (Technology Stack), 3.1 Skema TypeScript (Frontend & Shared), 3.2 Skema Model Go (Backend Experiment), 3. Desain Model Data (Data Models) (+11 more)

### Community 82 - "eslint.config.mjs"
Cohesion: 0.25
Nodes (7): ADR-0003, boundaryZones, ADR-0001, ADR-0003, MODULES, moduleRoot, ADR-0001

### Community 83 - "tsconfig.seed.json"
Cohesion: 0.25
Nodes (7): compilerOptions, composite, noEmit, extends, include, ../../tsconfig.json, seed

### Community 84 - "nest-cli.json"
Cohesion: 0.29
Nodes (6): collection, compilerOptions, deleteOutDir, tsConfigPath, $schema, sourceRoot

### Community 85 - "shared/index.ts"
Cohesion: 0.10
Nodes (13): InviteInput, AuthzService, hasAnyRole(), orgUnitScope(), SCOPE_APPLICATIONS, SCOPE_ORG_UNITS, ScopeFilter, AuthGuard (+5 more)

### Community 86 - "check-mermaid.mjs"
Cohesion: 0.47
Nodes (3): extractBlocks(), main(), setupDom()

### Community 87 - "TRD — Technical Requirements Document"
Cohesion: 0.11
Nodes (19): 1.1 Diagram Topologi & Strategi Dual-Mode, 1. Arsitektur Sistem (System Architecture), 2.1 Lapisan Frontend (Next.js di Vercel), 2.2 Lapisan Backend Eksperimen (Go / Gin Framework), 2. Spesifikasi Tumpukan Teknologi (Technology Stack), 3.1 Skema TypeScript (Frontend & Shared), 3.2 Skema Model Go (Backend Experiment), 3. Desain Model Data (Data Models) (+11 more)

### Community 88 - "campaign.service.ts"
Cohesion: 0.17
Nodes (8): addWorkingDays(), CampaignService, countByDecision(), fingerprintOf(), nextTicketNo(), SignoffResult, SignoffScope, SLA_WORKING_DAYS

### Community 89 - "Design System: HoyoKanban"
Cohesion: 0.11
Nodes (17): Colors, Components, Data dan Vercel, Design System: HoyoKanban, Dialog, Farming (`/farming`) dan gacha (`/gacha`), Keputusan UX, Masuk (`/login`) (+9 more)

### Community 90 - "app/layout.tsx"
Cohesion: 0.33
Nodes (4): inter, jetbrainsMono, metadata, viewport

### Community 91 - "Design Token System"
Cohesion: 0.50
Nodes (4): Trimegah Brand Guideline, UI Flow and Wireframes, Design Token System, Typographic Scale

### Community 92 - "BRD — Business Requirements Document"
Cohesion: 0.11
Nodes (18): 1. Ringkasan Eksekutif (Executive Summary), 2.1 Masalah Utama Pengguna, 2.2 Peluang & Nilai Tambah Solusi, 2. Masalah & Peluang (Problem Statement & Opportunities), 3. Sasaran Proyek (Project Goals & Objectives), 4.1 Persona 1: Arya — The Dual-Game Daily Grinder, 4.2 Persona 2: Cynthia — The Endgame Tactician, 4.3 Persona 3: Budi — The F2P+ Strategic Planner (+10 more)

### Community 105 - "TransactionClient"
Cohesion: 0.34
Nodes (4): ReviewDecisionService, ReviewItemView, validateReason(), TransactionClient

### Community 107 - "web/package.json"
Cohesion: 0.15
Nodes (12): description, engines, node, name, private, scripts, build, dev (+4 more)

### Community 108 - "CLAUDE.md"
Cohesion: 0.22
Nodes (6): 1. The Core Loop, 2. Rules That Must Never Be Broken, Superpowers: Disciplined Engineering & TDD Workflow, Arsip Proyek Sebelumnya, Daftar Dokumen Spesifikasi, Dokumentasi HoyoKanban

### Community 109 - "module-c.ts"
Cohesion: 0.23
Nodes (12): addDays(), APPROVAL_TEMPLATES, createChunks(), Ctx, daysAgo(), DOCUMENTS, monthsFromToday(), seedApprovalTemplates() (+4 more)

### Community 111 - "auth-actions.ts"
Cohesion: 0.24
Nodes (9): initialState, LoginForm(), MasukPage(), metadata, login(), LoginResponse, LoginState, logout() (+1 more)

### Community 112 - "models.go"
Cohesion: 0.29
Nodes (10): APIResponse, BuildTarget, DailyPlan, FarmTask, GameType, OptimizationRequest, OptimizationResult, ShowcaseCharacter (+2 more)

### Community 113 - "campaign.controller.ts"
Cohesion: 0.31
Nodes (9): CancelCampaignDto, CompleteTicketDto, CreateCampaignDto, ExtendCampaignDto, ReopenSignoffDto, SignoffDto, SignoffScopeDto, TicketExceptionDto (+1 more)

### Community 114 - "module-b.ts"
Cohesion: 0.24
Nodes (10): accountFor(), APPLICATIONS, Ctx, ENTITLEMENTS, HOLDINGS, seedCampaign(), seedModuleB(), slug() (+2 more)

### Community 115 - "document-search.service.ts"
Cohesion: 0.31
Nodes (7): AUDIT_MODE_ROLES, AnswerChunkRow, FacetCount, SearchFilters, SearchHit, ADR-0003, SearchResponse

### Community 116 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, next, react, react-dom, @vercel/analytics, next, react, react-dom (+1 more)

### Community 117 - "web/vercel.json"
Cohesion: 0.22
Nodes (8): buildCommand, framework, headers, installCommand, sin1, outputDirectory, regions, $schema

### Community 118 - "vercel.json"
Cohesion: 0.22
Nodes (8): buildCommand, framework, headers, installCommand, sin1, outputDirectory, regions, $schema

### Community 119 - "Product"
Cohesion: 0.25
Nodes (7): Brand Commitments, Capabilities and Constraints, Platform, Product, Product Principles, Product Purpose, Users

### Community 121 - "access-review.integration.test.ts"
Cohesion: 0.29
Nodes (4): capturedAt, ids, prisma, ADR-0004

### Community 122 - "Grill Guardian — Spesifikasi & Stress-Testing Desain"
Cohesion: 0.33
Nodes (5): 1. Protokol Grill-Me (Challenging & Probing), 2. Penegakan Filosofi Ponytail (Anti Over-Engineering), 3. Integrasi RTK (Token-Efficiency Discipline), 4. Format Output Laporan Grill, Grill Guardian — Spesifikasi & Stress-Testing Desain

### Community 123 - "gate.py"
Cohesion: 0.53
Nodes (5): evaluate(), load(), main(), Kembalikan (lolos, daftar alasan tahan)., report()

### Community 124 - "2. Modul 1: Papan Kanban Build Karakter (FR-KB)"
Cohesion: 0.33
Nodes (6): 2. Modul 1: Papan Kanban Build Karakter (FR-KB), FR-KB-001: Definisi Kolom Alur Kerja (Default Stages), FR-KB-002: Interaksi Drag-and-Drop, FR-KB-003: Komponen Kartu Karakter (Kanban Card), FR-KB-004: Filter dan Pencarian, FR-KB-005: Pembatasan Beban Kerja (WIP Limits - Work In Progress)

### Community 125 - "Sumber data HoyoKanban"
Cohesion: 0.33
Nodes (5): Akses akun yang belum terhubung, Integrasi yang sudah berjalan, Jadwal dan data pemain, Sumber data HoyoKanban, Vercel dan pembaruan

### Community 126 - "HoyoKanban 🎯"
Cohesion: 0.33
Nodes (6): 📚 Dokumentasi Spesifikasi, 🚀 Fitur Unggulan, HoyoKanban 🎯, Katalog dan papan, Menjalankan dan Deploy, 🛠️ Tumpukan Teknologi

### Community 127 - "jejak-audit/actions.ts"
Cohesion: 0.70
Nodes (3): ChainResult, verifyChain(), VerifyChainButton()

### Community 128 - "HoyoKanban — Panduan Asisten AI & Pengembangan Sistem"
Cohesion: 0.40
Nodes (5): 1. Sumber Kebenaran Dokumen, 2. Skill yang Digunakan Proyek, 3. Subagent Teknis Proyek ([`.claude/agents/`](.claude/agents/)), 4. Tumpukan Teknologi, HoyoKanban — Panduan Asisten AI & Pengembangan Sistem

### Community 129 - "Backend Implementor — Go 1.22 & Gin Framework"
Cohesion: 0.40
Nodes (4): 1. Disiplin Superpowers (TDD & Go Idioms), 2. Penegakan Filosofi Ponytail (Idiomatic & Minimalist Go), 3. Disiplin RTK (Token-Efficiency), Backend Implementor — Go 1.22 & Gin Framework

### Community 130 - "Frontend Implementor — Next.js 15, React 19 & Vercel Engine"
Cohesion: 0.40
Nodes (4): 1. Disiplin Superpowers (TDD & Step-by-Step Delivery), 2. Penegakan Filosofi Ponytail (Minimalis & Cepat), 3. Disiplin RTK (Terminal Output Efficiency), Frontend Implementor — Next.js 15, React 19 & Vercel Engine

### Community 131 - "Graphify Mapper — Arsitektur & Peta Dependensi Kode"
Cohesion: 0.40
Nodes (4): 1. Tanggung Jawab Utama (Graphify Core), 2. Disiplin RTK (Token-Efficiency), 3. Format Laporan Dependensi, Graphify Mapper — Arsitektur & Peta Dependensi Kode

### Community 132 - "3. Modul 2: Profil & Target Build Karakter (FR-CH)"
Cohesion: 0.40
Nodes (5): 3. Modul 2: Profil & Target Build Karakter (FR-CH), FR-CH-001: Katalog Karakter Preset, FR-CH-002: Form Konfigurasi Target Genshin Impact, FR-CH-003: Form Konfigurasi Target Zenless Zone Zero (ZZZ), FR-CH-004: Catatan Pribadi (Personal Notes)

### Community 133 - "5. Modul 4: Stamina Hub & Rutinitas Game (FR-ST)"
Cohesion: 0.40
Nodes (5): 5. Modul 4: Stamina Hub & Rutinitas Game (FR-ST), FR-ST-001: Pelacak Original Resin Genshin Impact, FR-ST-002: Pelacak Battery Charge Zenless Zone Zero, FR-ST-003: Checklist Rutinitas Harian (Daily Routine), FR-ST-004: Checklist Rutinitas Mingguan (Weekly Routine)

### Community 134 - "9. Modul 8: Manajemen Data & Portabilitas (FR-DM)"
Cohesion: 0.40
Nodes (5): 9. Modul 8: Manajemen Data & Portabilitas (FR-DM), FR-DM-001: Penyimpanan Local-First (IndexedDB / LocalStorage), FR-DM-002: Ekspor Berkas JSON (Backup), FR-DM-003: Impor Berkas JSON (Restore), FR-DM-004: Muat Data Sampel (Load Demo Data)

### Community 135 - "Superpowers: Disciplined Engineering & TDD Workflow"
Cohesion: 0.50
Nodes (3): 1. The Core Loop, 2. Rules That Must Never Be Broken, Superpowers: Disciplined Engineering & TDD Workflow

### Community 136 - "sync-catalog.py"
Cohesion: 0.83
Nodes (3): fetch(), main(), slug()

## Knowledge Gaps
- **764 isolated node(s):** `$schema`, `Bash(git status:*)`, `Bash(git diff:*)`, `Bash(git log:*)`, `Bash(git show:*)` (+759 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Principal` connect `Principal` to `SigapRequest`, `EvidenceController`, `llm-gateway.service.ts`, `campaign-builder.service.ts`, `evidence-package.service.ts`, `auth.service.ts`, `evidence-stage2.integration.test.ts`, `review-decision.service.ts`, `detection.service.ts`, `engagement.controller.ts`, `policy-attestation.integration.test.ts`, `DocumentSearchRepository`, `PrismaService`, `document.service.ts`, `RequiresStepUp`, `SnapshotService`, `application.controller.ts`, `policy-document.integration.test.ts`, `access.module.ts`, `evidence-item.service.ts`, `evidence.module.ts`, `access-detection.integration.test.ts`, `ReviewItemRepository`, `EngagementService`, `ExternalAccessService`, `DocumentApprovalService`, `policy-approval.integration.test.ts`, `snapshot-upload.integration.test.ts`, `SnapshotUploadService`, `snapshot-upload.service.ts`, `document-diff.ts`, `shared/index.ts`, `campaign.service.ts`, `TransactionClient`, `FindingService`, `RequestItemService`, `document-search.service.ts`, `SodService`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Why does `@prisma/client` connect `@prisma/client` to `EvidenceController`, `llm-gateway.service.ts`, `campaign-builder.service.ts`, `evidence-package.service.ts`, `review-decision.service.ts`, `seed.ts`, `detection.service.ts`, `engagement.controller.ts`, `policy-attestation.integration.test.ts`, `unit-of-work.ts`, `PrismaService`, `document.service.ts`, `document.controller.ts`, `anomaly.controller.ts`, `hasPermission`, `access.module.ts`, `evidence-item.service.ts`, `evidence.module.ts`, `shared.module.ts`, `package.json`, `campaign.service.ts`, `module-c.ts`, `campaign.controller.ts`, `module-b.ts`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `SigapRequest` connect `SigapRequest` to `EvidenceController`, `auth.service.ts`, `engagement.controller.ts`, `escalation.service.ts`, `policy-attestation.integration.test.ts`, `Principal`, `unit-of-work.ts`, `RequiresStepUp`, `escalation.integration.test.ts`, `document.controller.ts`, `anomaly.controller.ts`, `application.controller.ts`, `snapshot.controller.ts`, `hasPermission`, `main.ts`, `shared.module.ts`, `ExternalAccessService`, `AuditController`, `shared/index.ts`, `FindingService`, `RequestItemService`, `campaign.controller.ts`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **What connects `$schema`, `Bash(git status:*)`, `Bash(git diff:*)` to the rest of the system?**
  _764 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app_user` be split into smaller, more focused modules?**
  _Cohesion score 0.06892010535557506 - nodes in this community are weakly interconnected._
- **Should `ui.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07948717948717948 - nodes in this community are weakly interconnected._
- **Should `EvidenceController` be split into smaller, more focused modules?**
  _Cohesion score 0.08880666049953746 - nodes in this community are weakly interconnected._