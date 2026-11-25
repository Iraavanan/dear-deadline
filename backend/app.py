"""Small web service for Release 1.

It keeps nothing about the person: no accounts, no cookies, and request bodies are
never written to a log. The only stored data is the anonymous daily use count (helper/counter.py)
and posts people choose to write on the community boards (helper/board.py). Every other request
is answered from memory and forgotten.

Run locally:  python backend/app.py   then open http://127.0.0.1:5050
"""

import csv
import datetime as dt
import os
import io
import json
import logging
import mimetypes
from pathlib import Path

from flask import Flask, Response, abort, jsonify, request, send_from_directory

import helper
from helper import i18n, ssamore, ssalife, morehelp, benefitmath, es as spanish_tools, research, board, ai_reader, amount, bill, hearing, noticecheck, ssilimit, planappeal, diswait, fixes, utility, budget, cessation, counter, deadlines, denial, engine, letters, renewal, rent, reporting, rules, validate, work, workrules

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
SAMPLES = ROOT / "samples"

MAX_BODY_BYTES = 32 * 1024


# The bundled PDF reader ships as .mjs and .wasm; browsers refuse them unless typed correctly.
mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("application/wasm", ".wasm")


def create_app():
    app = Flask(__name__, static_folder=None)
    app.config["MAX_CONTENT_LENGTH"] = MAX_BODY_BYTES
    # The access log would record paths only, but turn it down anyway so that
    # nothing about a visit is kept by default.
    logging.getLogger("werkzeug").setLevel(logging.WARNING)

    provider = ai_reader.get_provider()      # None unless the operator has switched the AI reader on
    cap = ai_reader.DailyCap()
    counts = counter.Counter()
    posts = board.Board()

    @app.after_request
    def no_store(response):
        # Nothing about a visit may be cached. The bundled PDF library is the same for everyone, so it may be.
        # Research pages and papers are the same for everyone, so they may be cached too.
        response.headers["Cache-Control"] = ("public, max-age=86400" if request.path.startswith("/vendor/")
                                             else "public, max-age=3600" if request.path.startswith("/research") and response.status_code == 200 else "no-store")
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        # Only the small deadline calculator at /embed may be shown inside another site's page.
        embed_page = request.path == "/embed"
        if not embed_page:
            response.headers["X-Frame-Options"] = "DENY"
        # Only this site's own files may load or run. No inline script or style.
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data: blob:; "
            "worker-src 'self'; font-src 'self' data: blob:; "
            "connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors " + ("*" if embed_page else "'none'")
        )
        return response

    def _scam():
        table = rules.load_table("scam")["rows"]
        return {"signs": [{"id": r["id"], "plain": r["plain"], "ask": r["ask"], "source": r["source"], "programs": r["programs"], "other": r.get("other")} for r in table if "ask" in r],
                "advice": {r["id"]: {k: v for k, v in r.items() if k not in ("effective_from", "checked_on")} for r in table if "ask" not in r}}

    def _wic():
        return {r["id"]: {k: v for k, v in r.items() if k not in ("effective_from", "checked_on")} for r in rules.load_table("wic")["rows"]}

    @app.get("/api/es/meta")
    def spanish_meta():
        """What the Spanish pages need for the helpers that run in the browser: the same rule rows, with their sentences in Spanish."""
        token = i18n.LANG.set("es")
        try:
            today = dt.date.today()
            tables = ("askedagain", "permission", "hearingnext", "medicaidend", "hearing")
            return jsonify({"version": helper.__version__, "lang": "es", "rules_as_of": i18n.as_of(), "counting": counts.on,
                            "scam": i18n.deep(_scam()), "wic": i18n.deep(_wic()),
                            "letters": {"groups": letters.groups(), "list": letters.catalogue()},
                            "engines": dict({t: i18n.deep(rules.rows_as_of(t, today)) for t in tables}, rules_as_of=i18n.as_of())})
        finally:
            i18n.LANG.reset(token)

    @app.get("/api/meta")
    def meta():
        return jsonify(
            {
                "version": helper.__version__,
                "ai_reader": {"available": provider is not None, "provider": provider.name if provider else None},
                "rules_as_of": rules.rules_checked_as_of(),
                "questions": list(validate.QUESTIONS),
                "benefit_types": list(validate.BENEFIT_TYPES),
                "cessation": {
                    "questions": list(cessation.QUESTIONS),
                    "letter_kinds": [{"id": k, "label": v} for k, v in cessation.LETTER_KINDS],
                    "benefit_kinds": [{"id": k, "label": v} for k, v in cessation.BENEFIT_KINDS],
                },
                "work": {"years": list(work.YEARS), "max_months": work.MAX_MONTHS},
                "denial": {
                    "questions": list(denial.QUESTIONS),
                    "stages": [{"id": k, "label": v} for k, v in denial.STAGES],
                    "about": [{"id": k, "label": v} for k, v in denial.ABOUT],
                },
                "reporting": {
                    "benefits": [{"id": k, "label": v} for k, v in reporting.BENEFITS],
                    "changes": {k: reporting.changes_for(k, rules.rows_as_of("reporting", dt.date.today())) for k, _ in reporting.BENEFITS},
                },
                "scam": _scam(),
                "letters": {"groups": [{"id": k, "label": v} for k, v in letters.GROUPS], "list": letters.catalogue()},
                "amount_example": amount.example(),
                "workrules": {p: rules.rows_as_of("workrules", dt.date.today())[p + "_exemptions"]["items"] for p in workrules.PROGRAMS},
                "renewal_checks": [list(c) for c in renewal.CHECKS],
                "notice_parts": [{"id": r["id"], "ask": r["ask"], "applies": r["applies"]}
                                 for r in noticecheck.parts_for("unsure", rules.rows_as_of("noticecheck", dt.date.today()))],
                "medicaid_states": [[r["id"], r["name"]] for r in rules.load_table("medicaid_states")["rows"] if "name" in r],
                "photo_reader": (FRONTEND / "vendor" / "tesseract" / "tesseract.min.js").is_file(),
                "engines": {"bill": rules.rows_as_of("bill", dt.date.today()), "rent": rules.rows_as_of("rent", dt.date.today()),
                            "renewal": rules.rows_as_of("renewal", dt.date.today()), "workrules": rules.rows_as_of("workrules", dt.date.today()),
                            "askedagain": rules.rows_as_of("askedagain", dt.date.today()),
                            "permission": rules.rows_as_of("permission", dt.date.today()), "hearingnext": rules.rows_as_of("hearingnext", dt.date.today()),
                            "medicaidend": rules.rows_as_of("medicaidend", dt.date.today()), "hearing": rules.rows_as_of("hearing", dt.date.today()), "rules_as_of": rules.rules_checked_as_of()},
                "wic": _wic(),
                "counting": counts.on,
                "contact": os.environ.get("HELPER_CONTACT", "").strip()[:120] or None,
                "budget_fields": [{"id": "income", "label": "Monthly income, all sources"}]
                + [{"id": k, "label": label} for k, label in budget.EXPENSES],
            }
        )

    @app.get("/api/rules")
    def rule_tables():
        """Every rule the tool uses, with its source and the date it was last checked."""
        out = []
        for name in rules.TABLES:
            table = rules.load_table(name)
            out.append({
                "table": name,
                "about": table.get("about", ""),
                "rows": [
                    {"id": r["id"], "plain": r.get("plain") or r.get("when") or "", "source": r["source"],
                     "effective_from": r["effective_from"], "checked_on": r["checked_on"]}
                    for r in table["rows"]
                ],
            })
        return jsonify(out)

    @app.get("/api/samples")
    def samples():
        out = []
        module = request.args.get("module", "overpayment")
        for path in sorted(SAMPLES.glob("*.json")):
            sample = json.loads(path.read_text(encoding="utf-8"))
            if sample.get("module", "overpayment") != module:
                continue
            if "notice_days_ago" in sample:
                # Sample notices are dated relative to today so their deadlines stay live.
                notice_date = dt.date.today() - dt.timedelta(days=sample["notice_days_ago"])
                sample["facts"]["notice_date"] = notice_date.isoformat()
            out.append({k: sample[k] for k in ("id", "title", "story", "notice_text", "facts", "answers", "statements", "form") if k in sample})
        return jsonify(out)

    @app.post("/api/evaluate")
    def evaluate():
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify({"error": "Send the notice details as JSON."}), 400
        try:
            result = engine.run(body.get("facts"), body.get("answers"), body.get("statements"), today=dt.date.today(),
                                raw_budget=body.get("budget"))
        except validate.InputError as err:
            return jsonify({"error": "Some details need fixing.", "problems": err.problems}), 422
        return jsonify(result)

    @app.post("/api/cessation")
    def evaluate_cessation():
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify({"error": "Send the notice details as JSON."}), 400
        try:
            result = cessation.run(body.get("facts"), body.get("answers"), body.get("choice"), body.get("statements"), today=dt.date.today())
        except validate.InputError as err:
            return jsonify({"error": "Some details need fixing.", "problems": err.problems}), 422
        return jsonify(result)

    @app.post("/api/denial")
    def evaluate_denial():
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify({"error": "Send the letter details as JSON."}), 400
        try:
            return jsonify(denial.run(body.get("facts"), body.get("answers"), body.get("statements"), today=dt.date.today()))
        except validate.InputError as err:
            return jsonify({"error": "Some details need fixing.", "problems": err.problems}), 422

    @app.post("/api/work")
    def check_work():
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify({"error": "Send the details as JSON."}), 400
        try:
            return jsonify(work.run(body))
        except validate.InputError as err:
            return jsonify({"error": "Some details need fixing.", "problems": err.problems}), 422

    @app.post("/api/report")
    def build_report():
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify({"error": "Send the details as JSON."}), 400
        try:
            return jsonify(reporting.run(body))
        except validate.InputError as err:
            return jsonify({"error": "Some details need fixing.", "problems": err.problems}), 422

    @app.post("/api/letter")
    def one_letter():
        """One letter from the catalogue: what it is and what to do, and its dates when a date is sent."""
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify({"error": "Send the letter and date as JSON."}), 400
        try:
            return jsonify(letters.run(body))
        except validate.InputError as err:
            return jsonify({"error": "Some details need fixing.", "problems": err.problems}), 422

    @app.post("/api/amount")
    def check_amount():
        """How did Social Security get this amount? Arithmetic on the figures the person copies from the notice."""
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify({"error": "Send the figures as JSON."}), 400
        try:
            return jsonify(amount.run(body))
        except validate.InputError as err:
            return jsonify({"error": "Some figures need fixing.", "problems": err.problems}), 422

    def _figures(fn, what):
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify({"error": "Send the %s as JSON." % what}), 400
        try:
            return jsonify(fn(body))
        except validate.InputError as err:
            return jsonify({"error": "Some details need fixing.", "problems": err.problems}), 422

    # ---------------------------------------------------------------- community board

    def _visitor():
        # Behind Caddy every request comes from 127.0.0.1; Caddy adds the real address last.
        # Used only for in-memory rate limits, never stored.
        hops = [h.strip() for h in request.headers.get("X-Forwarded-For", "").split(",") if h.strip()]
        return hops[-1] if hops and request.remote_addr in ("127.0.0.1", "::1") else (request.remote_addr or "")

    def _board_on():
        if not posts.enabled:
            abort(404)

    @app.get("/api/board")
    def board_topics():
        """The community boards, one per topic the site covers."""
        _board_on()
        return jsonify({"topics": posts.topics(), "min": board.MIN_LEN, "max": board.MAX_LEN, "keep_days": board.KEEP_DAYS})

    @app.get("/api/board/<topic>")
    def board_list(topic):
        """Posts on one board, newest conversation first. Reported posts are hidden."""
        _board_on()
        try:
            return jsonify(posts.list(topic))
        except validate.InputError as err:
            return jsonify({"error": "Some details need fixing.", "problems": err.problems}), 404

    @app.post("/api/board/<topic>")
    def board_post(topic):
        """Add a post or a reply. The text is screened for personal details and contact requests first."""
        _board_on()
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify({"error": "Send the post as JSON."}), 400
        body["topic"] = topic
        try:
            return jsonify(posts.post(body, _visitor()))
        except validate.InputError as err:
            return jsonify({"error": "Some details need fixing.", "problems": err.problems}), 422

    @app.post("/api/board/report/<post_id>")
    def board_report(post_id):
        """Report a post. Three reports hide it."""
        _board_on()
        try:
            return jsonify(posts.report(post_id, _visitor()))
        except validate.InputError as err:
            return jsonify({"error": "Some details need fixing.", "problems": err.problems}), 422

    @app.post("/api/board/remove/<int:post_id>")
    def board_remove(post_id):
        """For the site owner only: delete a post and its replies. Needs the owner's key (see helper/board.py)."""
        _board_on()
        if not posts.limits.allow(_visitor(), "admin", 20) or not board.is_admin(request.headers.get("X-Board-Admin", "")):
            abort(404)
        posts.remove(post_id)
        return jsonify({"removed": post_id})

    @app.post("/api/bill")
    def check_bill():
        """Does a doctor's bill match the Medicare Summary Notice? Compares the figures the person copies from each."""
        return _figures(bill.run, "details")

    @app.post("/api/workrules")
    def check_workrules():
        """The SNAP time limit and the Medicaid 80-hour rule, month by month, from what the person enters."""
        return _figures(workrules.run, "details")

    @app.post("/api/interview")
    def missed_interview():
        """A missed SNAP interview: the dates the federal rules give."""
        return _figures(workrules.interview, "dates")

    @app.post("/api/renewal")
    def check_renewal():
        """What is missing from a Medicaid or SNAP renewal, before it is sent."""
        return _figures(renewal.run, "details")

    @app.post("/api/rent")
    def check_rent():
        """Housing rent check: the HUD rent arithmetic redone from the figures on the rent notice."""
        return _figures(rent.run, "figures")

    @app.post("/api/hearing")
    def benefit_hearing():
        """SNAP or Medicaid denied, cut or stopped: the hearing dates and a hearing request."""
        return _figures(hearing.run, "details")

    @app.post("/api/notice-check")
    def notice_check():
        return _figures(noticecheck.run, "answers")

    @app.post("/api/ssi-limit")
    def ssi_limit():
        """SSI $2,000 tracker: what may count on the 1st of each month."""
        return _figures(ssilimit.run, "months")

    @app.post("/api/plan-appeal")
    def plan_appeal():
        """Medicare Advantage or drug plan denial: the appeal date, a request letter and a doctor's statement."""
        return _figures(planappeal.run, "details")

    @app.post("/api/medicare-costs")
    def medicare_costs():
        """Medicare Savings Programs and Extra Help: the 2026 federal limits against the person's figures."""
        return _figures(fixes.msp, "details")

    @app.post("/api/stolen-snap")
    def stolen_snap():
        """SNAP benefits stolen from an EBT card: steps for today and a statement."""
        return _figures(fixes.stolen, "details")

    @app.post("/api/locked-out")
    def locked_out():
        """Locked out of a my Social Security account: Login.gov and ID.me routes back in."""
        return _figures(fixes.lockout, "details")

    @app.post("/api/ssa-call")
    def ssa_call():
        """Can't reach Social Security: a call plan, what to have ready and words for the call."""
        return _figures(fixes.ssacall, "details")

    @app.post("/api/withholding")
    def lower_withholding():
        """Too much taken from each payment: a budget, the 12- and 60-month amounts and a request letter."""
        return _figures(fixes.withhold, "figures")

    @app.post("/api/paperwork")
    def lost_over_paperwork():
        """Medicaid or SNAP ended over paperwork: the window to send papers without starting over."""
        return _figures(fixes.procedural, "details")

    @app.post("/api/late-appeal")
    def late_appeal():
        """Missed the 60-day appeal limit: the usual deadline, good-cause reasons and a statement."""
        return _figures(ssamore.latefiling, "details")

    @app.post("/api/payment-missing")
    def payment_missing():
        """A Social Security or SSI payment did not arrive: when it was due and when to report it."""
        return _figures(ssamore.payday, "details")

    @app.post("/api/offset")
    def benefit_offset():
        """Part of a benefit taken for a debt: the federal limits and what to do."""
        return _figures(ssamore.offset, "details")

    @app.post("/api/irmaa")
    def medicare_irmaa():
        """Income-related Medicare premium: the 2026 tier and when form SSA-44 may help."""
        return _figures(ssamore.irmaa, "details")

    @app.post("/api/after-death")
    def after_death():
        """Someone who got Social Security or SSI died: payments to return, the $255 payment, who to tell."""
        return _figures(ssalife.died, "details")

    @app.post("/api/reinstate")
    def reinstate():
        """Benefits stopped because of work: the 60-month window to ask for them to restart."""
        return _figures(ssalife.reinstate, "details")

    @app.post("/api/ssi-help")
    def ssi_help():
        """SSI lowered by help with housing: the share, the one-third rule and the presumed maximum value."""
        return _figures(ssalife.ssihelp, "details")

    @app.post("/api/amount-changed")
    def amount_changed():
        """A payment amount changed: each part of the change against the year's figures."""
        return _figures(ssalife.changed, "figures")

    @app.post("/api/snap-overpayment")
    def snap_overpayment():
        """The state says a household was paid too much SNAP: the hearing date, repayment and what can be taken."""
        return _figures(morehelp.snapclaim, "details")

    @app.post("/api/va-debt")
    def va_debt():
        """A first VA debt letter: the dates to dispute, ask for a waiver or set up a plan."""
        return _figures(morehelp.vadebt, "details")

    @app.post("/api/disability-review")
    def disability_review():
        """A disability review form from Social Security: what to send and what happens if it is not returned."""
        return _figures(morehelp.cdr, "details")

    @app.post("/api/ra-overpayment")
    def ra_overpayment():
        """Florida reemployment assistance overpayment: the 20-day appeal date and the repayment rules."""
        return _figures(morehelp.raover, "details")

    @app.post("/api/voucher-ending")
    def voucher_ending():
        """A housing authority is ending voucher help: the informal hearing and the family's rights."""
        return _figures(morehelp.voucher, "details")

    @app.post("/api/estate-recovery")
    def estate_recovery():
        """Medicaid estate recovery: when a claim may not be collected and how to ask for a hardship waiver."""
        return _figures(morehelp.estate, "details")

    @app.post("/api/partb-late")
    def partb_late():
        """Signing up for Medicare Part B late: the penalty and the sign-up periods."""
        return _figures(morehelp.partb, "details")

    @app.post("/api/fairness-act")
    def fairness_act():
        """A public pension and the Social Security Fairness Act: what changed and what to check."""
        return _figures(morehelp.fairness, "details")

    @app.post("/api/es/<tool>")
    def spanish_tool(tool):
        """The Spanish step-by-step helpers. Dates and figures come from the same code as the English ones."""
        fn = {"sobrepago": spanish_tools.sobrepago, "negado": spanish_tools.negado, "incapacidad": spanish_tools.incapacidad,
              "audiencia": spanish_tools.audiencia, "snap": spanish_tools.snap}.get(tool) or i18n.TOOLS.get(tool)
        if fn is None:
            abort(404)
        return _figures(fn, "details")

    @app.post("/api/benefit-math")
    def benefit_math():
        """Re-work a retired worker's first monthly benefit from the earnings record, inside the tested range only."""
        return _figures(benefitmath.run, "details")

    @app.post("/api/disability-wait")
    def disability_wait():
        """A slow disability case: critical-case categories that may fit, and letters."""
        return _figures(diswait.run, "details")

    @app.post("/api/utility")
    def utility_shutoff():
        """Florida electric or gas shutoff notice: a call sheet for today."""
        return _figures(utility.run, "details")

    @app.post("/api/rent/compare")
    def compare_rent():
        """Why did my rent change? Two rent sheets worked through and the change split into what moved."""
        return _figures(rent.compare, "figures from both sheets")

    @app.post("/api/deadlines")
    def letter_deadlines():
        """Dates only, for the small calculator other sites can embed. Takes a letter type and the date on it."""
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify({"error": "Send the letter type and date as JSON."}), 400
        today, letter = dt.date.today(), body.get("letter")
        try:
            day = validate._parse_date(body.get("notice_date"))
        except (TypeError, ValueError):
            return jsonify({"error": "Some details need fixing.", "problems": {"notice_date": "Enter the date printed on the letter."}}), 422
        if day > today or day.year < 2000:
            return jsonify({"error": "Some details need fixing.", "problems": {"notice_date": "Check the date printed on the letter."}}), 422
        if letter == "overpayment":
            items = deadlines.compute(day, today)["items"]
        elif letter == "disability-ended":
            items = cessation.compute_dates(day, today, rules.rows_as_of("cessation", day))["items"]
        elif letter == "decision-appeal":
            items = denial._dates(day, today, rules.rows_as_of("denial", day))["items"]
        else:
            return jsonify({"error": "Some details need fixing.", "problems": {"letter": "Choose the kind of letter."}}), 422
        return jsonify({"letter": letter, "notice_date": day.isoformat(), "today": today.isoformat(), "items": items,
                        "rules_as_of": rules.rules_checked_as_of()})

    @app.post("/api/count")
    def count():
        """One anonymous tally mark. Nothing about the visitor is read or kept."""
        body = request.get_json(silent=True)
        if not isinstance(body, dict) or not counts.add(body.get("module"), body.get("event"), body.get("late") is True, sample=body.get("sample") is True):
            return jsonify({"error": "Not something this tool counts."}), 400
        return "", 204

    @app.get("/api/stats")
    def stats():
        return jsonify(counts.totals())

    @app.get("/open/rules.csv")
    def rules_csv():
        out = io.StringIO()
        sheet = csv.writer(out)
        sheet.writerow(["table", "id", "rule", "source", "effective_from", "checked_on"])
        for name in rules.TABLES:
            for r in rules.load_table(name)["rows"]:
                sheet.writerow([name, r["id"], r.get("plain") or r.get("when") or "", r["source"], r["effective_from"] or "", r["checked_on"]])
        return Response(out.getvalue(), mimetype="text/csv", headers={"Content-Disposition": "attachment; filename=dear-deadline-rules.csv"})

    @app.get("/open/golden.json")
    def golden_results():
        """Published worked examples (HUD, Medicare) and what this tool gives for each, failures included."""
        return send_from_directory(ROOT / "benchmark", "golden-results.json", mimetype="application/json")

    @app.get("/open/letters.jsonl")
    def benchmark_letters():
        return send_from_directory(ROOT / "benchmark", "letters.jsonl", mimetype="application/x-ndjson", as_attachment=True)

    @app.post("/api/read")
    def read_notice():
        body = request.get_json(silent=True)
        try:
            return jsonify(ai_reader.read(body.get("text") if isinstance(body, dict) else None, provider, cap))
        except ai_reader.ReaderError as err:
            return jsonify({"error": err.message}), err.status

    @app.get("/open/heldout-letters.jsonl")
    def heldout_letters():
        return send_from_directory(ROOT / "benchmark" / "heldout", "letters.jsonl", mimetype="application/x-ndjson", as_attachment=True)

    @app.get("/open/asked-again-cases.json")
    def asked_again_cases():
        return send_from_directory(ROOT / "benchmark" / "askedagain", "cases.json", mimetype="application/json")

    @app.get("/open/asked-again-results.json")
    def asked_again_results():
        return send_from_directory(ROOT / "benchmark" / "askedagain" / "results", "first-run.json", mimetype="application/json")

    @app.get("/open/notice-readability.json")
    def notice_readability():
        return send_from_directory(ROOT / "benchmark" / "templates", "madcap_scores.json", mimetype="application/json")

    @app.get("/open/heldout-protocol")
    def heldout_protocol():
        return send_from_directory(ROOT / "benchmark" / "heldout", "PROTOCOL.md", mimetype="text/plain")

    SITE = os.environ.get("SITE_URL", "https://deardeadline.org").rstrip("/")
    PAGES = ("/", "/helpers", "/es", "/about", "/open", "/research")

    @app.get("/robots.txt")
    def robots():
        """Search engines may read every page; the API answers only form submissions."""
        body = "User-agent: *\nDisallow: /api/\nAllow: /\n\nSitemap: %s/sitemap.xml\n" % SITE
        return Response(body, mimetype="text/plain")

    @app.get("/sitemap.xml")
    def sitemap():
        """The public pages, dated by the day the rules were last checked."""
        day = rules.rules_checked_as_of()
        urls = "".join("  <url><loc>%s%s</loc><lastmod>%s</lastmod></url>\n" % (SITE, p, day) for p in PAGES)
        urls += "".join("  <url><loc>%s/research/%s</loc><lastmod>%s</lastmod></url>\n" % (SITE, p["slug"], p["date"]) for p in research.load()["papers"])
        body = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s</urlset>\n' % urls
        return Response(body, mimetype="application/xml")

    @app.get("/research")
    def research_index():
        """Research behind the site: plain-language summaries of the author's papers."""
        return Response(research.index_page(SITE), mimetype="text/html")

    @app.get("/research/<slug>")
    def research_paper(slug):
        """One paper: a plain-language summary, the PDF on this site, and the tags Google Scholar reads."""
        paper = research.find(slug)
        if paper is None:
            abort(404)
        return Response(research.paper_page(paper, SITE), mimetype="text/html")

    @app.get("/es")
    def spanish():
        """The most important points in Spanish, with links into the English tool."""
        return send_from_directory(FRONTEND, "es.html")

    @app.get("/es/app")
    def spanish_app():
        """The Spanish helpers that run in the browser. Its scripts are Spanish copies built by tools/make_es_js.py."""
        return send_from_directory(FRONTEND / "es", "app.html")

    @app.get("/about")
    def about():
        return send_from_directory(FRONTEND, "about.html")

    @app.get("/embed")
    def embed():
        return send_from_directory(FRONTEND, "embed.html")

    @app.get("/open")
    def open_data():
        return send_from_directory(FRONTEND, "open.html")

    @app.get("/helpers")
    def helpers():
        return send_from_directory(FRONTEND, "helpers.html")

    @app.get("/")
    def index():
        return send_from_directory(FRONTEND, "index.html")

    @app.get("/<path:name>")
    def static_files(name):
        return send_from_directory(FRONTEND, name)

    return app


if __name__ == "__main__":
    import os
    # Not 5000: on a Mac, the AirPlay Receiver already answers on port 5000 with "Access denied" (HTTP 403).
    port = int(os.environ.get("PORT", "5050"))
    print("Open http://127.0.0.1:%d in your browser. Press Ctrl+C here to stop." % port, flush=True)
    create_app().run(host="127.0.0.1", port=port, debug=False)
