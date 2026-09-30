# Triage

Read the signal, not the code (`gh issue view <n> --comments`, Sentry, pasted text). A signal without an issue gets one first: open it in the repo with the reporter's words quoted, then carry on with that issue as the signal.

Split it into claims. One claim is one issue. For each extra claim, note in the report whether it looks related. Reproduce decides for sure. If the reporter already calls a claim separate, open it as its own issue now.

Label from intent alone: `bug` + `needs-repro`, or `enhancement`, or `question`. A change request with no chosen behaviour is a `question`: it goes to Oskar, not to fix. Add one domain label from the repo's existing labels (`gh label list`) if one clearly fits; never invent one. Add labels; don't remove ones a person set. Post them. When it's a `question` or too thin to act on, reply like a maintainer would: a line or two of open questions that get the discussion going, not a menu of options. A blocked `Next:` always has that reply behind it.

Fill every line of the template, `Next:` included. Report only what the signal says. Don't list what's missing unless the next step needs it, and don't restate these rules.

```
# <title>
<link> · @<reporter> · <date>

## Triage
Labeled <labels>.
1. "<claim in the reporter's words>" — <one-line read>
2. ...
Setup: <version, device, browser, steps> (bugs only)
Comment: <link> (question or too thin only)
Opened: <links to new issues> (if any)
Next: <step>, or blocked on <the one open question>
```
