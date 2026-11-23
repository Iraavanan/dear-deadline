# Held-out test: how well does software read benefit letters?

150 invented letters with answer keys, written after the built-in reader was finished and in
layouts it was never developed against. The same letters can be given to any tool: this app,
a general AI model, a letter-explainer phone app, or a government assistant.

Built by `python tools/build_heldout.py` (fixed seed). Letters: `letters.jsonl`.

## What is tested, and why

| Part | Letters | Why it matters |
|---|---|---|
| Kind of letter | 150 | An overpayment notice, a disability-ended notice, a denial, or something else (cost-of-living notice, award letter with back pay, SSI reduction notice, Medicare Summary Notice). Mistaking one for another sends a person to the wrong deadline. |
| Date of the letter | 150 | Deadlines count from it. 8 letters give no date, only other dates: the right answer is null. |
| Total overpaid | 150 | 15 letters state the monthly amount to be held back first; 7 overpayment letters give no total; 75 letters are not overpayment notices. A number given where none is stated is counted as invented. |
| Monthly amount held back | 75 | Kept apart from the total. |
| Totals agree | 15 | Letters with a month-by-month table; 5 state a total that does not match their own rows. |
| Rights stated | 75 | Whether the letter states the right to reconsideration and to a waiver, which Social Security's rules require (POMS GN 02201.009 B). |
| Identity number | 150 | For tools that return the text: no invented identity number may be shown back. Every number starts with 9, a range Social Security does not assign. |

## How to test a tool

1. Give it each letter with the instructions in `PROMPT.txt`, one letter at a time, with no other help.
2. Save one JSON answer per line in `answers/<tool>.jsonl`, with the letter's `id` added.
   For an AI model with an API: `HELPER_AI_READER=module:Class python tools/heldout_ai.py --out answers/<tool>.jsonl`.
   For a phone app: paste or photograph each letter and copy its answers by hand into the same format.
3. Score it: `python benchmark/heldout/score.py answers/<tool>.jsonl --name "<tool, version, date>" --out results/<tool>-first-run.json`.
4. Run `python tools/heldout.py` to list every result on the open-data page.

Report the first run as it came out. If a tool is changed after its misses are seen, report the
new run beside the first, and say so.

## Limits

- The author of the built-in reader wrote these letters. They are held out from the reader's
  development, not independent of its author.
- They are invented. Real letters vary more; results on real letters will differ.
- Phone apps and AI services change often: record the version and date of every run.
