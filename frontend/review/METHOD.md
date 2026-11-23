# Reproducing the notice explanation check

Project author: Shirshak J. Thapa. Checker and corpus version 1.0.0, November 22, 2026.

Unzip the kit into a directory. In that directory run `node score.js --verify` with Node.js 18 or newer. No network, packages, agency account or personal records are necessary. To print the complete result set run `node score.js`. To try a local sample run `node score.js --notice sample.txt`. Add `--all-pages` only when you have included the full example. That command prints excerpts in your terminal. The browser evidence page can rerun the supplied corpus without installing Node.

## What was tested

For a no-install review, open offline-review.html from the kit in a browser. Rerun the recorded test, inspect a case, or check the wording of a different public example. The viewer bundles its code and data and runs with the network disconnected.

The same deterministic JavaScript used in the app suggests where to look for five elements in an English-language initial Title II overpayment notice. They cover the reason, affected period, paid versus payable amounts, reconsideration and waiver. The app still asks the reader to confirm each answer. The full SSA checklist and its sources are in checklist.json. This benchmark measures five suggestions within that checklist.

The unit of testing is a field in a document. The 21 documents are seven controlled variations of three parent layouts. Two layouts adapt numbers or time periods from SSA’s single-month and multi-period examples in [POMS GN 02201.009 B.1](https://secure.ssa.gov/apps10/poms.nsf/lnx/0202201009). The third is an author-written wording challenge. Section B also supplies the policy basis for annotating rights. Causes and other surrounding prose are invented. The audit is evidence of public need and supplies no test documents or answer labels.

Each baseline has all five measured elements. Its variants remove a cause, remove both rights, remove all calculation lines, substitute a vague cause, retain only the first page, or replace rights with headings. The expected annotations, the wording and the modification are recorded in examples.json. Page and line pointers count content lines after the page heading. Related variants share text. They do not represent 21 independent notice layouts.

## Reading the results

One short, unmodified public excerpt from SSA’s B.1 single-month illustration is checked separately for the period and the calculation wording. Check the original against the supplied source link. The other rights are outside the excerpt and are not scored. Its two checks sit outside the 105 synthetic field decisions.

“Found” means the checker suggests a supporting passage. “Not located” flags an element that it could not locate after all pages were supplied. “Unclear” asks the reader to confirm vague wording, or to check for a page. The answer key uses that third outcome for absent rights on a known incomplete scan. These outcomes describe evidence in the supplied words, not the legal validity of a debt.

Omission detection counts “not located” on deliberately removed fields divided by the number of such fields. False alarms count “not located” on present fields in intact examples. Abstentions count every “unclear” decision, including appropriate ones. Deferrals on intact examples and unseen fields on a missing page are also reported separately. Every decision, including a miss, appears in results.json. No result estimates how many claimants have been helped, accuracy on actual notices, or how often SSA issues incomplete letters.

## Replication record

For an outside review, retain the kit version and SHA256SUMS.txt, the exact command, output, date and any differences. Record which examples the reviewer selected independently and any limitations they found. A rerun by the project team is an internal rerun. A reviewer can report a result without endorsing the project.

Code is provided under the included MIT license. The project’s public rule and synthetic example data may be reused with credit.
