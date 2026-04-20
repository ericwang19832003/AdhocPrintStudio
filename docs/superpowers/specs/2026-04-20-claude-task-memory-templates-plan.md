# Claude Task Memory Templates — Implementation Plan

**Date:** 2026-04-20
**Spec:** [`2026-04-20-claude-task-memory-templates-design.md`](./2026-04-20-claude-task-memory-templates-design.md)

## Strategy

The spec defines a folder layout, eight file templates, five lifecycle protocols, and an orchestrator API contract. There is no application to build — the artifact is a **set of template files plus a tiny init script** that drops those templates into any repo's `.claude-task/` directory.

To keep this generic and reusable across all the user's repos, the templates live in a small standalone directory (recommend: a new git repo `claude-task-templates`). One init script copies them into the active repo and fills the timestamps.

Acceptance criteria for the whole plan:
- A user in any repo can run one command and end up with a functioning `.claude-task/<slug>/` folder containing the six task files plus the README and ACTIVE pointer.
- The CLAUDE.md snippet from the spec can be appended to a target repo's `CLAUDE.md` (or created if missing) with one command.
- The bash + Python orchestrator snippets from the spec actually parse the generated frontmatter without errors.
- A second invocation in the same repo creates a second task without disturbing the first.

---

## Phase 0 — Decide where the templates live

### 0.1 Pick a host

