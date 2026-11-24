"""Community board: short anonymous posts, one board per topic the site covers.

No accounts and no human reviewer, so the safety work is done here, before anything is stored:

- Posts are plain text, 20 to 1,500 characters, shown with textContent (never as HTML).
- A screen rejects anything that looks like a Social Security number, a claim or case number,
  a phone number, an email address, a street address, a web link, or a way to contact someone
  off the site (WhatsApp, Telegram, "DM me", payment apps).
- Posting and reporting are rate-limited per visitor in memory only. IP addresses are never
  written down: the limiter keeps a salted hash that is thrown away when the process restarts.
- Three reports hide a post. Posts are deleted after 365 days.
- Only the post text, its topic, the day it was posted and a report count are stored.
- The off switch: set "community_board" to "off" in backend/settings.json and push. The board,
  its API and every link to it disappear; stored posts are kept until it is turned back on.
  HELPER_BOARD=off on the server does the same and wins over the file.

Storage is PostgreSQL when DATABASE_URL is set, otherwise a JSON file (HELPER_BOARD_FILE).
"""

import datetime as dt
import hashlib
import json
import os
import re
import secrets
import tempfile
import threading
import time
from pathlib import Path

from .validate import InputError

TOPICS = (
    ("overpayment", "Overpayments", "Paid too much, repayment, waivers and money taken from checks"),
    ("appeals", "Denials and appeals", "Social Security decisions, appeals and missed deadlines"),
    ("disability", "Disability", "Disability claims, long waits, work and restarting benefits"),
    ("payments", "Payments and amounts", "Missing payments, changed amounts, debts and earnings records"),
    ("ssi", "SSI", "SSI limits, help with housing and reporting changes"),
    ("reaching-ssa", "Reaching Social Security", "Phone lines, online accounts, letters and messages that may be scams"),
    ("medicare", "Medicare", "Medicare notices, bills, plan denials, premiums and help with costs"),
    ("snap", "SNAP and WIC", "SNAP interviews, work rules, stolen benefits and WIC"),
    ("medicaid", "Medicaid and renewals", "Renewals, paperwork, proof requests and coverage ending"),
    ("housing", "Housing and utilities", "Rent, housing help and utility shutoffs"),
    ("hearings", "State hearings", "SNAP and Medicaid hearings: getting ready and after the decision"),
    ("after-death", "After a death", "When someone who got benefits dies"),
    ("helping", "Helping someone else", "Family members, friends and helpers"),
    ("disaster", "Disasters and FEMA", "FEMA letters and proof after a disaster"),
)
TOPIC_IDS = tuple(t[0] for t in TOPICS)
SETTINGS = Path(__file__).resolve().parents[1] / "settings.json"
MIN_LEN, MAX_LEN = 20, 1500
KEEP_DAYS = 365
HIDE_AT = 3
POSTS_PER_HOUR = 3
REPORTS_PER_HOUR = 10
DAILY_CAP = 300

# What the screen refuses, with the message the poster sees. Order matters: first match wins.
_DIGITS = r"(?<!\d)"
SCREEN = (
    (re.compile(_DIGITS + r"\d{3}[\s.\-]?\d{2}[\s.\-]?\d{4}(?!\d)"), "It looks like a Social Security number or other ID number. Remove it."),
    (re.compile(_DIGITS + r"(?:\d[\s\-]?){7,}"), "Remove long numbers such as claim, case, card, account or phone numbers."),
    (re.compile(r"\(\d{3}\)\s*\d{3}"), "Remove phone numbers."),
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"), "Remove email addresses."),
    (re.compile(r"(?i)\b(?:https?://|www\.)|\b[\w-]+\.(?:com|org|net|gov|us|io|info|biz|co|me|ly|app|link|xyz|site|online)\b"), "Links are not allowed. Describe where to look instead, for example \"the Social Security website\"."),
    (re.compile(r"\b\d{1,6}\s+(?:[A-Z][A-Za-z]+\s){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl|Terrace|Circle|Highway|Hwy|Parkway|Pkwy)\b"), "Remove street addresses."),
    (re.compile(r"(?i)\b(?:whats\s?app|telegram|signal app|snapchat|instagram|facebook|tiktok|cash\s?app|venmo|zelle|paypal|western union|gift ?cards?|bitcoin|crypto)\b"), "Do not mention apps, payment services or ways to contact someone off this site."),
    (re.compile(r"(?i)\b(?:dm me|message me|text me|call me|email me|contact me|inbox me|reach me|my number|reach out to me)\b"), "Do not ask people to contact you. Keep the conversation here."),
    (re.compile(r"(?i)\b(?:my name is|i am called|i'm called)\b"), "Do not include your name."),
)


