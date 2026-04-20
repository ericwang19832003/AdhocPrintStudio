# Claude Task Memory Templates — Design

**Date:** 2026-04-20
**Status:** Design — awaiting implementation plan
**Topic:** A repo-local memory layer for long-running Claude Code sessions, harness loops, and multi-session orchestration. Coexists with the existing auto-memory system (slow-moving facts) and the harness's per-session `TaskCreate` tooling (within-session tracking).

## Goals

1. A session can be reset (or `/clear`-ed) at any time without losing important state.
2. Context doesn't grow unboundedly and degrade model performance.
3. A brand-new agent can take over a task within **5 minutes** by reading the memory files.
4. An orchestrator (script, scheduled trigger, dashboard) can read task status programmatically.
5. Repeated work and back-and-forth on the same problem across sessions is reduced.

## Non-goals

- Replacing the auto-memory system (`~/.claude/projects/.../memory/`). That layer is for slow-moving facts about the user/project and stays as-is.
- Replacing the harness's `TaskCreate`/`TaskUpdate` tooling. Those remain for within-session, fine-grained step tracking.
- Multi-machine real-time coordination. Files are local; promoting to git-committed gives multi-machine read-only sharing — that's the ceiling.
- Locking / concurrent-write safety. Coordination is via the `owner`/`session_id` fields in STATUS frontmatter; agents respect each other.
- Dark mode, dashboards, or a full CLI. A `claude-task` shell script is offered but optional.

## The three coexisting layers

| Layer | Where | Lifetime | Granularity | Purpose |
|---|---|---|---|---|
| **Auto-memory** (existing) | `~/.claude/projects/.../memory/` | Months/years | Stable facts | User profile, feedback, project background, references |
| **Task memory** (this design) | `<repo>/.claude-task/<slug>/` | Hours-to-weeks | Per piece of work | Cross-session handoff: decisions, log, artifacts |
| **Harness tasks** (existing) | `~/.claude/tasks/<session>/<id>.json` | One session | Per checklist step | Within-session step tracking via TaskCreate/Update |

Bridging rules are in §Lifecycle below.

## Architecture

### Folder layout

```
<repo-root>/
  .claude-task/
    ACTIVE                  # 1-line file: the task slug a fresh agent picks up
    README.md               # protocol explainer (committed)
    <task-slug-1>/          # one folder per task, slug-named
      STATUS.md
      BRIEF.md
      NEXT.md
      DECISIONS.md
      LOG.md
      ARTIFACTS.md
    <task-slug-2>/
      ...
    _archive/
      <task-slug-old>/      # done or abandoned tasks moved here
        ...
  .gitignore                # adds two lines (see "gitignore pattern" below)
```

### Conventions

- **Slug:** lowercase-kebab from the title, ≤60 chars (`UI redesign Foundation` → `ui-redesign-foundation`). Stable for the task's lifetime — never rename.
- **Six files always present** even if mostly empty. Predictable structure means an arriving agent never wonders whether a file exists. Empty files contain a one-line "intentionally empty — see <other-file>" stub.
- **`ACTIVE`** is a one-line text file containing the slug only. If absent or empty, no task is "active" and the agent should ask the user.
- **`README.md`** is the only file in `.claude-task/` that's committed (so git-cloners learn the protocol). The rest is git-ignored — local working state.
- **Multiple `in_progress` tasks allowed**, but `ACTIVE` distinguishes which one a fresh session picks up by default.
- **Archival:** when status flips to `done` or `abandoned`, agent moves `<slug>/` → `_archive/<slug>/` and clears `ACTIVE` if it pointed there.

### File-by-file roles

| File | Job | Mutation | Read by takeover? |
|---|---|---|---|
| STATUS.md | Snapshot of current state + machine status (YAML frontmatter) | Overwritten frequently | **Yes (always)** |
| BRIEF.md | Goal, scope, success, constraints | Write-once at init | **Yes (always)** |
| NEXT.md | Concrete next 1–3 steps | Overwritten at every checkpoint | **Yes (always)** |
| DECISIONS.md | Irreversible choices + why-lines | Append-only | Skim |
| LOG.md | Append-only journal of significant events | Append; fold when >500 lines | Lazy / on demand |
| ARTIFACTS.md | Pointers to files / commits / PRs / URLs produced | Append-only | On demand |

## File templates

### `.claude-task/README.md` (committed; one per repo)

