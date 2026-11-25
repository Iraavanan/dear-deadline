/* Sets up the Spanish page for the helpers that run in the browser (/es/app).

   The English engines for two helpers are loaded before this file, and kept here under their own names: a paper that
   goes to an agency (a cover note, a letter, a note for a helper) is made by the English engine, so it stays in English.
   The Spanish copies of the helpers, built by tools/make_es_js.py, load after this file. */
(function () {
  "use strict";
  window.AskedAgainEn = window.AskedAgain;
  window.NextStepsEn = window.NextSteps;
  var here = {};
  ["find-letter", "medicare-letter", "letter", "is-it-real", "filed", "asked-again", "helper-permission", "hearing-prep", "hearing-decision", "medicaid-ending",
    "helper-board", "wic-practice", "earnings-record", "fema-proof", "ssi-wages", "ssi-medicaid"].forEach(function (k) { here[k] = true; });
  window.DD_ES = {
    home: "/es",
    here: here,
    /* Helpers that live on the main Spanish page: the English name of each, and its place there. */
    elsewhere: {
      "overpayment": "sobrepago", "decision-appeal": "negado", "disability-ended": "incapacidad", "benefit-hearing": "audiencia", "snap-overpayment": "snap",
      "va-debt": "deuda-va", "disability-review": "revision-incapacidad", "ra-overpayment": "desempleo-florida", "voucher-ending": "vale-vivienda",
      "estate-recovery": "sucesion-medicaid", "partb-late": "parte-b", "fairness-act": "ley-equidad", "late-appeal": "apelacion-tarde", "withholding": "descuento-alto",
      "payment-missing": "pago-no-llego", "amount-changed": "cambio-de-pago", "benefit-offset": "descuento-por-deuda", "ssi-help": "ssi-ayuda",
      "work-restart": "volver-a-recibir", "after-death": "despues-de-una-muerte", "ssa-call": "llamar-seguro-social", "locked-out": "cuenta-bloqueada",
      "medicare-costs": "costos-medicare", "medicare-irmaa": "prima-por-ingresos", "paperwork": "papeles", "stolen-snap": "snap-robado", "notice-check": "aviso-completo",
      "ssi-limit": "limite-ssi", "disability-wait": "caso-lento", "plan-appeal": "apelar-plan", "utility-shutoff": "corte-de-luz", "renewal": "renovacion",
      "report-change": "informar-cambio", "rent-check": "alquiler", "work-rules": "reglas-de-trabajo", "missed-interview": "entrevista-snap",
      "work-check": "trabajo-y-beneficios", "medicare-bill": "factura-medicare", "check-amount": "cantidad", "benefit-math": "calculo-de-beneficio"
    },
    api: { "/api/meta": "/api/es/meta", "/api/letter": "/api/es/letter" }
  };
})();
