---
name: arbe-pr-writing
description: Write clear, human PR titles and descriptions, in any repo. Use whenever you open or edit a pull request, or rewrite one after feedback. Only covers the title and body, not the code.
---

# PR titles and descriptions

Write the PR as if a person opened it to tell another person why it exists.

## Title

Short and plain: what the PR does, in a few words. No prefixes, ticket numbers or emoji unless the repo already uses them.

## Body

- Open with the why: what changed in the world, or what was wrong, that made this PR necessary. Then say what the PR does about it.
- One to three sentences is usually enough. Add more only when the reviewer would get something wrong without it.
- Write like a person. Use full sentences and name things the way you would in conversation.
- Leave out what the diff already shows: file-by-file bullets, version bumps, config details, ignored folders.
- Leave out reassurance sections like "Nothing changes on deploy" or "Tests pass". Mention a risk or a manual step only if the reviewer has to act on it, and keep it to one line.
- No headings, bold labels or checklists unless the repo's PR template asks for them.

## Example

A generic before and after. Keep any new examples generic too, with no real repo or project names.

Too much:

> Moves the project from the old CLI config to the new one, so `deploy` runs the new command.
>
> - New config file replaces the old one: same name, entrypoint and settings.
> - Old tool bumped to the version the new one needs. New tool added as a dev dependency.
> - Build output folder is ignored.
>
> Nothing changes on deploy:
>
> - Secrets carry over.
> - The custom domain stays as it is.

Better:

> The hosting provider has a new CLI that replaces the old one. This PR moves the project over to it, mainly so the deploy command uses it.

The second version opens with the outside reason, says what the PR does in one sentence, and leaves out what the diff already shows.
