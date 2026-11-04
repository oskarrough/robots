# Friction

`autobot friction`: find where the autobot skills cost time or broke a promise, and file what repeats. Run it now and then, not every hour; a week of runs is enough for patterns to show. The window is the last seven days unless the caller names one.

Read every report changed in the window (`find ~/.cache/autobot -name report.md -mtime -7`). Collect its `Friction:` lines. For each issue that settled (a PR, a question, closed), read its timeline, labels and PR too, and check what the skills promise: one state label, comments start with 🤖, one question per stop, a closing comment with the link, report sections of five lines or fewer. A miss counts as friction.

Group by skill file and rule. Anything seen twice becomes one issue on oskarrough/robots, labelled `friction` (create the label once): the evidence links, the rule, a proposed edit. Search open `friction` issues first and add evidence instead of filing twice. Oskar picks; an approved edit goes to a worker via arbe-delegate.

Final chat: one line per issue filed or updated, or "nothing repeats".
