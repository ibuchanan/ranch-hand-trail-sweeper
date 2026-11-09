# Spec: Deep Code Review for Atlassian Forge (Agent Skills + Review Loops)

| | |
|---|---|
| **Author** | Ian Buchanan |
| **Date** | 2026-11-09 |
| **Status** | Draft — research consolidated, no implementation committed |
| **Provenance** | Derived from a research session (this document *is* the artifact of that conversation) |
| **Scope** | Agent skills and automation for reviewing code — anchored on Atlassian Forge apps and their supporting libraries |

---

## 1. Problem statement

Existing AI code-review tools — including the official Atlassian Forge skills — are good at **broad concepts** but weak at **finding meaningful bugs**. They behave as *checklists*: enumerate categories, render opinions ("consider error handling," "watch for N+1"). They pattern-match abstractions rather than proving a specific defect is **reachable**.

> **The observed gap:** the tools are OK at very broad concepts, but a review doesn't find meaningful, *unexpected* bugs.

The thesis of this spec is that finding real bugs is a **different loop** than reviewing:

> **hypothesis → refutation → executable proof**

Category enumeration is not that loop. Coverage without refutation multiplies false positives; refutation without execution is still opinion.

---

## 2. Goals & non-goals

### Goals
- Identify and document **prior art** in deep-review engines (methodology, not just tool names).
- Identify automation that wraps review in **loops** (self-review, self-healing CI, adversarial rounds).
- Define a **stacked architecture** (loop layer + engine layer + domain layer) that layers Forge-domain knowledge underneath a deep-review engine.
- Preserve the **design vocabulary** (the axes that distinguish engines) so future choices are principled.

### Non-goals
- Do **not** build a specific skill in this spec (deferred).
- Do **not** select a single vendor tool as "the answer."
- Do **not** put customer/corporate Forge code on the home lab (see §4).

---

## 3. Context & constraints (the operative environment)

| Constraint | Value |
|---|---|
| Developer model | Solo developer; **trunk-based** (no PR-formal review by default); self-review is the norm |
| Reviewer gap | There is **no second human reviewer** — an automated loop must fill that role |
| Pipeline | **Dagger** (same graph locally and in CI); optionally GitHub Actions / Bitbucket Pipelines |
| Agent CLI | Rovo Dev CLI (target), plus local coding agents |
| Cost posture | Cost-conscious but pays for quality; local-first; LM Studio available |
| Data boundary | **Home lab is personal-only — no customer or corporate Forge data** |
| Runtime prereqs (Forge skills) | Node.js 22+, Python 3 on PATH |

**Implication:** a *productized PR bot* (CodeRabbit, Greptile, …) is a poor fit for trunk-based, pre-PR self-review. The useful layer is a **local, Dagger-driven review loop** that runs before/at commit.

---

## 4. Domain layer: Atlassian Forge

### 4.1 Official skills (the domain layer that already exists)
Source: `atlassian/forge-skills` (Apache-2.0), installable via `npx skills add atlassian/forge-skills` or `/plugin install forge-skills@atlassian-forge-skills`. Requires Node 22+, Python 3.

| Skill | Role |
|---|---|
| `forge-app-review` | General pre-deploy review front-door (manifest/module wiring, architecture, cost, performance, triggers). ~18 checks (`CST-01…18`). |
| `forge-security-review` | White-box security audit: authz, injection, tenant isolation, secrets, egress/remotes, web triggers; static-analysis workflow (FSRT, Semgrep + Forge rules, `npm audit`, Snyk, gitleaks). |
| `forge-cost-optimizer` | Platform-consumption audit (invocations, storage writes, logs, memory, triggers, bridge offload). |
| `forge-debugger` | Troubleshooting (deploy errors, resolver failures, blank UI, scopes). |
| `forge-app-builder` / `forge-connector` / `forge-onboarding` | Build/connect/onboarding. |

Bundled MCP servers: **Forge MCP Server** (live docs, manifest syntax, UI Kit/backend API) and **ADS MCP Server** (Atlassian Design System / `@atlaskit` lookup for Custom UI).

### 4.2 Libraries the review must reason about
`@forge/react` (UI Kit — `useProductContext`, `ForgeReconciler`), `@forge/bridge` (Custom UI — `invoke()`, `view.getContext()`, CSP), `@forge/resolver`, `@forge/api` (`requestJira`/`requestConfluence`, `asApp()` vs `asUser`), `@forge/teamwork-graph`, `@atlaskit`.

