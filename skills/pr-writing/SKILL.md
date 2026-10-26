---
name: arbe-pr-writing
description: How Oskar wants PR titles and descriptions written, in any repo. Use whenever you open or edit a pull request, or rewrite one after feedback. Only covers the title and body, not the code.
---

# PR titles and descriptions

Write the PR the way Oskar would if he had opened it himself: a person telling another person why this exists.

## Title

Short and plain: what the PR does, in a few words. No prefixes, ticket numbers or emoji unless the repo already uses them.

## Body

- Open with the why: what changed in the world, or what was wrong, that made this PR necessary. Then say what the PR does about it.
- One to three sentences is usually enough. Add more only when the reviewer would get something wrong without it.
- Write like a person. Use full sentences and name things the way you would in conversation.
- Leave out what the diff already shows: file-by-file bullets, version bumps, config details, ignored folders.
- Leave out reassurance sections like "Nothing changes on deploy" or "Tests pass". Mention a risk or a manual step only if the reviewer has to act on it, and keep it to one line.
- No headings, bold labels or checklists unless the repo's PR template asks for them.
