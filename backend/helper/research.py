"""The Research section: an index and one page per paper, built from frontend/research/papers.json.

Each paper page is a real address (/research/<slug>) with the tags Google Scholar reads, a plain-
language summary, the PDF hosted on this site and a citation. Pages are plain HTML from this file:
no script, nothing loaded from other sites.
"""

import datetime as dt
import json
from html import escape
from pathlib import Path

from . import board

FRONTEND = Path(__file__).resolve().parents[2] / "frontend"
DATA = FRONTEND / "research" / "papers.json"
MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")
ICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%2313233B'/%3E"
        "%3Crect x='6' y='13' width='20' height='6' fill='%23FFDC4E'/%3E%3C/svg%3E")


def load(path=None):
    return json.loads(Path(path or DATA).read_text(encoding="utf-8"))


def find(slug, data=None):
    data = data or load()
    return next((p for p in data["papers"] if p["slug"] == slug), None)


def _long(iso):
    d = dt.date.fromisoformat(iso)
    return "%s %d, %d" % (MONTHS[d.month - 1], d.day, d.year)


def _e(s):
    return escape(str(s), quote=True)


def _page(title, description, canonical, head_extra, body):
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>%s</title>
  <meta name="description" content="%s">
  <link rel="canonical" href="%s">
  <link rel="icon" href="%s">
  <link rel="stylesheet" href="/styles.css">
%s</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="mast">
    <p class="mast-name"><a href="/">Dear Deadline</a></p>
    <details class="lang">
      <summary>English</summary>
      <div><p><b>English:</b> the full tool.</p><p><a href="/es" lang="es">Español: una página en español con lo más importante</a></p></div>
    </details>
    <p class="mast-note">An independent guide to benefit letters and bills: Social Security, Medicare, SNAP, Medicaid and housing. Not a government website.</p>
  </header>
  <main id="main">
    <div class="sheet research">
%s
    </div>
  </main>
  <footer class="foot">
    <div class="foot-in">
      <p class="foot-lead">This tool is independent. It is not affiliated with the Social Security Administration, Medicare, HUD, or any state agency.</p>
      <p class="foot-small"><a href="/">The tool</a> &nbsp; <a href="/about">About, privacy and testing</a> &nbsp; %s<a href="/research">Research</a> &nbsp; <a href="/helpers">Helping someone else</a> &nbsp; <a href="/open">Open data and embedding</a></p>
      <p class="foot-small">A project by Shirshak J. Thapa.</p>
    </div>
  </footer>