### 4.3 Forge invariants to bake into a deep-review engine
*(equivalent to how `regorus` bakes Rego/FFI invariants into its review prompt)*

- **Resolver boundary / privilege:** `asApp()` vs `asUser()` — privilege escalation when a user-context operation runs as the app.
- **Tenant isolation:** does a key/ID from one tenant ever index another tenant's data in KVS / entity properties?
- **Event & trigger idempotency/ordering:** Jira/Confluence webhooks retry; `ignoreSelf`; at-least-once delivery.
- **Storage semantics:** TTL / eventual-consistency races; partial-write corruption; KVS writes ≈ 20× reads.
- **Invocation/GB-second cost** treated as a *correctness-adjacent* smell (chatty resolvers, N+1, missing `maxResults`/`fields`).
- **Custom UI:** `invoke()` in render body, CSP/iframe boundary, `view.getContext()` staleness on config change.

---

## 5. Prior art — deep-review engines

### 5.1 Lineage
1. **`PlatformPlatform` (Thomas Jespersen)** — origin of "fleet of narrow-scope reviewer agents + cross-examination." Nearly all local engines descend from or port it.
2. **Anthropic `/ultrareview` → `/code-review ultra`** (Claude Code v2.1.111, 2026-04-16) — cloud sandbox, **5–20 reviewer agents**, **independent reproduction of every finding** before surfacing. 5–20 min, $5–25/run. Local `/code-review` = single pass.
3. **Anthropic official `code-review` plugin** — 5 parallel agents (CLAUDE.md compliance, bug scan, git history, prior PR comments, code comments) → numeric confidence 0–100, post ≥80. **Documented failure mode:** the ≥80 threshold suppressed a *real* auth bug scored 75 (scoring agent read the commit message and inferred intent).
4. **`alexrolls/ultra-review`** — 4 rounds: discovery (N narrow-scope agents in parallel) → **cross-review (disprove peers)** → finalization (survivors strengthened) → digest. Key decisions: **orchestrator never writes findings**; **agents communicate via filesystem artifacts**, not return values; **categorical confidence** (Certain/Likely/Possible) over percentages.
5. **`microsoft/regorus` `.github/skills/deep-review`** — 3 phases: parallel discovery with **different methodologies/models** (broad scanner / value-flow tracer / safety specialist) → **risk-triggered micro-passes** → **cold-start adversarial verifier that also hunts what everyone missed**. Bakes **domain invariants** into the prompt.
6. **Hunter/Skeptic/Referee family** — `b-open-io` (compact); **`codexstar69/bug-hunter`** (adds a benchmark quality gate: precision/recall/F1/calibration). Unreconciled items → `MANUAL_REVIEW`, never silently "clean."
7. **`HermaGuard` v2.1** (Hermes-native via batched `delegate_task`) — synthesis of 8 prior implementations (Trail of Bits `differential-review`, BMAD edge-case-hunter/adversarial-general, bmad-code-review, dementev-dev adversarial-review, Anthropic `claude-code-security-review`, Anthropic Review Plugin, r/ClaudeAI adversarial prompt). Advances: **deterministic floor** (semgrep/bandit/eslint/gosec/ruff) under LLM ceiling; **VERIFIED/REFUTED from sandbox execution output, never model self-report**; **32-bug-class coverage checklist** (a gap *fails* the check); **closed learning loop** (dismiss an FP 3× → suppression rule).
8. **Executable-proof family** — `liza/black-box-red-testing` (hypothesis → failing test, keep only reds); `Akanoa/skill-darwin` (mutation-verified TDD); `IgorWarzocha/adversarial-qa` (executable counterexamples + fuzzing).
9. **Method references** (read, don't install) — `octomind/code-review-lenses`, `lox/agent-skills/adversarial-code-reviewing`, `ncoevoet/review-all`, `farfield/deep-review`.

### 5.2 The design axes (the vocabulary)
| Axis | Spectrum | Exemplar |
|---|---|---|
| Where the fleet runs | cloud sandbox ↔ local worktrees ↔ same session | ultra (cloud), `cogine/local-ultra-review` (worktrees) |
| Verification model | reproduce (re-run) ↔ **refute** ↔ executable PoC ↔ confidence score | ultra (reproduce), ultra-review (refute), HermaGuard/darwin (execute) |
| Agent comms | return values ↔ **filesystem artifacts** | ultra-review (files survive context) |
| Orchestrator role | also reviews ↔ **never writes findings** | ultra-review ("separation is load-bearing") |
| Confidence | numeric ↔ **categorical** | ultra-review (categorical on purpose) |
| Domain anchoring | generic ↔ **invariants in prompt** | regorus |
| Floors vs ceiling | LLM-only ↔ **deterministic pre-scan + LLM** | HermaGuard, bug-hunter |

**Cross-cutting pattern:** *narrow parallel scopes → adversarial refutation → execution as arbiter.*

---

## 6. Prior art — automation & review loops

### 6.1 Productized PR review bots (loop = "PR open → bot comments")
Not a fit for trunk-based pre-PR self-review, but listed for completeness.

| Tool | Position | Price |
|---|---|---|
| CodeRabbit | broadest platform reach (**incl. Bitbucket**), diff-level, low noise | $24/dev/mo |
| Greptile | full-repo indexing per PR; claims >50% more bugs than CodeRabbit (50 OSS PRs) | $30/seat/mo |
| Qodo Merge / PR-Agent | OSS lineage (community-governed Apr 2026), Jira-ticket compliance | free / $30 |
| Cursor Bugbot | PR review + can dispatch fixes to cloud agents | ~$1–1.5/review |
| GitHub Copilot code review | bundled, mid-tier | included |
| Macroscope | usage-based; top scorer in an independent 118-bug benchmark (~48%) | ~$0.95/review |
| Graphite Diamond | stacked-PR aware (Cursor acquired Graphite 2025-12) | $20–40 |
| Ito / CodeAnt / Sourcery / Bito | long tail | $15–59 |

**Caveat:** vendor benchmarks conflict (Greptile, Macroscope, CodeRabbit each publish self-favoring results). Independent reference: **Martian leaderboard**. Validate on your own corpus (HermaGuard's score-only benchmark harness is the model).

### 6.2 Loop architectures (the "loops")
1. **Agent self-review loop** (review-then-implement) — agent reviews its own diff before PR. **GitHub Copilot coding agent ships this natively** (self-review + code scanning + secret scanning + dep-CVE). Cap at **2–3 rounds** (diminishing returns); beware **confirmation bias**.
2. **Committee review** — same loop with *independent* reviewers instead of self-review (what §5 engines are).
3. **Self-healing CI (Dagger pattern)** — CI fails → agent reads failure → iteratively fixes → re-runs → posts diff as **PR code suggestions**. Dagger's `DebugTests` + a `Workspace` module exposing `ReadFile/WriteFile/ListFiles/RunTests/RunLint` as tools; **reuses existing Dagger Functions** so it runs identically locally and in CI.
4. **Continuous coding loop ("Ralph Wiggum")** — pick task → implement → validate → commit → update status → **reset context** → repeat. `AGENTS.md` = cross-iteration memory. **Compound loops** chain analysis → planning → execution.
5. **Evaluator/verifier gate loop** — per-task evaluator subagent in **fresh context**; reads a **contract file** ("what done means") + diff; returns **BLOCK/RETRY/PASS** with a structured score.
6. **Multi-round adversarial loop** — find → cross-examine → finalize → digest, run to convergence.

**Loop discipline:** max-rounds cap with human escalation on non-convergence; **convergence detection** (stop when a round surfaces nothing new — cf. `skill-darwin` round classification `converging/partial/recurring/flat/converged`); guard against **overcorrection** (LLMs flag correct code as non-compliant; demanding justifications *worsens* FP rate).

### 6.3 CI glue
**reviewdog** (any analyzer → inline MR comments, GitHub/GitLab/**Bitbucket**), **Danger**, **Claude Code GitHub Action**, **Dagger** (same graph local & CI).

---

## 7. Proposed architecture (parked, not built)

Three stacked layers:

```
┌───────────────────────────────────────────────────────────┐
│ LOOP LAYER   Dagger-orchestrated review→fix→re-run loop    │
│              gated by convergence detection + max-rounds   │
│              (fills the missing human reviewer)            │
├───────────────────────────────────────────────────────────┤
│ ENGINE LAYER deterministic pre-scan → parallel adversarial │
│              agents → sandboxed PoC verification           │
│              + refutation round                            │
│              (HermaGuard shape + ultra-review refutation)  │
├───────────────────────────────────────────────────────────┤
│ DOMAIN LAYER Forge invariants (asApp/asUser, tenant        │
│              isolation, trigger idempotency, storage races)│
│              + official forge-* skills as the front-door   │
└───────────────────────────────────────────────────────────┘
```

**Notable gap in the prior art:** nobody has yet combined *deterministic floor + sandboxed-PoC verification + refutation round + domain invariants* into one engine. HermaGuard has floor+PoC; ultra-review has refutation; regorus has domain-invariants; the Forge skills have the domain. The composition is the novel part.

---

## 8. Requirements (draft)

### Functional
- **F1** Findings must be **diff-anchored and evidence-only**: `file:line`, concrete failure scenario, why the change made the path reachable.
- **F2** A **deterministic pre-scan floor** runs before any LLM agent (language scanners + Forge `lint`).
- **F3** Reviewers run as **parallel narrow scopes**; at least one pass is **adversarial refutation**.
- **F4** High-severity findings require **executable proof** (failing test / PoC / reproduction), not prose.
- **F5** **Domain invariants** (§4.3) are injected into reviewer prompts.
- **F6** Runs **locally and under Dagger** with one command; reusable as CI step.

### Non-functional
- **N1** Read-only by default (finds, doesn't fix) unless a fix loop is explicitly invoked.
- **N2** **Bounded** (max rounds), escalates to human on non-convergence.
- **N3** Cost-aware — tier models (cheap for triage, strong for adjudication).
- **N4** No corporate Forge data off the home lab (§3).
- **N5** Findings emit structured JSON for CI/dashboards and precision tracking.

---

## 9. Open questions / risks

- **Threshold risk:** numeric confidence filters (Anthropic plugin) can suppress real bugs. Prefer **categorical** confidence + explicit "what would close the gap."
- **Confirmation bias** in self-review (same-context reviewer shares generator blind spots) → prefer independent/cross-model reviewers.
- **Overcorrection:** LLMs flag correct code; requiring justifications worsens FP rate.
- **Convergence:** how to decide the loop has stopped surfacing *new* issues without a fixed round count.
- **Benchmark honesty:** vendor detection-rate claims are unverifiable; build a **local seeded corpus** with ground truth.
- **Forge-specific:** which invariants are mechanically detectable vs only heuristically checkable?

---

## 10. Next steps (deferred by request)

1. Stand up **HermaGuard** locally to observe the sandboxed verifier on a real repo (personal, non-corporate).
2. Calibrate on a seeded bug corpus; measure precision/recall/F1.
3. Only then wrap Forge invariants + Dagger loop around the engine.

> **Explicitly out of scope for now:** building a specific `forge-deep-review` skill.

---

## Appendix A — Sources

**Deep-review engines**
- `github.com/platformplatform/PlatformPlatform` (concept origin)
- `code.claude.com/docs/en/ultrareview` (Anthropic `/ultrareview`)
- `github.com/anthropics/claude-plugins-official` (`code-review` plugin)
- `github.com/alexrolls/ultra-review` (4-round adversarial)
- `github.com/cogine-ai/local-ultra-review` (local `/ultrareview` recreation)
- `github.com/microsoft/regorus` → `.github/skills/deep-review/SKILL.md`
- `github.com/codexstar69/bug-hunter`; `github.com/b-open-io/.../hunter-skeptic-referee`
- `github.com/Sahil-SS9/hermaguard` (Hermes-native; v2.1)
- `github.com/liza-mas/liza` (black-box-red-testing); `github.com/Akanoa/skill-darwin` (mutation); `github.com/IgorWarzocha/.../adversarial-qa`
- `octomind.run/tap/skills/code-review-lenses`; `github.com/lox/agent-skills`; `github.com/ncoevoet/claude-review-all`; `github.com/Farfield-Dev/deep-review`

**Review loops / automation**
- `agentpatterns.ai/code-review/agent-self-review-loop` (self-review loop; committee pattern)
- `dagger.io/blog/automate-your-ci-fixes-self-healing-pipelines-with-ai-agents` (Dagger self-healing CI)
- `github.com/ghuntley.com/ralph` + `github.com/snarktank/compound-product` (Ralph Wiggum / compound loops)
- `github.com/obra/superpowers` (`requesting-code-review` / `receiving-code-review`)
- `addyosmani.com/blog/self-improving-agents` (agent loop engineering, `AGENTS.md`)
- `github.com/reviewdog/reviewdog`; Semaphore self-healing CI; Elastic Labs self-correcting monorepo
- Bot comparisons: Dupple, Coderbuds, Greptile content library, Macroscope (118-bug benchmark), Martian leaderboard

**Forge domain**
- `github.com/atlassian/forge-skills`
- `developer.atlassian.com/platform/forge/ai-development-toolkit/` (skills + Forge AI Plugin + MCP servers)

---

*End of spec.*