- **(a)** A new dedicated git repo `claude-task-templates` (recommended). Lives wherever the user keeps personal repos; cloned once; usable from any other repo via the init script.
- **(b)** A subfolder of `~/.claude/templates/` (no git, machine-local).
- **(c)** A subfolder of an existing repo (e.g. AdhocPrintStudio's `scripts/`). Pollutes that repo with unrelated tooling.

This plan assumes **(a)**: a new repo at `C:\Users\Eric\claude-task-templates\`. If the user picks (b) or (c), all paths below shift accordingly.

**Verify:** `mkdir C:\Users\Eric\claude-task-templates && cd C:\Users\Eric\claude-task-templates && git init` succeeds.

---

## Phase 1 — Author the template files

Goal: a single folder of **plain template files**, each with `{placeholder}` markers exactly as in the spec, that the init script will copy.

### 1.1 Create folder structure

```
claude-task-templates/
  templates/
    README.md.tmpl                 # the .claude-task/README.md (committed-into-target-repo) version
    ACTIVE.tmpl                    # 1-line slug placeholder
    task/
      STATUS.md.tmpl
      BRIEF.md.tmpl
      NEXT.md.tmpl
      DECISIONS.md.tmpl
      LOG.md.tmpl
      ARTIFACTS.md.tmpl
  snippets/
    CLAUDE.md.snippet              # the working-memory protocol block to append to target CLAUDE.md
    gitignore.snippet              # the two .gitignore lines
  bin/
    claude-task-init               # the init script (Phase 2)
  README.md                        # repo-level README explaining usage
  LICENSE                          # MIT or as user prefers
```

### 1.2 Write each template

Copy verbatim from the spec's "File templates" section. **Placeholders** stay as literal `{slug}`, `{title}`, `{YYYY-MM-DDTHH:MM:SSZ}` etc. — the init script fills them.

For each template file:

| File | Source in spec | Notes |
|------|---------------|-------|
| `templates/README.md.tmpl` | `.claude-task/README.md` section | No placeholders; copied as-is to target. |
| `templates/ACTIVE.tmpl` | `.claude-task/ACTIVE` section | Single line: `{slug}\n` |
| `templates/task/STATUS.md.tmpl` | `<slug>/STATUS.md` section | All `{...}` placeholders preserved. |
| `templates/task/BRIEF.md.tmpl` | `<slug>/BRIEF.md` section | Placeholders preserved. |
| `templates/task/NEXT.md.tmpl` | `<slug>/NEXT.md` section | Placeholders preserved. |
| `templates/task/DECISIONS.md.tmpl` | `<slug>/DECISIONS.md` section | Header only, no example entries. |
| `templates/task/LOG.md.tmpl` | `<slug>/LOG.md` section | Header + one stub init-entry placeholder. |
| `templates/task/ARTIFACTS.md.tmpl` | `<slug>/ARTIFACTS.md` section | Header + empty table. |
| `snippets/CLAUDE.md.snippet` | "Where the protocols live" section | Markdown block to append to target CLAUDE.md. |
| `snippets/gitignore.snippet` | spec's "gitignore pattern" callout | Two lines: `.claude-task/*` and `!.claude-task/README.md`. |

### 1.3 Repo-level `README.md`

Short. Explain: what this repo is, how to use the init script, link to the design spec on GitHub once it's pushed.

**Verify:** `ls templates/task/` shows six files. Open each and confirm the spec text round-tripped without mangling (especially YAML frontmatter and code-fences).

**Commit:** `init: add task memory file templates and snippets`

---

## Phase 2 — Write the init script

A single bash script that scaffolds a new task in the current working directory's `.claude-task/`. POSIX-portable; works in Git Bash on Windows and on macOS/Linux.

### 2.1 `bin/claude-task-init`

```bash
#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<EOF
Usage: claude-task-init <slug> --title "<title>" [--owner <name>] [--parent <slug>]

Scaffolds .claude-task/<slug>/ in the current directory using templates from
\$CLAUDE_TASK_TEMPLATES (default: ~/claude-task-templates).

If .claude-task/ does not exist yet, also drops README.md and updates .gitignore.
Sets .claude-task/ACTIVE to <slug>.
EOF
  exit 1
}

[ $# -ge 1 ] || usage
SLUG="$1"; shift
TITLE=""; OWNER="${USER:-unassigned}"; PARENT="null"
while [ $# -gt 0 ]; do
  case "$1" in
    --title)  TITLE="$2"; shift 2;;
    --owner)  OWNER="$2"; shift 2;;
    --parent) PARENT="$2"; shift 2;;
    *) usage;;
  esac
done
[ -n "$TITLE" ] || { echo "Error: --title is required"; usage; }

# slug sanity
case "$SLUG" in
  *[!a-z0-9-]*|"") echo "Error: slug must be lowercase-kebab"; exit 2;;
esac

TEMPL="${CLAUDE_TASK_TEMPLATES:-$HOME/claude-task-templates}"
[ -d "$TEMPL/templates/task" ] || { echo "Error: templates not found at $TEMPL"; exit 3; }

DIR=".claude-task"
TASK_DIR="$DIR/$SLUG"
[ -e "$TASK_DIR" ] && { echo "Error: $TASK_DIR already exists"; exit 4; }

NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
DATE="$(date -u +%Y-%m-%d)"
TIME="$(date -u +%H:%M)"

# Bootstrap .claude-task/ if missing
if [ ! -d "$DIR" ]; then
  mkdir -p "$DIR"
  cp "$TEMPL/templates/README.md.tmpl" "$DIR/README.md"
  if [ -f .gitignore ] && ! grep -qxF '.claude-task/*' .gitignore; then
    printf '\n%s\n' "$(cat "$TEMPL/snippets/gitignore.snippet")" >> .gitignore
  elif [ ! -f .gitignore ]; then
    cp "$TEMPL/snippets/gitignore.snippet" .gitignore
  fi
fi

# Render task folder
mkdir -p "$TASK_DIR"
for f in STATUS.md BRIEF.md NEXT.md DECISIONS.md LOG.md ARTIFACTS.md; do
  sed \
    -e "s|{slug}|$SLUG|g" \
    -e "s|{title}|$TITLE|g" \
    -e "s|{owner}|$OWNER|g" \
    -e "s|{parent_task}|$PARENT|g" \
    -e "s|{YYYY-MM-DDTHH:MM:SSZ}|$NOW|g" \
    -e "s|{YYYY-MM-DD HH:MM}|$DATE $TIME|g" \
    -e "s|{YYYY-MM-DD}|$DATE|g" \
    "$TEMPL/templates/task/$f.tmpl" > "$TASK_DIR/$f"
done

# Set ACTIVE
echo "$SLUG" > "$DIR/ACTIVE"

cat <<EOF
Created $TASK_DIR/ and set $DIR/ACTIVE → $SLUG

Next:
  1. Fill $TASK_DIR/BRIEF.md (write-once; goal, scope, success criteria).
  2. Edit $TASK_DIR/NEXT.md with your first concrete action.
  3. When you start working, set status: in_progress in $TASK_DIR/STATUS.md.
EOF
```

### 2.2 Make it executable, install it on PATH

```bash
chmod +x bin/claude-task-init
# On Windows under Git Bash, scripts are executable if they have a shebang.
# Add bin/ to PATH (one-time, in ~/.bashrc):
#   export PATH="$HOME/claude-task-templates/bin:$PATH"
```

**Verify:** in any test directory, run `claude-task-init demo --title "Demo task"`. Result:

- `.claude-task/README.md` exists.
- `.claude-task/ACTIVE` contains `demo`.
- `.claude-task/demo/STATUS.md` has frontmatter where `task_id: demo`, `title: Demo task`, `owner: $USER`, `created` and `updated` are valid ISO-8601, `status: not_started`.
- `.gitignore` (created or appended) contains the two lines.
- Re-running with the same slug exits non-zero with the "already exists" error.

**Commit:** `feat(bin): add claude-task-init scaffolding script`

---

## Phase 3 — Validate the orchestrator API works

Confirm the spec's parser snippets actually run against the generated files.

### 3.1 yq round-trip

Install `yq` if not present (`winget install MikeFarah.yq` on Windows, `brew install yq` on macOS).

```bash
cd <some-repo>
claude-task-init t1 --title "Test 1"
yq -f extract '. | "\(.task_id) \(.status) \(.owner)"' .claude-task/t1/STATUS.md
# Expected: "t1 not_started <your-username>"
```

### 3.2 Python round-trip

Use the snippet from the spec verbatim. Should print one line for the test task.

**Verify:** both produce expected output. If yq complains about the frontmatter, the template is malformed — fix it in `templates/task/STATUS.md.tmpl` and re-init.

**Commit:** `test: validate orchestrator API parsers against generated files`
(Optional commit; really a one-time validation, no code added.)

---

## Phase 4 — CLAUDE.md wiring

So that any Claude Code session in a target repo knows about the protocol at startup.

### 4.1 Append snippet to a target repo's CLAUDE.md

Manual one-liner (no script needed for v1):

```bash
cat $CLAUDE_TASK_TEMPLATES/snippets/CLAUDE.md.snippet >> CLAUDE.md
```

Or, if no CLAUDE.md exists yet:

```bash
cp $CLAUDE_TASK_TEMPLATES/snippets/CLAUDE.md.snippet CLAUDE.md
```

### 4.2 (Deferred) `claude-task-init` could do this automatically

Could add a `--wire-claude-md` flag that appends the snippet if absent. Defer until felt-needed.

**Verify:** open the target repo in a fresh Claude Code session. The session preamble (system reminders) shows the CLAUDE.md content; the agent therefore knows to read `.claude-task/ACTIVE` first.

---

## Phase 5 — Use it on a real task (dogfood)

The first real test: create a `.claude-task/` for the **Foundation work** that's already in flight in the AdhocPrintStudio repo.

```bash
cd C:/AdhocPrintStudio-main/AdhocPrintStudio-main
claude-task-init ui-redesign-foundation --title "UI redesign Foundation (sub-project A)"
```

Then by hand:
1. Fill `.claude-task/ui-redesign-foundation/BRIEF.md` from the existing design spec at `docs/superpowers/specs/2026-04-19-ui-redesign-foundation-design.md`.
2. Set `.claude-task/ui-redesign-foundation/STATUS.md` `status: in_progress`, `next_action_owner: claude`.
3. Write `.claude-task/ui-redesign-foundation/NEXT.md` with the first step from the implementation plan: "Phase 0.1 of `2026-04-19-ui-redesign-foundation-plan.md` — install Radix dependencies in apps/web."
4. Add to `.claude-task/ui-redesign-foundation/ARTIFACTS.md`: the design spec commit, the implementation plan commit, the v0.4.1 release URL.

**Verify:** a fresh Claude Code session in this repo, told nothing else, can run a takeover and accurately summarise where the Foundation work stands and what to do next within 5 minutes.

**Commit (in this repo, NOT in claude-task-templates):** none — `.claude-task/` is git-ignored.

---

## Phase 6 — Polish & publish

### 6.1 Repo-level README in claude-task-templates

Cover: what this is, install (`git clone` + PATH), `claude-task-init` usage, link to the design spec.

### 6.2 Push to GitHub

```bash
gh repo create claude-task-templates --public --source=. --remote=origin --push
```

### 6.3 (Deferred) Full `claude-task` CLI

Subcommands `checkpoint`, `takeover`, `fold`, `archive`, `status` — see spec §"Optional helper". These are sugar over manual file edits and `git mv`. Defer until daily use proves they're worth it.

**Verify:** repo visible at `https://github.com/<user>/claude-task-templates`. README renders. Init script downloadable.

---

## Out of scope / explicit deferrals

- **Locking** — no concurrent-write protection. Convention via `owner`/`session_id` is the contract.
- **Hooks** — a Claude Code `Stop` hook to enforce checkpoint-on-session-end, or a `UserPromptSubmit` hook to surface the active task, would be valuable but is a separate sub-project.
- **Cross-repo dashboard** — Python/yq snippets enable building one; not building it here.
- **Automatic LOG fold** — the fold protocol is spec'd but not scripted. Manual run is fine until usage volume justifies automation.
- **Status enum extensions** (`paused`, `merged`) — defer until real usage shows ambiguity.

## Rollback

Phases are additive. To roll back the whole system:
- Delete `~/claude-task-templates/`.
- Remove the PATH export from `~/.bashrc`.
- In any repo where `.claude-task/` exists: `rm -rf .claude-task/` (it's git-ignored except README, so no commit needed).
- Remove the two `.gitignore` lines and the CLAUDE.md snippet if they were added.

No persistent side effects; the scheme is purely files in well-known locations.
