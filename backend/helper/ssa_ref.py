"""Reference model: the retired-worker benefit, written from the published rules.

Scope (version 0.1):
  - a worker who is fully insured, claims an old-age benefit at or before full retirement age,
    and has no disability, family members, pension offsets or military credits;
  - initial computation only (no later recomputation for earnings after entitlement).

Rules and where they come from:
  - Age is attained on the day before the birthday (20 CFR 404.2(c)(4)).
  - The year of first eligibility is the year the worker attains 62; earnings are indexed to the national average
    wage index of the second year before it (42 USC 415(b)(3); 20 CFR 404.211).
  - Indexed earnings are rounded to the nearest cent; years from the indexing year on count at face value.
  - Earnings above the taxable maximum of the year do not count.
  - Computation years: the years after the year of attaining 21 (or 1950) and before the year of attaining 62,
    less five; the highest of those many years are used (42 USC 415(b)(2)).
  - Average indexed monthly earnings: the total over the computation years divided by the number of months,
    rounded down to the dollar (20 CFR 404.211).
  - Primary insurance amount: 90 percent up to the first bend point, 32 percent to the second, 15 percent above,
    with the bend points of the year of eligibility, rounded down to the dime (42 USC 415(a)(1)).
  - Cost-of-living increases apply from the year of eligibility, each rounded down to the dime (42 USC 415(i)).
  - Early claiming: five-ninths of 1 percent for each of the first 36 months before full retirement age and
    five-twelfths of 1 percent for each further month (42 USC 402(q)); the monthly benefit is rounded down to
    the dollar (42 USC 415(g)).

Amounts are held as whole cents and reductions as exact fractions, so no result depends on floating point.
This file was written without reading the calculation code of the SSA calculator; it is compared with that
calculator in study/run_compare.py.
"""
import datetime, json, os
from fractions import Fraction

HERE = os.path.dirname(os.path.abspath(__file__))


def load_params(path=None):
    p = json.load(open(path or os.path.join(HERE, "params_2026.json"), encoding="utf-8"))
    return {
        "awi": {int(k): Fraction(str(v)) for k, v in p["average_wage_index"].items()},
        "base": {int(k): Fraction(str(v)) for k, v in p["taxable_maximum"].items()},
        "cola": {int(k): Fraction(str(v)) for k, v in p["cola_percent_december"].items()},
        "bend": {int(k): v for k, v in p["bend_points_by_eligibility_year"].items()},
        "factors": [Fraction(str(f)) for f in p["pia_factors"]],
        "fra": p["full_retirement_age_months"],
    }


def floor_to(x, unit):
    """Round a Fraction down to a multiple of unit (both in cents)."""
    return (x // unit) * unit


def round_half_up(x):
    """Round a Fraction to the nearest whole number, halves up."""
    return (x * 2 + 1) // 2


def attains(birth, years=0, months=0):
    """Date on which a person born on `birth` attains the given age: the day before the birthday."""
    total = birth.month - 1 + months
    y, m = birth.year + years + total // 12, total % 12 + 1
    try:
        d = datetime.date(y, m, birth.day)
    except ValueError:  # 29 February in a year without one
        d = datetime.date(y, m, 28) + datetime.timedelta(days=1)
    return d - datetime.timedelta(days=1)


def fra_months(birth, P):
    """Full retirement age in months, by the year of birth as the law counts it (born 1 January = prior year)."""
    y = attains(birth).year if (birth.month, birth.day) == (1, 1) else birth.year
    return P["fra"].get(str(y), P["fra"]["1960+"] if y >= 1960 else None)


def first_month_at_62(birth):
    """First month a worker is 62 throughout: the month of attaining 62 only if attained on its first day."""
    a = attains(birth, 62)
    if a.day == 1:
        return (a.year, a.month)
    return (a.year + a.month // 12, a.month % 12 + 1)


def compute(birth, earnings, entitlement, P=None):
    """birth: datetime.date; earnings: {year: dollars as str/int/float}; entitlement: (year, month).

    Returns a dict of the steps and results, amounts in dollars (strings with two decimals where relevant).
    """
    P = P or load_params()
    ent_y, ent_m = entitlement
    elig_year = attains(birth, 62).year
    index_year = elig_year - 2
    year21 = attains(birth, 21).year

    fm = fra_months(birth, P)
    fra_date = attains(birth, 0, fm)
    red_months = (fra_date.year - ent_y) * 12 + (fra_date.month - ent_m)
    if red_months < 0:
        raise ValueError("entitlement after full retirement age is outside this version's scope")
    if (ent_y, ent_m) < first_month_at_62(birth):
        raise ValueError("entitlement before the first month the worker is 62 throughout")

    # earnings that count: up to the taxable maximum, through the year before entitlement
    cents = {}
    for y, e in earnings.items():
        y = int(y)
        if y < 1951 or y >= ent_y:
            continue
        cents[y] = min(Fraction(str(e)), P["base"][y]) * 100

    indexed = {}
    for y, c in cents.items():
        if y < index_year:
            indexed[y] = round_half_up(c * P["awi"][index_year] / P["awi"][y])
        else:
            indexed[y] = round_half_up(c)

    elapsed = elig_year - max(year21, 1950) - 1
    n_years = max(elapsed - 5, 2)
    chosen = sorted(indexed.items(), key=lambda kv: (-kv[1], kv[0]))[:n_years]
    total = sum(v for _, v in chosen)
    aime = int(Fraction(total, 100) // (n_years * 12))  # dollars, rounded down

    b1, b2 = P["bend"][elig_year]
    f1, f2, f3 = P["factors"]
    raw = f1 * min(aime, b1) + f2 * max(0, min(aime, b2) - b1) + f3 * max(0, aime - b2)
    pia = floor_to(raw * 100, 10)  # cents, down to the dime
    pia_at_eligibility = pia

    colas = []
    for y in range(elig_year, ent_y + 1):
        if (y, 12) <= (ent_y, ent_m):  # the December increase of year y is in force
            pia = floor_to(pia * (100 + P["cola"][y]) / 100, 10)
            colas.append(y)

    first, extra = min(red_months, 36), max(red_months - 36, 0)
    reduction = Fraction(5, 900) * first + Fraction(5, 1200) * extra
    benefit = floor_to(pia * (1 - reduction), 100)  # cents, down to the dollar

    money = lambda c: "%d.%02d" % (int(c) // 100, int(c) % 100)
    return {
        "eligibility_year": elig_year,
        "index_year": index_year,
        "computation_years": n_years,
        "years_used": sorted(y for y, _ in chosen),
        "aime": aime,
        "pia_at_eligibility": money(pia_at_eligibility),
        "colas_applied": colas,
        "pia": money(pia),
        "reduction_months": red_months,
        "benefit": int(benefit) // 100,
    }


if __name__ == "__main__":
    r = compute(datetime.date(1964, 1, 2), {y: 30000 for y in range(1990, 2026)}, (2026, 1))
    print(r)
    assert (r["aime"], r["pia"], r["benefit"]) == (4852, "2298.50", 1608)
    print("self-check passed")
