---
name: superpowers
description: "Disciplined software engineering methodology for AI coding assistants. Enforces a structured pipeline: brainstorming intent -> breaking work into bite-sized plans -> Test-Driven Development (TDD) -> execution -> two-stage review."
---

# Superpowers: Disciplined Engineering & TDD Workflow

Superpowers is an opinionated software engineering methodology that prevents "vibe coding" (jumping straight into writing code without thinking) and enforces production-grade engineering rigor.

---

## 1. The Core Loop

Whenever implementing a feature, fix, or refactor, always execute in this exact sequence:

```
+-------------------------------------------------------------------------+
| 1. BRAINSTORM & CLARIFY                                                 |
|    - Understand intent, inspect requirements in docs/                   |
|    - Ask clarifying questions on ambiguities; challenge edge cases     |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| 2. WRITE IMPLEMENTATION PLAN                                            |
|    - Break task into bite-sized, atomic steps (2-5 min each)            |
|    - Define explicit file paths, test commands, and success criteria    |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| 3. TEST-DRIVEN DEVELOPMENT (TDD)                                        |
|    - Step A (RED): Write a failing unit/integration test first          |
|    - Step B: Run test, verify it fails for the expected reason         |
|    - Step C (GREEN): Write the MINIMAL implementation code to pass      |
|    - Step D: Run test, verify it passes cleanly                        |
|    - Step E (REFACTOR): Clean up, remove duplicates, keep minimal       |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| 4. TWO-STAGE REVIEW                                                     |
|    - Stage 1: Spec Compliance (Did we fulfill the exact FRD IDs?)       |
|    - Stage 2: Code Quality (Clean code, zero bloat, pass all lints)     |
+-------------------------------------------------------------------------+
```

---

## 2. Rules That Must Never Be Broken

1. **No Production Code Before a Failing Test**:
   - For all business logic (stamina calculation, material deficit, domain schedule, gacha pity), the test **MUST** exist and fail before writing the implementation function.
2. **Atomic Steps**:
   - Do not attempt large multi-file refactors in a single pass. Finish one function + test, verify green, then proceed to the next.
3. **Keep Code Minimal**:
   - Write only enough code to pass the test. Do not add speculative features or dead flexibility.
4. **Verification Before Completion**:
   - Never declare a task complete without running the entire test suite and build command to prove nothing is broken.