````markdown
# .claude-task/

Per-task working memory for long-running Claude Code sessions in this repo.

## How to use

- One folder per task: `<slug>/` (lowercase-kebab from the title).
- The file `ACTIVE` (one line) names the task a fresh Claude session picks up by default.
- Each task folder has six fixed files. Read order for a 5-min takeover:
  `STATUS.md` → `BRIEF.md` → `NEXT.md` → skim `DECISIONS.md` → open `LOG.md` only if needed.
- Done or abandoned tasks live under `_archive/`.
- This whole folder is git-ignored except this README.

## File reference

| File | Job |
|---|---|
| STATUS.md | Current state + machine-readable YAML frontmatter |
| BRIEF.md | Goal, scope, success criteria — written once |
| NEXT.md | Concrete next 1–3 steps |
| DECISIONS.md | Irreversible choices, append-only |
| LOG.md | Journal of significant events, append-only, soft-cap 500 lines |
| ARTIFACTS.md | Pointers to files / commits / PRs / URLs produced |

## Orchestrator API

The YAML frontmatter in `<slug>/STATUS.md` is the contract. Read it with any YAML parser:

```bash
for d in .claude-task/*/; do
  yq -f extract '"\(.task_id)\t\(.status)\t\(.owner)\t\(.updated)"' "$d/STATUS.md"
done
```
````

### `.claude-task/ACTIVE` (one line)

```
ui-redesign-foundation
```

### `<slug>/STATUS.md`

```markdown
---
task_id: {slug}
title: {one-line title}
status: not_started        # not_started | in_progress | blocked | awaiting_review | done | abandoned
owner: {claude-opus-4-7 | claude-sonnet-4-6 | <human-name> | unassigned}
session_id: {Claude session UUID, or null}
created: {YYYY-MM-DDTHH:MM:SSZ}
updated: {YYYY-MM-DDTHH:MM:SSZ}     # bump on every edit
parent_task: {parent slug or null}
blockers_open: 0
next_action_owner: {claude | human | unknown}
---

## Where we are

{One paragraph (≤80 words). Plain English. What's the current shape of the work.
This is what an arriving agent reads first. Update on every checkpoint.}

## Open questions / blockers

- {Bullet — open question or blocker. Empty list if none.}

## Recent log excerpt

{Optional: paste the last 3 LOG.md entries here for context. Skip if LOG is fresh.}
```

### `<slug>/BRIEF.md` (write-once)

```markdown
# {Title}

## Goal

{One paragraph: what we are building/fixing/learning, and why it matters.
Rarely changes after task init.}

## Scope

**In scope:**
- {Item}

**Out of scope:**
- {Item — be explicit; this prevents drift across resets.}

## Success criteria

- [ ] {Observable condition 1}
- [ ] {Observable condition 2}

## Constraints

- {Deadline, dependency, technical limit, stakeholder ask.}

## Source spec / link

{Path or URL to the design spec, ticket, or PR. Empty if none.}
```

### `<slug>/NEXT.md` (overwritten every checkpoint)

```markdown
# Next actions

> Overwritten on every checkpoint. Read top-to-bottom — do these in order.

## Now

{One concrete action. Specific enough an arriving agent can start without thinking.
Include exact file paths, commands, or commit hashes.}

## After that

1. {Step 2}
2. {Step 3}

## If blocked

{Fallback if "now" is blocked. Often: "ask the user about X" or "switch to task Y".}
```

### `<slug>/DECISIONS.md` (append-only, newest first)

```markdown
# Decisions

Append a new entry every time an irreversible choice is made. Newest at top.

## {YYYY-MM-DD} · {short decision in imperative form}

**Why:** {one paragraph — the reasoning so a future agent doesn't re-litigate.}
```

### `<slug>/LOG.md` (append-only, newest at top, soft-cap 500 lines)

````markdown
# Log

Append-only. Newest at top. Soft cap 500 lines — fold the oldest 200 into a single
summary block under `## Summarized through <date>` when exceeded.

## {YYYY-MM-DD HH:MM} · {short headline}

{1–3 sentences. What happened that future-you needs to know. Cite commits/PRs/files.}
````

When the file exceeds 500 lines, the next checkpoint inserts at the top:

```markdown
## Summarized through 2026-04-22

- {one bullet per major arc — decisions made, milestones hit, blockers cleared}
- {compress 200 oldest lines into 5–15 bullets}
```

