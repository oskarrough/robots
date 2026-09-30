# Verify

Fresh eyes on the fix. Rerun the reproduction steps against the branch: is the bug gone? Run the full checks. Review the diff with arbe-review (diff review). If the change is visible, run the app (serve a build if the dev server is off-limits) and look: save before and after screenshots next to the report. Use Playwright or whatever browser tool the machine has. A visible change nobody has looked at isn't verified: if you can't get a browser, that's a blocker, not a footnote.

Fixed and nothing in the review that has to change → next is PR. Otherwise → back to fix, with what you saw and the findings. After two rounds back to fix, stop and hand it to Oskar.