def screen(text):
    """Return the reason a post is refused, or None."""
    for pattern, why in SCREEN:
        if pattern.search(text):
            return why
    return None


def is_on():
    """The off switch. Read on every request, so a pushed change to settings.json takes effect by itself."""
    env = os.environ.get("HELPER_BOARD")
    if env is not None:
        return env.lower() not in ("off", "0", "false", "no")
    try:
        value = json.loads(SETTINGS.read_text(encoding="utf-8")).get("community_board", "on")
    except (OSError, ValueError, AttributeError):
        value = "on"
    return str(value).lower() not in ("off", "0", "false", "no")


class Limiter:
    """In-memory, per-process rate limits. Keys are salted hashes; nothing reaches disk."""

    def __init__(self):
        self.salt = secrets.token_bytes(16)
        self.lock = threading.Lock()
        self.seen = {}

    def allow(self, who, kind, per_hour, now=None):
        now = now or time.time()
        key = hashlib.sha256(self.salt + (kind + "|" + (who or "")).encode()).hexdigest()
        with self.lock:
            hits = [t for t in self.seen.get(key, []) if now - t < 3600]
            if len(hits) >= per_hour:
                self.seen[key] = hits
                return False
            hits.append(now)
            self.seen[key] = hits
            if len(self.seen) > 50_000:                 # keep memory bounded
                self.seen = {k: v for k, v in self.seen.items() if v and now - v[-1] < 3600}
            return True


