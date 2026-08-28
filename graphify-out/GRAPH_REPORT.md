# Graph Report - ai-assitant  (2026-08-28)

## Corpus Check
- 280 files · ~267,727 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2317 nodes · 5653 edges · 105 communities (95 shown, 10 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 259 edges (avg confidence: 0.8)
- Token cost: 48,000 input · 9,000 output

## Community Hubs (Navigation)
- Campaign API Controller
- Foundation SQL Migration
- Next.js App Screens
- Control Library Service
- Document Answer & Scoping
- Campaign Builder Service
- Access Module DTOs
- Authorization & Auth Guard
- Request Context & Evidence Tests
- App Bootstrap & Env Loading
- API Package Dependencies
- Review Server Actions & UI
- Review Decision Service
- Seed Catalogue & Module Data
- Route Loading & Error States
- Audit Trail & Attestation UI
- Anomaly & SoD Detection
- Evidence Stage-2 DTOs
- Escalation Ladder & Service
- Attestation Campaign Controller
- Evidence Item Service
- Policy Module DTOs
- Campaign Server Actions
- App Layout & Dashboard
- Answer Service & Search Repo
- Audit Recorder
- Shared Constructors
- Document Lifecycle Rules
- Python Verification Scripts
- Evidence Item Controller
- Notification Service & Prisma
- Web Package Dependencies
- Access Module Wiring
- Document Controller
- Web TypeScript Config
- DB Package Config
- API TypeScript Config
- Claude Settings & Permissions
- Root NPM Scripts
- Anomaly Controller & SoD DTOs
- Application Controller
- Snapshot Controller
- Application Server Actions
- Review Item Controller
- Policy Document Tests
- Browser Verification Harness
- Snapshot Staging Store
- LLM Gateway Doc Concepts
- Root TypeScript & Vitest Config
- Snapshot CSV Parsing
- Minor Cluster 50
- Minor Cluster 51
- Minor Cluster 52
- Minor Cluster 53
- Minor Cluster 54
- Minor Cluster 55
- Minor Cluster 56
- Minor Cluster 57
- Minor Cluster 58
- Minor Cluster 59
- Minor Cluster 60
- Minor Cluster 61
- Minor Cluster 62
- Minor Cluster 63
- Minor Cluster 64
- Minor Cluster 65
- Minor Cluster 66
- Minor Cluster 67
- Minor Cluster 68
- Minor Cluster 69
- Minor Cluster 70
- Minor Cluster 71
- Minor Cluster 72
- Minor Cluster 73
- Minor Cluster 74
- Minor Cluster 75
- Minor Cluster 76
- Minor Cluster 77
- Minor Cluster 78
- Minor Cluster 79
- Minor Cluster 80
- Minor Cluster 81
- Minor Cluster 82
- Minor Cluster 83
- Minor Cluster 84
- Minor Cluster 85
- Minor Cluster 86
- Minor Cluster 87
- Minor Cluster 88
- Minor Cluster 89
- Minor Cluster 90
- Minor Cluster 91
- Minor Cluster 92
- Minor Cluster 93
- Minor Cluster 94
- Minor Cluster 95
- Minor Cluster 96
- Minor Cluster 99

## God Nodes (most connected - your core abstractions)
1. `Principal` - 186 edges
2. `SigapRequest` - 172 edges
3. `PrismaService` - 88 edges
4. `UnitOfWork` - 64 edges
5. `@prisma/client` - 41 edges
6. `TransactionClient` - 36 edges
7. `apiFetch()` - 33 edges
8. `runWithRequestContext()` - 32 edges
9. `app_user` - 32 edges
10. `hasAnyRole()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `Local Infrastructure Stack` --references--> `ADR-02 Hybrid Search in PostgreSQL`  [INFERRED]
  docker-compose.yml → docs/04-TRD.md
- `guardrail-audit Skill` --references--> `33 Guardrails`  [EXTRACTED]
  .claude/skills/guardrail-audit/SKILL.md → docs/09-GUARDRAILS.md
- `security-reviewer Agent` --references--> `Ten Critical Controls K-1 to K-10`  [INFERRED]
  .claude/agents/security-reviewer.md → docs/10-TEST-PLAN.md
- `spec-guardian Agent` --implements--> `Docs Are Source of Truth`  [INFERRED]
  .claude/agents/spec-guardian.md → CLAUDE.md
- `Hand-Written SQL Migrations` --conceptually_related_to--> `db-migrator Agent`  [INFERRED]
  packages/db/README.md → .claude/agents/db-migrator.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **LLM Gateway Egress Control Chain** — docs_04_trd_adr_03, docs_03_frd_fr_c_014, docs_03_frd_fr_c_015, docs_03_frd_fr_c_016, docs_03_frd_fr_c_017, docs_04_trd_egress_proxy [EXTRACTED 1.00]
- **Three Modules Sharing One Evidence Store** — docs_00_readme_modul_a, docs_00_readme_modul_b, docs_00_readme_modul_c, docs_00_readme_shared_evidence_store [EXTRACTED 1.00]
- **Audit and Evidence Integrity Stack** — docs_04_trd_adr_04, docs_10_test_plan_k7, docs_10_test_plan_k8, docs_03_frd_fr_x_008, claude_unit_of_work_rule, packages_db_readme_migration_role [EXTRACTED 1.00]

## Communities (105 total, 10 thin omitted)

### Community 0 - "Campaign API Controller"
Cohesion: 0.07
Nodes (36): CampaignController, presentPack(), presentTicket(), Body, Controller, Get, HttpCode, Param (+28 more)

### Community 1 - "Foundation SQL Migration"
Cohesion: 0.06
Nodes (58): it, app_user, audit_log, audit_log_no_delete, audit_log_no_truncate, audit_log_no_update, delegation, employee (+50 more)

### Community 2 - "Next.js App Screens"
Cohesion: 0.07
Nodes (55): AplikasiPage(), CRITICALITY_TONE, AttestationPage(), dynamic, STATUS_LABEL, STATUS_TONE, Task, AuditRow (+47 more)

### Community 3 - "Control Library Service"
Cohesion: 0.07
Nodes (34): ControlService, Injectable, clampTake(), EvidenceController, Body, Controller, Delete, Get (+26 more)

### Community 4 - "Document Answer & Scoping"
Cohesion: 0.06
Nodes (39): ANSWERABLE_STATUSES, ADR-0003, orgUnitScope(), SCOPE_APPLICATIONS, SCOPE_ORG_UNITS, ScopeFilter, ADR-0001, applyClassificationGate() (+31 more)

### Community 5 - "Campaign Builder Service"
Cohesion: 0.07
Nodes (23): CampaignBuilderService, CampaignPreview, CreateCampaignInput, MAX_SNAPSHOT_AGE_DAYS, nextCampaignCode(), Injectable, addWorkingDays(), CampaignService (+15 more)

### Community 6 - "Access Module DTOs"
Cohesion: 0.09
Nodes (44): AnomalyExceptionDto, BulkDecisionDto, CancelCampaignDto, CommitUploadDto, CompleteTicketDto, CreateApplicationDto, CreateCampaignDto, DecisionDto (+36 more)

### Community 7 - "Authorization & Auth Guard"
Cohesion: 0.07
Nodes (19): AuthzService, Injectable, ContextMiddleware, Injectable, IS_PUBLIC, Public(), AuthService, Injectable (+11 more)

### Community 8 - "Request Context & Evidence Tests"
Cohesion: 0.05
Nodes (44): RequestContext, runWithRequestContext(), storage, asUser(), controls, createdControlIds, frameworks, ids (+36 more)

### Community 9 - "App Bootstrap & Env Loading"
Cohesion: 0.05
Nodes (28): AppModule, ADR-0001, Module, applyEnvFile(), loadWorkspaceEnv(), ADR-0008, EvidenceModule, Module (+20 more)

### Community 10 - "API Package Dependencies"
Cohesion: 0.05
Nodes (43): dependencies, class-transformer, class-validator, helmet, ioredis, @nestjs/common, @nestjs/config, @nestjs/core (+35 more)

### Community 11 - "Review Server Actions & UI"
Cohesion: 0.11
Nodes (29): ActionError, ActionResult, bulkDecide(), decideItem(), signoffCampaign(), toActionError(), BulkSection(), apply() (+21 more)

### Community 12 - "Review Decision Service"
Cohesion: 0.11
Nodes (25): daysSince(), BulkRejection, DECIDABLE_CAMPAIGN_STATUSES, DecisionInput, ReviewDecisionService, ADR-0004, Injectable, ReviewItemView (+17 more)

### Community 13 - "Seed Catalogue & Module Data"
Cohesion: 0.07
Nodes (36): PERMISSIONS, ROLE_PERMISSIONS, ROLES, CONTROLS, Ctx, ISO_ITEMS, MAPPINGS, seedModuleA() (+28 more)

### Community 15 - "Audit Trail & Attestation UI"
Cohesion: 0.09
Nodes (27): ChainResult, verifyChain(), VerifyChainButton(), ActionResult, submitAttestation(), AttestationPanel(), attest(), ApprovalStep (+19 more)

### Community 16 - "Anomaly & SoD Detection"
Cohesion: 0.12
Nodes (15): DetectedAnomaly, DetectedSodViolation, DetectionLine, detectPerSnapshotAnomalies(), EmployeeHolding, evaluateSodRules(), resolveGroupEntitlementIds(), SodRuleDef (+7 more)

### Community 17 - "Evidence Stage-2 DTOs"
Cohesion: 0.21
Nodes (31): AddEvidenceVersionDto, ApproveDeletionDto, CreateEngagementDto, CreateEvidenceDto, CreateEvidenceLinkDto, CreateFindingDto, CreateRemediationDto, CreateRequestItemDto (+23 more)

### Community 18 - "Escalation Ladder & Service"
Cohesion: 0.10
Nodes (20): daysFromDue(), ESCALATION_LADDER, EscalationAudience, EscalationStage, isCritical(), stageFor(), EscalationService, ADR-0008 (+12 more)

### Community 19 - "Attestation Campaign Controller"
Cohesion: 0.15
Nodes (12): AttestationController, Body, Controller, Get, HttpCode, Param, Post, Req (+4 more)

### Community 20 - "Evidence Item Service"
Cohesion: 0.11
Nodes (5): EvidenceService, Injectable, FindingService, Injectable, hasAnyRole()

### Community 21 - "Policy Module DTOs"
Cohesion: 0.18
Nodes (30): ApprovalDecisionDto, AskDocumentDto, AttestDto, CancelFlowDto, CreateAttestationCampaignDto, CreateDocumentDto, CreateVersionDto, LinkControlDto (+22 more)

### Community 22 - "Campaign Server Actions"
Cohesion: 0.11
Nodes (22): ActionError, ActionResult, cancelCampaign(), extendCampaign(), generateEvidencePackage(), launchCampaign(), lifecycle(), SimpleResult (+14 more)

### Community 23 - "App Layout & Dashboard"
Cohesion: 0.10
Nodes (24): AppLayout(), Bar(), BerandaPage(), buildStats(), CampaignData, CampaignPanel(), Legend(), loadCampaigns() (+16 more)

### Community 24 - "Answer Service & Search Repo"
Cohesion: 0.10
Nodes (14): DocumentAnswerService, Injectable, AnswerChunkRow, DocumentSearchRepository, FacetCount, SearchFilters, SearchHit, ADR-0003 (+6 more)

### Community 25 - "Audit Recorder"
Cohesion: 0.10
Nodes (20): AuditRecorder, ADR-0004, AuditEntry, MissingActorError, MissingAuditTrailError, isSensitiveKey(), REDACTED, redactSensitive() (+12 more)

### Community 26 - "Shared Constructors"
Cohesion: 0.11
Nodes (5): InviteInput, Injectable, UnitOfWork, PrismaService, Injectable

### Community 27 - "Document Lifecycle Rules"
Cohesion: 0.13
Nodes (16): addMonths(), AUDIT_MODE_ROLES, canTransition(), DEFAULT_REVIEW_CYCLE_MONTHS, defaultReviewCycleMonths(), DOCUMENT_TRANSITIONS, mayReference(), nextVersion() (+8 more)

### Community 28 - "Python Verification Scripts"
Cohesion: 0.13
Nodes (27): evaluate(), load(), main(), Kembalikan (lolos, daftar alasan tahan)., report(), block(), check_fences(), check_fr_in_matrix() (+19 more)

### Community 29 - "Evidence Item Controller"
Cohesion: 0.22
Nodes (13): clampTake(), EvidenceItemController, Body, Controller, Delete, Get, HttpCode, Param (+5 more)

### Community 30 - "Notification Service & Prisma"
Cohesion: 0.08
Nodes (18): NotifyInput, capturedAt, ids, prisma, ADR-0004, asSystem(), DUE, escalation (+10 more)

### Community 31 - "Web Package Dependencies"
Cohesion: 0.07
Nodes (27): dependencies, next, react, react-dom, description, devDependencies, tailwindcss, @tailwindcss/postcss (+19 more)

### Community 32 - "Access Module Wiring"
Cohesion: 0.12
Nodes (12): AccessModule, Module, ApplicationInput, ADR-0001, MANUAL_TRANSITIONS, VerificationOutcome, change(), CompareLine (+4 more)

### Community 33 - "Document Controller"
Cohesion: 0.30
Nodes (9): DocumentController, Body, Controller, Get, HttpCode, Param, Post, Query (+1 more)

### Community 34 - "Web TypeScript Config"
Cohesion: 0.08
Nodes (24): compilerOptions, allowJs, incremental, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 35 - "DB Package Config"
Cohesion: 0.08
Nodes (24): dependencies, @prisma/client, description, devDependencies, prisma, typescript, engines, bun (+16 more)

### Community 36 - "API TypeScript Config"
Cohesion: 0.08
Nodes (23): compilerOptions, baseUrl, emitDecoratorMetadata, experimentalDecorators, lib, module, moduleResolution, noEmit (+15 more)

### Community 37 - "Claude Settings & Permissions"
Cohesion: 0.08
Nodes (23): permissions, allow, deny, $schema, Bash(git branch:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*) (+15 more)

### Community 38 - "Root NPM Scripts"
Cohesion: 0.08
Nodes (24): scripts, build, db:deploy, db:generate, db:migrate, db:seed, db:setup, db:validate (+16 more)

### Community 39 - "Anomaly Controller & SoD DTOs"
Cohesion: 0.21
Nodes (12): SodSimulateDto, IsObject, AnomalyController, clampTake(), Body, Controller, Get, HttpCode (+4 more)

### Community 40 - "Application Controller"
Cohesion: 0.17
Nodes (11): ApplicationController, Body, Controller, Get, HttpCode, Param, Patch, Post (+3 more)

### Community 41 - "Snapshot Controller"
Cohesion: 0.22
Nodes (13): sendCsv(), SnapshotController, Body, Controller, Get, HttpCode, Param, Post (+5 more)

### Community 42 - "Application Server Actions"
Cohesion: 0.14
Nodes (17): ActionError, ActionResult, ApplicationFormInput, createApplication(), deactivateApplication(), toBody(), toError(), updateApplication() (+9 more)

### Community 43 - "Review Item Controller"
Cohesion: 0.22
Nodes (13): presentReviewItem(), clampTake(), parseStatus(), ReviewItemController, Body, Controller, Get, HttpCode (+5 more)

### Community 44 - "Policy Document Tests"
Cohesion: 0.13
Nodes (17): approvals, approveEveryStep(), asUser(), bringIntoForce(), documents, FORCE_FROM, forceInPlace(), ids (+9 more)

### Community 45 - "Browser Verification Harness"
Cohesion: 0.16
Nodes (11): main(), main(), Browser, campaign_in_progress(), check(), free_port(), login(), main() (+3 more)

### Community 46 - "Snapshot Staging Store"
Cohesion: 0.17
Nodes (6): SnapshotStagingStore, Injectable, StepUpService, Injectable, ttlSeconds(), ensureRedisReady()

### Community 47 - "LLM Gateway Doc Concepts"
Cohesion: 0.12
Nodes (20): guardrail-audit Skill, Local Infrastructure Stack, FR-C-010 Entitlement Filtering, FR-C-013 Answer Generation, FR-C-014 Classification Gate, FR-C-015 Sensitive Data Redaction, FR-C-016 Gateway Logging, FR-C-017 Circuit Breaker (+12 more)

### Community 48 - "Root TypeScript & Vitest Config"
Cohesion: 0.10
Nodes (19): test/**/*.ts, vitest.config.ts, compilerOptions, allowJs, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, lib (+11 more)

### Community 49 - "Snapshot CSV Parsing"
Cohesion: 0.16
Nodes (17): ACCOUNT_STATUSES, buildErrorFile(), buildTemplate(), csvCell(), detectDelimiter(), FileFormatError, KNOWN_COLUMNS, parseDate() (+9 more)

### Community 50 - "Minor Cluster 50"
Cohesion: 0.11
Nodes (19): eslint, eslint-import-resolver-typescript, @eslint/js, eslint-plugin-import, devDependencies, eslint, eslint-import-resolver-typescript, @eslint/js (+11 more)

### Community 51 - "Minor Cluster 51"
Cohesion: 0.29
Nodes (9): ExternalAccessController, Body, Controller, Delete, Get, HttpCode, Param, Post (+1 more)

### Community 52 - "Minor Cluster 52"
Cohesion: 0.15
Nodes (9): NotificationController, Controller, Get, Param, Post, Query, Req, NotificationService (+1 more)

### Community 53 - "Minor Cluster 53"
Cohesion: 0.20
Nodes (15): ApplicationRow, CampaignPreview, createCampaign(), fail(), launchCampaign(), previewCampaign(), Result, SessionUser (+7 more)

### Community 54 - "Minor Cluster 54"
Cohesion: 0.21
Nodes (16): bearer(), commitUpload(), fetchCsv(), fetchErrorFile(), fetchTemplate(), Result, UploadIssue, UploadWarning (+8 more)

### Community 55 - "Minor Cluster 55"
Cohesion: 0.13
Nodes (10): ControlInput, ControlListFilter, ControlPatch, RISK_LEVELS, FrameworkItemImport, MappingInput, CreateAttestationCampaignInput, prisma (+2 more)

### Community 56 - "Minor Cluster 56"
Cohesion: 0.19
Nodes (7): Directory, ResolvableLine, ReviewerResolver, ReviewerRuleCode, Injectable, directory, resolver

### Community 57 - "Minor Cluster 57"
Cohesion: 0.23
Nodes (11): EvidenceInput, LinkInput, VersionInput, coversPeriod(), isExpired(), iso(), Period, PeriodVerdict (+3 more)

### Community 58 - "Minor Cluster 58"
Cohesion: 0.14
Nodes (16): Modul A - Evidence Vault, Modul B - Access Review, Modul C - Policy Hub, Shared Evidence Store, SIGAP Platform, OJK Regulatory Obligation, Manual UAR Cost Problem, FR-A-008 Reminder and Escalation (+8 more)

### Community 59 - "Minor Cluster 59"
Cohesion: 0.13
Nodes (11): ENGAGEMENT_CODE_PREFIX, EngagementInput, EngagementListFilter, FIRM_WIDE_ROLES, TRANSITIONS, FindingInput, SLA_DAYS, TRANSITIONS (+3 more)

### Community 60 - "Minor Cluster 60"
Cohesion: 0.26
Nodes (8): cmd_status(), is_running(), main(), resolve_targets(), say(), dev.sh script, start_one(), stop_one()

### Community 61 - "Minor Cluster 61"
Cohesion: 0.18
Nodes (8): ANOMALY_CODES, FINDING_STATUSES, RISK_LEVELS, ANOMALY_LABELS, AnomalyExceptionInput, AnomalyFilter, AnomalyService, Injectable

### Community 62 - "Minor Cluster 62"
Cohesion: 0.23
Nodes (8): AuthenticatedPrincipal, Credentials, IdentityProvider, ADR-0006, UserAttributes, SeedIdentityProvider, ADR-0006, Injectable

### Community 63 - "Minor Cluster 63"
Cohesion: 0.16
Nodes (13): anomalyService, asUser(), createdSnapshots, detection, file(), ids, ingest(), prisma (+5 more)

### Community 65 - "Minor Cluster 65"
Cohesion: 0.27
Nodes (3): EngagementService, Injectable, newEngagement()

### Community 68 - "Minor Cluster 68"
Cohesion: 0.27
Nodes (12): approximateTokens(), Chunk, chunkDocument(), Heading, HEADING_PATTERNS, makeChunk(), matchHeading(), overlapTail() (+4 more)

### Community 69 - "Minor Cluster 69"
Cohesion: 0.21
Nodes (11): approvals, approveReviews(), asUser(), createDoc(), documents, ids, principalOf(), prisma (+3 more)

### Community 70 - "Minor Cluster 70"
Cohesion: 0.22
Nodes (11): asUser(), attestations, createCampaign(), daysAgo(), daysFromNow(), ids, launchAndTakeTask(), LONG_BODY (+3 more)

### Community 71 - "Minor Cluster 71"
Cohesion: 0.18
Nodes (12): asUser(), createdSnapshots, file(), ids, ingest(), prisma, revocations, snapshots (+4 more)

### Community 73 - "Minor Cluster 73"
Cohesion: 0.27
Nodes (10): RowIssue, StagedRow, StagedUpload, StagedWarning, CommitInput, contentHash(), MAX_UPLOAD_BYTES, ROW_COUNT_DROP_THRESHOLD (+2 more)

### Community 74 - "Minor Cluster 74"
Cohesion: 0.35
Nodes (8): ActionError, ActionResult, claimTicket(), completeTicket(), exceptTicket(), run(), verifyTicketNow(), TicketActions()

### Community 75 - "Minor Cluster 75"
Cohesion: 0.17
Nodes (12): spec-guardian Agent, Docs Are Source of Truth, verify-docs Skill, Eight User Personas, 41 User Stories, 85 Functional Requirements, REST API Contract, Implementation Progress Report (+4 more)

### Community 76 - "Minor Cluster 76"
Cohesion: 0.27
Nodes (9): buildDiff(), collapseUnchanged(), diffDocuments(), DiffHunk, DiffKind, DiffLine, DiffSummary, DocumentDiff (+1 more)

### Community 77 - "Minor Cluster 77"
Cohesion: 0.22
Nodes (6): AuditController, Controller, AuditService, ChainVerification, ADR-0004, Injectable

### Community 78 - "Minor Cluster 78"
Cohesion: 0.20
Nodes (9): description, engines, bun, name, private, version, workspaces, apps/* (+1 more)

### Community 79 - "Minor Cluster 79"
Cohesion: 0.20
Nodes (9): compilerOptions, composite, noEmit, outDir, rootDir, extends, include, src (+1 more)

### Community 80 - "Minor Cluster 80"
Cohesion: 0.25
Nodes (9): security-reviewer Agent, critical-controls Skill, Every Write Goes Through UnitOfWork, FR-X-008 Audit Trail, ADR-04 Evidence and Audit Integrity, Ten Critical Controls K-1 to K-10, K-7 Audit Log Immutability, K-8 Evidence Integrity (+1 more)

### Community 81 - "Minor Cluster 81"
Cohesion: 0.32
Nodes (4): REQUIRES_STEP_UP, StepUpGuard, stepUpRequired(), Injectable

### Community 82 - "Minor Cluster 82"
Cohesion: 0.29
Nodes (6): boundaryZones, ADR-0001, ADR-0003, MODULES, moduleRoot, ADR-0001

### Community 83 - "Minor Cluster 83"
Cohesion: 0.25
Nodes (7): compilerOptions, composite, noEmit, extends, include, ../../tsconfig.json, seed

### Community 84 - "Minor Cluster 84"
Cohesion: 0.29
Nodes (6): collection, compilerOptions, deleteOutDir, tsConfigPath, $schema, sourceRoot

### Community 85 - "Minor Cluster 85"
Cohesion: 0.33
Nodes (3): LlmGatewayController, Controller, Get

### Community 86 - "Minor Cluster 86"
Cohesion: 0.47
Nodes (3): extractBlocks(), main(), setupDom()

### Community 87 - "Minor Cluster 87"
Cohesion: 0.60
Nodes (5): LoginDto, StepUpDto, IsNotEmpty, IsString, MaxLength

### Community 88 - "Minor Cluster 88"
Cohesion: 0.40
Nodes (3): Body, Post, Req

### Community 89 - "Minor Cluster 89"
Cohesion: 0.40
Nodes (5): SetGatewayEnabledDto, IsBoolean, IsString, MaxLength, MinLength

### Community 90 - "Minor Cluster 90"
Cohesion: 0.40
Nodes (3): inter, jetbrainsMono, metadata

### Community 91 - "Minor Cluster 91"
Cohesion: 0.50
Nodes (4): Trimegah Brand Guideline, UI Flow and Wireframes, Design Token System, Typographic Scale

### Community 92 - "Minor Cluster 92"
Cohesion: 0.50
Nodes (4): trustedDependencies, prisma, @prisma/engines, unrs-resolver

## Knowledge Gaps
- **554 isolated node(s):** `$schema`, `Bash(python3 .claude/skills/verify-docs/scripts/verify.py:*)`, `Bash(python3 .claude/skills/run-eval/scripts/gate.py:*)`, `Bash(node .claude/skills/verify-docs/scripts/check-mermaid.mjs:*)`, `Bash(git status:*)` (+549 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SigapRequest` connect `Campaign API Controller` to `Control Library Service`, `Document Answer & Scoping`, `Campaign Builder Service`, `Access Module DTOs`, `Authorization & Auth Guard`, `App Bootstrap & Env Loading`, `Evidence Stage-2 DTOs`, `Attestation Campaign Controller`, `Policy Module DTOs`, `Audit Recorder`, `Evidence Item Controller`, `Access Module Wiring`, `Document Controller`, `Anomaly Controller & SoD DTOs`, `Application Controller`, `Snapshot Controller`, `Review Item Controller`, `Minor Cluster 51`, `Minor Cluster 52`, `Minor Cluster 55`, `Minor Cluster 61`, `Minor Cluster 77`, `Minor Cluster 81`, `Minor Cluster 88`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **Why does `Principal` connect `Campaign Builder Service` to `Campaign API Controller`, `Control Library Service`, `Document Answer & Scoping`, `Access Module DTOs`, `Authorization & Auth Guard`, `Request Context & Evidence Tests`, `Review Decision Service`, `Anomaly & SoD Detection`, `Attestation Campaign Controller`, `Evidence Item Service`, `Answer Service & Search Repo`, `Shared Constructors`, `Document Lifecycle Rules`, `Evidence Item Controller`, `Access Module Wiring`, `Application Controller`, `Review Item Controller`, `Policy Document Tests`, `Snapshot Staging Store`, `Minor Cluster 55`, `Minor Cluster 57`, `Minor Cluster 59`, `Minor Cluster 61`, `Minor Cluster 63`, `Minor Cluster 64`, `Minor Cluster 65`, `Minor Cluster 66`, `Minor Cluster 67`, `Minor Cluster 69`, `Minor Cluster 70`, `Minor Cluster 71`, `Minor Cluster 72`, `Minor Cluster 73`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Why does `@prisma/client` connect `Minor Cluster 55` to `Access Module Wiring`, `Control Library Service`, `Document Answer & Scoping`, `Campaign Builder Service`, `Access Module DTOs`, `Document Lifecycle Rules`, `Review Item Controller`, `Review Decision Service`, `Seed Catalogue & Module Data`, `Anomaly & SoD Detection`, `Evidence Stage-2 DTOs`, `Policy Module DTOs`, `Notification Service & Prisma`, `Minor Cluster 57`, `Minor Cluster 59`, `Minor Cluster 92`, `Minor Cluster 61`, `Audit Recorder`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **What connects `$schema`, `Bash(python3 .claude/skills/verify-docs/scripts/verify.py:*)`, `Bash(python3 .claude/skills/run-eval/scripts/gate.py:*)` to the rest of the system?**
  _554 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Campaign API Controller` be split into smaller, more focused modules?**
  _Cohesion score 0.07292929292929293 - nodes in this community are weakly interconnected._
- **Should `Foundation SQL Migration` be split into smaller, more focused modules?**
  _Cohesion score 0.06298904538341157 - nodes in this community are weakly interconnected._
- **Should `Next.js App Screens` be split into smaller, more focused modules?**
  _Cohesion score 0.07161125319693094 - nodes in this community are weakly interconnected._