---
name: arbe-changelog
description: Write direct, user-facing changelog entries from recent development work. Use for release notes, sprint summaries, or CHANGELOG updates.
---

# Changelog

Write clean changelog entries. Translate development work into what changed for someone using or building on the software.

## What belongs

Include user-facing changes, meaningful developer improvements, and frustration-killing fixes.

Skip internal churn that does not change how someone uses, runs, debugs, or builds on the project.

Describe the destination, not the path. Say "added retry logic for CLI downloads," not "rewrote downloader, migrated config, fixed test flakes."

New features absorb their bug fixes. If a feature was built and fixed in the same cycle, the changelog just shows the working feature.

## Format

Use a simple bulleted list by default.

Each item is one clear change. No nested bullets. No bold labels. No domain tags unless the target changelog already uses them.

Group into sections only when the existing changelog does. If there is no local convention, use no sections.

## Voice

Use simple, direct language.

Start with the changed thing or a clear action verb:
- Added retry logic for CLI downloads
- Fixed Safari compatibility issues
- Redesigned the settings page
- New `gs` keyboard shortcut opens settings
- Explore tags over time on the new `/[slug]/tags` page

No intro paragraph unless the release genuinely needs framing.

No marketing language. Avoid phrases like "revolutionary," "unprecedented control," and "transforms how you..." Let the changes speak for themselves.

Prefer past tense, active voice. "Added dark mode," not "dark mode has been added."

Be specific. "Fixed login timeout" beats "fixed bug."

## Process

1. Read the existing changelog or release note style first.
2. Inspect the commits, PRs, or changed files enough to know the outcome.
3. Merge related implementation details into one user-visible entry.
4. Drop work that has no visible effect.
5. Keep each entry short. If it needs a second sentence, it probably needs cutting.