…then deletes the 200 oldest entries. No information lost — compressed.

### `<slug>/ARTIFACTS.md` (append, chronological)

```markdown
# Artifacts

Pointers to outputs of this task. Append, don't edit. Newest at bottom.

| Date | Type | Reference | Notes |
|------|------|-----------|-------|
| {date} | {commit\|pr\|release\|file\|url} | {hash/url/path} | {one-liner} |
```

## Lifecycle protocols

### Init — create a new task

Trigger: user starts a piece of work expected to span more than one session, or that produces enough state to need handoff.

```
1. Pick a slug   (lowercase-kebab from the title, ≤60 chars)
2. mkdir .claude-task/<slug>
3. Drop the six template files into it
4. Fill BRIEF.md (write-once)                    — 5–10 min
5. Set STATUS.md frontmatter:                    — 30 sec
     status: not_started, owner, session_id, created/updated = now,
     blockers_open: 0, next_action_owner: claude
6. Write the first NEXT.md
7. Echo the slug into .claude-task/ACTIVE        — 1 sec
8. Append init entry to LOG.md
```

If `.claude-task/` doesn't exist yet, also drop the README.md template and add the gitignore pattern (see below).

**gitignore pattern.** Git does **not** honor `!` re-includes inside a fully ignored directory. To ignore `.claude-task/` contents while still committing `README.md`, use these two lines (note the trailing `*` on the first line):

```
.claude-task/*
!.claude-task/README.md
```

### Checkpoint — before reset, /clear, or handoff

Trigger: agent senses context-bloat risk, user asks for a checkpoint, session about to end. Should also fire at every natural pause — finishing a phase, hitting a blocker, switching focus.

```
1. Update STATUS.md:
     - rewrite "Where we are" paragraph (≤80 words)
     - bump `updated` timestamp
     - update `status` if it changed
     - update `blockers_open` count
     - paste last 3 LOG entries into "Recent log excerpt"
2. Overwrite NEXT.md with the literal next 1–3 things to do.
   Be specific: file paths, commands, hashes, URLs.
3. Append a LOG.md entry summarising what happened since the last checkpoint.
4. If a new irreversible choice was made: append to DECISIONS.md.
5. If a new artifact was produced (commit, PR, file, URL): append to ARTIFACTS.md.
6. If LOG.md > 500 lines: run Fold.
```

Target time: ≤2 minutes.

### Takeover — fresh agent picking up

Trigger: new session opens in this repo. Goal: working knowledge in 5 minutes.

```
1. cat .claude-task/ACTIVE                                     — 1 sec
2. cd .claude-task/$(cat .claude-task/ACTIVE)/                 — 1 sec
3. Read STATUS.md                                              — 30 sec
4. Read BRIEF.md                                               — 1 min
5. Read NEXT.md                                                — 30 sec
6. Skim DECISIONS.md (newest 5–10 entries)                     — 2 min
7. Update STATUS.md frontmatter:                               — 30 sec
     - owner: <new agent>
     - session_id: <new session UUID>
     - updated: now
8. (Optional) Open LOG.md only if confused or need backstory.
9. Mirror NEXT.md steps into harness TaskCreate calls and start.
```

Total: ~5 min worst case. **LOG.md is opt-in** — the central design choice that makes 5 min achievable.

### Fold — compress LOG.md when over 500 lines

```
1. Identify the 200 oldest entries (bottom of file).
2. Write a `## Summarized through <date>` block:
     - 5–15 bullets, one per major arc (decisions, milestones, blockers cleared)
     - preserve commit hashes, PR numbers, key file paths
3. Insert that block at the top of LOG.md (above the 300 most recent entries).
4. Delete the 200 original entries that were folded.
```

A folded LOG never grows the summary block beyond ~30 lines — re-folds compress prior summaries with the new oldest 200. Bounded forever.

### Archive — when status flips to `done` or `abandoned`

```
1. Final checkpoint — last STATUS update, last LOG entry, success-criteria check-off.
2. mv .claude-task/<slug> .claude-task/_archive/<slug>
3. If .claude-task/ACTIVE pointed to <slug>: clear it or update it to the next task.
4. (Optional) Append a one-liner to .claude-task/_archive/INDEX.md.
```

Archived tasks are read-only — preserved for history, grep, and audit.

### Where the protocols live (so agents follow them)

Add a snippet to the repo's **`CLAUDE.md`** so every Claude Code session in this repo sees the protocols at startup:

```markdown
## Working memory protocol

