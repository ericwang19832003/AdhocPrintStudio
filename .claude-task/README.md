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
  [ -f "$d/STATUS.md" ] || continue
  yq -f extract '"\(.task_id)\t\(.status)\t\(.owner)\t\(.updated)"' "$d/STATUS.md"
done
```
