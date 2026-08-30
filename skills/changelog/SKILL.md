---
name: arbe-changelog
description: Turn development work into user-facing changelog entries. Use for CHANGELOG updates, release notes, and sprint summaries. Not general docs — use arbe-documentation.
---

# Changelog

Write clean changelog entries. Translate development work into what changed for someone using or building on the software.

**In arbe, this skill is downstream of the binding contract in `packages/skills/changelog/SKILL.md`**: every user-noticeable change adds its own bullet under `## [Unreleased]` in `docs/changelog.md`, **in the same jj change**, grouped under the `### <scope>` heading matching the commit prefix. Nothing below overrides that — this skill is how to write the bullet, not where or when. Retrospective curation (reconstructing notes from commits at release time) is the fallback for projects without that workflow, not the arbe way.

## What belongs

Include user-facing changes, meaningful developer improvements, and frustration-killing fixes.

Skip internal churn that does not change how someone uses, runs, debugs, or builds on the project.

Describe the destination, not the path. Say "added retry logic for CLI downloads," not "rewrote downloader, migrated config, fixed test flakes."

New features absorb their bug fixes *within the same unreleased cycle*. If a feature was built and fixed before it ever shipped, the changelog just shows the working feature. A fix to something already released is its own entry.

## Format

Use a simple bulleted list. Each item is one clear change, one sentence. No nested bullets. No bold labels.

Group under the changelog's existing section convention (arbe: `### <scope>` headings — `cli`, `www`, `core`, …). If the target changelog has no convention, use no sections.

## Voice

Use simple, direct language. Benefit first: lead with the thing that changed or what stopped hurting, not the mechanism. No file paths, no function names, no infra vocabulary.

Past tense, active voice, verb-first by default:
- Added retry logic for CLI downloads
- Fixed Safari compatibility issues
- Redesigned the settings page

Present tense is allowed when the entry describes how something now behaves, and reads better that way:
- Your theme choice is only remembered when it differs from your system setting
- `arbe upgrade` tells you what changed in the version it just installed

Announcements read present, ledgers read past — both are fine on the same list; pick per entry, don't force one.

No marketing language. Avoid phrases like "revolutionary," "unprecedented control," and "transforms how you..." Let the changes speak for themselves.

Be specific. "Fixed login timeout" beats "fixed bug."

## Process

1. Read the existing changelog or release note style first.
2. Inspect the commits, PRs, or changed files enough to know the outcome.
3. Merge related implementation details into one user-visible entry.
4. Drop work that has no visible effect.
5. Keep each entry short. If it needs a second sentence, it probably needs cutting.
