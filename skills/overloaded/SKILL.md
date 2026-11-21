---
name: arbe-overloaded
description: The user is swamped by your last reply and about to say "ok whatever, do it". Shrink it to the one decision they face, your pick, and what a blind yes would cost.
disable-model-invocation: true
---

Your last reply asked too much. The user is close to approving it unread. Rescue them once; don't change how you write afterwards.

Answer in this order, and stop there:

1. The decision. One line: what you're actually asking them to say yes or no to.
2. Your pick, with one reason. Commit to it. If the honest pick is "nothing yet", say that.
3. A blind yes. What happens if they approve without reading? Say whether it's cheap to undo ("two roadmap lines, delete them later") or not ("rewrites the schema, migrations follow"). If it's safe, tell them so, and they can wave it through.
4. Parked. Every other idea, question or option from the last reply, in one line each. They need no answer now. Skip this section if nothing is left over.

Never add anything new. Don't drop a real risk to make the answer shorter; it belongs in point 3. Keep the whole thing short enough to read in ten seconds.

Before:

> Yes, two things, and maybe a third. Self-scheduling is the best one … Dependencies come second … Maybe structured messages … Leases … I'd skip them. Shall I put self-scheduling and thread dependencies on the roadmap next to schedules?

After:

> Should two ideas from Vercel's board go on the roadmap?
>
> Yes to self-scheduling ("check CI in 5 minutes"). It's the smallest useful version of schedules. Thread dependencies can wait until that one exists.
>
> A blind yes adds two lines to the roadmap and builds nothing, so it's safe.
>
> Parked: structured worker reports, thread dependencies.