</body>
</html>
""" % (_e(title), _e(description), _e(canonical), ICON, head_extra, body,
       '<a class="community-link" href="/#community">Community</a> &nbsp; ' if board.is_on() else "")


def _name_line(data):
    return '<p class="byline">%s, %s. <a href="%s">ORCID record</a></p>' % (_e(data["author"]), _e(data["role"]), _e(data["orcid"]))


def index_page(site, data=None):
    data = data or load()
    parts = ['      <h1 class="long">Research behind this site</h1>',
             '      <p class="lead">%s</p>' % " ".join(_e(s) for s in data["intro"]),
             "      " + _name_line(data),
             '      <p class="small">These papers are preprints. They have not yet been peer reviewed.</p>']
    for g in data["groups"]:
        papers = [p for p in data["papers"] if p["group"] == g["id"]]
        cards = "".join(
            '<li><a class="way" href="/research/%s"><b>%s</b><span>%s</span>%s<i aria-hidden="true"></i></a></li>'
            % (_e(p["slug"]), _e(p["question"]), _e(p["card"]), '<small>%s</small>' % _e(p["tag"]) if g["id"] == "benefits" else "")
            for p in papers)
        parts.append('      <section class="paper-group" aria-labelledby="g-%s"><h2 id="g-%s">%s</h2><ul class="ways paper-cards">%s</ul></section>'
                     % (_e(g["id"]), _e(g["id"]), _e(g["name"]), cards))
    parts.append('      <p>Looking for help with a letter? <a href="/">Go to the tool</a></p>')
    desc = "Research by Shirshak Jung Thapa on whether public-benefits software gives correct answers, with plain-language summaries and the full papers."
    return _page("Research behind this site: Dear Deadline", desc, site + "/research", "", "\n".join(parts))


def citation(p, data):
    return "%s (%s). %s [Preprint]. Zenodo. https://doi.org/%s" % (data["short_author"], p["date"][:4], p["title"], p["doi"])


def paper_page(p, site, data=None):
    data = data or load()
    url = "%s/research/%s" % (site, p["slug"])
    pdf_url = "%s/research/pdf/%s" % (site, p["pdf"])
    day = p["date"].replace("-", "/")
    meta = [("citation_title", p["title"]), ("citation_author", data["citation_author"]), ("citation_publication_date", day),
            ("citation_online_date", day), ("citation_doi", p["doi"]), ("citation_publisher", "Zenodo"),
            ("citation_pdf_url", pdf_url), ("citation_abstract_html_url", url), ("citation_language", "en"),
            ("DC.title", p["title"]), ("DC.creator", data["citation_author"]), ("DC.date", p["date"]), ("DC.identifier", "doi:" + p["doi"])]
    ld = {"@context": "https://schema.org", "@type": "ScholarlyArticle", "headline": p["title"], "name": p["title"],
          "alternativeHeadline": p["question"], "description": p["description"], "datePublished": p["date"],
          "author": {"@type": "Person", "name": data["author"], "sameAs": data["orcid"]},
          "identifier": "https://doi.org/" + p["doi"], "sameAs": "https://doi.org/" + p["doi"], "url": url,
          "encoding": {"@type": "MediaObject", "contentUrl": pdf_url, "encodingFormat": "application/pdf"},
          "license": "https://creativecommons.org/licenses/by/4.0/", "isAccessibleForFree": True,
          "creativeWorkStatus": "Preprint"}
    head = "".join('  <meta name="%s" content="%s">\n' % (k, _e(v)) for k, v in meta)
    head += '  <script type="application/ld+json">%s</script>\n' % json.dumps(ld, ensure_ascii=False).replace("</", "<\\/")
    data_link = ('<a class="quiet" href="https://doi.org/%s">Data and code on Zenodo</a>' % _e(p["data_doi"]) if p.get("data_doi")
                 else '<a class="quiet" href="https://zenodo.org/records/%s">Data and code on Zenodo</a>' % _e(p["doi"].rsplit(".", 1)[1]))
    body = [
        '      <nav class="crumbs" aria-label="Breadcrumb"><a href="/research">Research</a> › %s</nav>' % _e(p["tag"]),
        '      <h1 class="long">%s</h1>' % _e(p["question"]),
        '      <p class="paper-formal">Paper: %s</p>' % _e(p["title"]),
        '      <p class="byline">%s · Posted %s · <a href="https://doi.org/%s">doi.org/%s</a></p>' % (_e(data["author"]), _long(p["date"]), _e(p["doi"]), _e(p["doi"])),
        '      <p class="preprint">Preprint. It has not yet been peer reviewed.</p>',
        '      <section class="short-version" aria-labelledby="short"><h2 id="short">The short version</h2><p>%s</p></section>' % " ".join(_e(s) for s in p["short"]),
        '      <h2>What I found</h2>',
        '      <ul class="paper-findings">%s</ul>' % "".join("<li>%s</li>" % _e(f) for f in p["found"]),
        '      <h2>Why it matters</h2>',
        '      <p>%s</p>' % " ".join(_e(s) for s in p["matters"]),
        '      <h2>How the study was done</h2>',
        '      <p>%s</p>' % " ".join(_e(s) for s in p["method"]),
        '      <p class="paper-buttons"><a class="go" href="/research/pdf/%s">Read the paper (PDF)</a> %s</p>' % (_e(p["pdf"]), data_link),
        '      <h2>How to cite</h2>',
        '      <p class="cite">%s</p>' % _e(citation(p, data)),
    ]
    if p["group"] == "benefits":
        body.append('      <p class="small">This site\'s own accuracy testing is described on the <a href="/about#accuracy">About page</a>.</p>')
    body.append('      <p><a href="/research">All research</a> · <a href="/">Go to the tool</a></p>')
    return _page("%s | Dear Deadline" % p["question"], p["description"], url, head, "\n".join(body))
