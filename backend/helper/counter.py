"""Anonymous use counter.

Counts how many times each part of the tool is opened, reaches the dates
screen, and produces a kit, and how many people arrive after the appeal date
has passed. It keeps a number per day and nothing else: no address, no
browser details, no answers. Anyone can read the totals at /api/stats.

Where the numbers live:
- If DATABASE_URL is set (a PostgreSQL address), in one small table there.
- Otherwise in one small JSON file. Set HELPER_COUNT_FILE to choose where it
  lives, or to "off" to switch counting off.
"""

import datetime as dt
import fcntl
import json
import os
from pathlib import Path

MODULES = ("overpayment", "disability-ended", "work-check", "decision-appeal", "is-it-real", "report-change", "find-letter", "check-amount", "filed-log", "embed", "medicare-bill", "work-rules", "missed-interview", "renewal", "rent-check", "benefit-hearing", "utility", "wic-practice", "helper-board", "notice-check", "ssi-limit", "plan-appeal", "disability-wait", "medicare-costs", "stolen-snap", "locked-out", "ssa-call", "withholding", "paperwork", "asked-again", "helper-permission", "hearing-prep", "hearing-decision", "medicaid-ending", "late-appeal", "payment-missing", "benefit-offset", "medicare-irmaa")
EVENTS = ("start", "dates", "kit")
DEFAULT_FILE = Path(__file__).resolve().parents[2] / "data" / "counts.json"
TABLE = """CREATE TABLE IF NOT EXISTS use_counts (
  day date NOT NULL,
  key text NOT NULL,
  n integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, key))"""


class Counter:
    def __init__(self, path=None, database_url=None):
        chosen = path if path is not None else os.environ.get("HELPER_COUNT_FILE", str(DEFAULT_FILE))
        off = str(chosen).lower() == "off"
        db = database_url if database_url is not None else (os.environ.get("DATABASE_URL", "").strip() if path is None else "")
        self.db = None if off else (db or None)
        self.path = None if off or self.db else Path(chosen)
        self._table_ready = False

    @property
    def on(self):
        return self.path is not None or self.db is not None

    @staticmethod
    def _keys(module, event, late, sample):
        key = module + "." + event + (".sample" if sample is True else "")
        keys = [key]
        if late is True and event == "dates" and sample is not True:
            keys.append(key + ".late")
        return keys

    def add(self, module, event, late=False, today=None, sample=False):
        """Add one to a day's tally. Returns False if the pair is not one this tool counts.
        A run on a made-up example is tallied apart (`sample`), so it never inflates real use."""
        if module not in MODULES or event not in EVENTS:
            return False
        if not self.on:
            return True
        day = (today or dt.date.today()).isoformat()
        keys = self._keys(module, event, late, sample)
        if self.db:
            try:
                self._db_add(day, keys)
            except Exception as err:                    # a count is never worth breaking someone's visit
                print("use counter: could not save a count:", type(err).__name__, flush=True)
            return True
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.path, "a+", encoding="utf-8") as fh:
            fcntl.flock(fh, fcntl.LOCK_EX)              # one writer at a time, across worker processes
            fh.seek(0)
            raw = fh.read()
            data = json.loads(raw) if raw.strip() else {"since": day, "days": {}}
            tally = data["days"].setdefault(day, {})
            for key in keys:
                tally[key] = tally.get(key, 0) + 1
            fh.seek(0)
            fh.truncate()
            json.dump(data, fh, separators=(",", ":"))
        return True

    # PostgreSQL storage -------------------------------------------------------
    def _connect(self):
        import psycopg                                   # only needed when DATABASE_URL is set
        conn = psycopg.connect(self.db, connect_timeout=5)
        if not self._table_ready:
            with conn.cursor() as cur:
                cur.execute(TABLE)
            conn.commit()
            self._table_ready = True
        return conn

    def _db_add(self, day, keys):
        with self._connect() as conn, conn.cursor() as cur:
            for key in keys:
                cur.execute("INSERT INTO use_counts (day, key, n) VALUES (%s, %s, 1) "
                            "ON CONFLICT (day, key) DO UPDATE SET n = use_counts.n + 1", (day, key))

    def _db_load(self):
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT day, key, n FROM use_counts ORDER BY day")
            days = {}
            for day, key, n in cur.fetchall():
                days.setdefault(day.isoformat() if hasattr(day, "isoformat") else str(day), {})[key] = n
        return {"since": min(days) if days else None, "days": days}

    # Totals -------------------------------------------------------------------
    def totals(self):
        empty = {m: {"start": 0, "dates": 0, "kit": 0, "late": 0, "sample": 0} for m in MODULES}
        if self.db:
            data = self._db_load()
        elif self.on and self.path.exists():
            data = json.loads(self.path.read_text(encoding="utf-8") or "{}")
        else:
            return {"counting": self.on, "since": None, "days_counted": 0, "by_part": empty, "all": {"start": 0, "dates": 0, "kit": 0, "late": 0, "sample": 0}}
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