This repo uses `.claude-task/` for cross-session task memory. Before working:

1. Read `.claude-task/README.md` for the protocol.
2. `cat .claude-task/ACTIVE` to find the active task; if non-empty, do a takeover.
3. Checkpoint before context bloat or session end.
```

Without that snippet, agents won't know to look. With it, takeover/checkpoint becomes default behaviour.

## Orchestrator API examples

**All open tasks, one line each (bash + yq):**
```bash
for d in .claude-task/*/; do
  [ -f "$d/STATUS.md" ] || continue
  yq -f extract '. | "\(.task_id)\t\(.status)\t\(.owner)\t\(.updated)\t\(.blockers_open)"' \
    "$d/STATUS.md"
done
```

**Active task only:**
```bash
slug=$(cat .claude-task/ACTIVE 2>/dev/null)
[ -n "$slug" ] && yq '.status, .next_action_owner' ".claude-task/$slug/STATUS.md"
```

**Python (no yq dep):**
```python
import yaml, pathlib, re
for status_file in pathlib.Path(".claude-task").glob("*/STATUS.md"):
    text = status_file.read_text()
    m = re.match(r"---\n(.*?)\n---", text, re.S)
    if m:
        fm = yaml.safe_load(m.group(1))
        print(fm["task_id"], fm["status"], fm["updated"])
```

**Use cases enabled:**
- A `/loop` watcher that pings the user when `next_action_owner: human` and `status: blocked`.
- A scheduled cron trigger that summarises the day's task progress.
- A simple dashboard that lists open tasks across many repos by globbing `~/code/*/.claude-task/*/STATUS.md`.
- A pre-/clear hook that refuses to clear if `ACTIVE` points at a task whose STATUS hasn't been updated in this session.

## Optional helper: `claude-task` shell script

Not required for the design to work, but reduces ceremony:

```
claude-task init <slug> --title "..."     # init
claude-task checkpoint                    # opens $EDITOR on STATUS/NEXT/LOG
claude-task takeover                      # prints STATUS+BRIEF+NEXT to stdout
claude-task fold                          # manual fold trigger
claude-task archive [<slug>]              # defaults to ACTIVE
claude-task status                        # prints all tasks' frontmatter as a table
```

Defer until felt-needed. Templates are usable by hand from day one.

## Anti-patterns (explicit; avoid these)

- **Writing to LOG.md without updating STATUS.md** — orchestrator polls a stale snapshot. Every meaningful LOG entry should bump the STATUS `updated` timestamp at minimum.
- **Editing BRIEF.md after init** — it's write-once. If scope genuinely changes, add a DECISIONS entry ("scope expanded to include X — why: …") and let BRIEF stand. This preserves the original intent for blame/audit.
- **Skipping checkpoints "to save time"** — exactly how context bloats and goal #2 fails. A 2-min checkpoint every natural pause beats a 20-min reconstruction after a /clear.
- **Creating `.claude-task/<slug>/` for trivial one-shot work** — overhead defeats the purpose. Threshold: "expected to span more than one session OR produce non-trivial decisions worth preserving." A typo fix doesn't need a folder.
- **Multiple agents editing the same task simultaneously** — no locking. Coordinate via `owner` and `session_id` in STATUS.md frontmatter; if `session_id` is non-null and recent, another agent should take a different ACTIVE task or wait.
- **Storing secrets in any of these files** — they're plaintext on disk; if you ever decide to commit, secrets leak. Use environment vars / secrets managers as usual.
- **Letting auto-memory carry per-task state** — auto-memory is for slow-moving facts. Per-task working state belongs in `.claude-task/`. Mixing them makes both worse.

## Open questions / explicit deferrals

- **`claude-task` CLI** — deferred until felt-needed. Templates are usable by hand.
- **Status enum extensions** — `paused` (distinct from `blocked`) and `merged` (distinct from `done`) might prove useful but aren't included to keep the orchestrator parser simple. Add if real usage shows ambiguity.
- **Cross-repo orchestration UI** — out of scope. The Python/yq snippets above are enough to build one.
- **Locking** — not implemented. Convention via `owner`/`session_id` is the contract.
- **Hooks** — a Claude Code `Stop` hook could enforce a checkpoint on session end, and a `UserPromptSubmit` hook could surface the active task. Not in this spec; can be added by the user.