class Board:
    def __init__(self, path=None, database_url=None):
        self.db = None
        if path is None:
            path = os.environ.get("HELPER_BOARD_FILE")
            if path is None:
                url = database_url if database_url is not None else os.environ.get("DATABASE_URL", "")
                if url:
                    self.db = url
                else:
                    path = os.path.join(tempfile.gettempdir(), "dear-deadline-board.json")   # outside the repo
        self.path = Path(path) if path else None
        self.lock = threading.Lock()
        self.limits = Limiter()

    @property
    def enabled(self):
        return is_on()

    # ---------------------------------------------------------------- storage

    def _connect(self):
        import psycopg
        conn = psycopg.connect(self.db)
        conn.execute("CREATE TABLE IF NOT EXISTS board_posts (id SERIAL PRIMARY KEY, topic text NOT NULL, body text NOT NULL, "
                     "reply_to integer, day date NOT NULL, reports integer NOT NULL DEFAULT 0)")
        return conn

    def _file_load(self):
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {"next": 1, "posts": []}

    def _file_save(self, data):
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        tmp.replace(self.path)

    def _all(self, topic, today):
        cutoff = today - dt.timedelta(days=KEEP_DAYS)
        if self.db:
            with self._connect() as conn:
                conn.execute("DELETE FROM board_posts WHERE day < %s", (cutoff,))
                rows = conn.execute("SELECT id, body, reply_to, day, reports FROM board_posts WHERE topic = %s ORDER BY id",
                                    (topic,)).fetchall()
            return [{"id": r[0], "body": r[1], "reply_to": r[2], "day": str(r[3]), "reports": r[4]} for r in rows]
        with self.lock:
            data = self._file_load()
            kept = [p for p in data["posts"] if p["day"] >= cutoff.isoformat()]
            if len(kept) != len(data["posts"]):
                data["posts"] = kept
                self._file_save(data)
        return [p for p in kept if p["topic"] == topic]

    def _count_today(self, today):
        if self.db:
            with self._connect() as conn:
                return conn.execute("SELECT count(*) FROM board_posts WHERE day = %s", (today,)).fetchone()[0]
        with self.lock:
            return sum(1 for p in self._file_load()["posts"] if p["day"] == today.isoformat())

    def _find(self, post_id):
        if self.db:
            with self._connect() as conn:
                r = conn.execute("SELECT id, topic, reply_to, reports FROM board_posts WHERE id = %s", (post_id,)).fetchone()
            return r and {"id": r[0], "topic": r[1], "reply_to": r[2], "reports": r[3]}
        with self.lock:
            return next((p for p in self._file_load()["posts"] if p["id"] == post_id), None)

    def _insert(self, topic, body, reply_to, today):
        if self.db:
            with self._connect() as conn:
                return conn.execute("INSERT INTO board_posts (topic, body, reply_to, day) VALUES (%s, %s, %s, %s) RETURNING id",
                                    (topic, body, reply_to, today)).fetchone()[0]
        with self.lock:
            data = self._file_load()
            pid = data["next"]
            data["next"] += 1
            data["posts"].append({"id": pid, "topic": topic, "body": body, "reply_to": reply_to, "day": today.isoformat(), "reports": 0})
            self._file_save(data)
            return pid

    def _report(self, post_id):
        if self.db:
            with self._connect() as conn:
                conn.execute("UPDATE board_posts SET reports = reports + 1 WHERE id = %s", (post_id,))
            return
        with self.lock:
            data = self._file_load()
            for p in data["posts"]:
                if p["id"] == post_id:
                    p["reports"] += 1
            self._file_save(data)

    def remove(self, post_id):
        """For the site owner: delete a post and its replies."""
        if self.db:
            with self._connect() as conn:
                conn.execute("DELETE FROM board_posts WHERE id = %s OR reply_to = %s", (post_id, post_id))
            return
        with self.lock:
            data = self._file_load()
            data["posts"] = [p for p in data["posts"] if p["id"] != post_id and p.get("reply_to") != post_id]
            self._file_save(data)

    # ---------------------------------------------------------------- the public API

    def topics(self):
        return [{"id": i, "name": n, "about": a} for i, n, a in TOPICS]

    def list(self, topic, today=None):
        today = today or dt.date.today()
        if topic not in TOPIC_IDS:
            raise InputError({"topic": "Choose a topic from the list."})
        posts = [p for p in self._all(topic, today) if p["reports"] < HIDE_AT]
        shown = {p["id"] for p in posts}
        threads = [{"id": p["id"], "day": p["day"], "body": p["body"], "replies": []} for p in posts if not p["reply_to"]]
        by_id = {t["id"]: t for t in threads}
        for p in posts:
            if p["reply_to"] and p["reply_to"] in by_id and p["reply_to"] in shown:
                by_id[p["reply_to"]]["replies"].append({"id": p["id"], "day": p["day"], "body": p["body"]})
        threads.reverse()                                  # newest conversation first
        return {"topic": topic, "threads": threads[:100]}

    def post(self, raw, who, today=None):
        today = today or dt.date.today()
        if not isinstance(raw, dict):
            raise InputError({"body": "The post could not be read. Try again."})
        if raw.get("website"):                             # hidden field that only bots fill in
            raise InputError({"body": "The post could not be saved."})
        topic = raw.get("topic")
        if topic not in TOPIC_IDS:
            raise InputError({"topic": "Choose a topic from the list."})
        if raw.get("no_details") not in (True, "yes", "true", "on"):
            raise InputError({"no_details": "Confirm that your post has no personal details."})
        body = re.sub(r"[ \t]+", " ", str(raw.get("body") or "")).strip()
        body = re.sub(r"\n{3,}", "\n\n", body)
        if len(body) < MIN_LEN:
            raise InputError({"body": "Write at least %d characters." % MIN_LEN})
        if len(body) > MAX_LEN:
            raise InputError({"body": "Keep it under %s characters." % "{:,}".format(MAX_LEN)})
        why = screen(body)
        if why:
            raise InputError({"body": why})
        reply_to = raw.get("reply_to")
        if reply_to not in (None, ""):
            try:
                reply_to = int(reply_to)
            except (TypeError, ValueError):
                raise InputError({"body": "That conversation could not be found."})
            parent = self._find(reply_to)
            if not parent or parent["topic"] != topic or parent["reply_to"] or parent["reports"] >= HIDE_AT:
                raise InputError({"body": "That conversation could not be found."})
        else:
            reply_to = None
        if not self.limits.allow(who, "post", POSTS_PER_HOUR):
            raise InputError({"body": "You have posted several times in the last hour. Try again later."})
        if self._count_today(today) >= DAILY_CAP:
            raise InputError({"body": "The community has reached today's limit of new posts. Try again tomorrow."})
        pid = self._insert(topic, body, reply_to, today)
        return {"id": pid, "day": today.isoformat()}

    def report(self, post_id, who):
        try:
            post_id = int(post_id)
        except (TypeError, ValueError):
            raise InputError({"post": "That post could not be found."})
        if not self._find(post_id):
            raise InputError({"post": "That post could not be found."})
        if not self.limits.allow(who, "report", REPORTS_PER_HOUR):
            raise InputError({"post": "Too many reports from you in the last hour. Try again later."})
        self._report(post_id)
        return {"reported": post_id}
