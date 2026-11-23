"""Anonymous use counter.

Counts how many times each part of the tool is opened, reaches the dates
screen, and produces a kit, and how many people arrive after the appeal date
has passed. It keeps a number per day and nothing else: no address, no
browser details, no answers. Anyone can read the totals at /api/stats.

Stored as one small JSON file so no database is needed. Set HELPER_COUNT_FILE
to choose where it lives, or to "off" to switch counting off.
"""

import datetime as dt
import fcntl
import json
import os
from pathlib import Path

MODULES = ("overpayment", "disability-ended", "work-check", "decision-appeal", "is-it-real", "report-change", "find-letter", "check-amount", "filed-log", "embed", "medicare-bill", "work-rules", "missed-interview", "renewal", "rent-check", "benefit-hearing", "utility", "wic-practice", "helper-board", "notice-check", "ssi-limit", "plan-appeal", "disability-wait", "medicare-costs", "stolen-snap", "locked-out", "ssa-call", "withholding", "paperwork", "asked-again", "helper-permission", "hearing-prep", "hearing-decision", "medicaid-ending")
EVENTS = ("start", "dates", "kit")
DEFAULT_FILE = Path(__file__).resolve().parents[2] / "data" / "counts.json"


class Counter:
    def __init__(self, path=None):
        chosen = path if path is not None else os.environ.get("HELPER_COUNT_FILE", str(DEFAULT_FILE))
        self.path = None if str(chosen).lower() == "off" else Path(chosen)

    @property
    def on(self):
        return self.path is not None

    def add(self, module, event, late=False, today=None, sample=False):
        """Add one to a day's tally. Returns False if the pair is not one this tool counts.
        A run on a made-up example is tallied apart (`sample`), so it never inflates real use."""
        if module not in MODULES or event not in EVENTS:
            return False
        if not self.on:
            return True
        day = (today or dt.date.today()).isoformat()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.path, "a+", encoding="utf-8") as fh:
            fcntl.flock(fh, fcntl.LOCK_EX)              # one writer at a time, across worker processes
            fh.seek(0)
            raw = fh.read()
            data = json.loads(raw) if raw.strip() else {"since": day, "days": {}}
            tally = data["days"].setdefault(day, {})
            key = module + "." + event + (".sample" if sample is True else "")
            tally[key] = tally.get(key, 0) + 1
            if late is True and event == "dates" and sample is not True:
                tally[key + ".late"] = tally.get(key + ".late", 0) + 1
            fh.seek(0)
            fh.truncate()
            json.dump(data, fh, separators=(",", ":"))
        return True

    def totals(self):
        empty = {m: {"start": 0, "dates": 0, "kit": 0, "late": 0, "sample": 0} for m in MODULES}
        if not self.on or not self.path.exists():
            return {"counting": self.on, "since": None, "days_counted": 0, "by_part": empty, "all": {"start": 0, "dates": 0, "kit": 0, "late": 0, "sample": 0}}
        data = json.loads(self.path.read_text(encoding="utf-8") or "{}")
        for tally in data.get("days", {}).values():
            for key, n in tally.items():
                parts = key.split(".")
                if parts[0] not in empty:
                    continue
                if len(parts) == 3 and parts[2] == "sample":
                    if parts[1] == "kit":                     # example runs: only finished ones are shown
                        empty[parts[0]]["sample"] += n
                else:
                    empty[parts[0]]["late" if len(parts) == 3 else parts[1]] += n
        total = {k: sum(v[k] for v in empty.values()) for k in ("start", "dates", "kit", "late", "sample")}
        return {"counting": True, "since": data.get("since"), "days_counted": len(data.get("days", {})), "by_part": empty, "all": total}
