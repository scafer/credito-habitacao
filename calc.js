// ── LOAN CALCULATION ENGINE ─────────────────────────────────────────
// Pure functions only — no DOM access, no globals. Takes a plain "loan
// state" object (the same shape stored in `loans[]`) and returns schedule
// rows. Used both by the active-loan views (fed from the DOM via
// captureContractData()) and the aggregate view (fed directly from stored
// loan objects), so there is exactly one amortization implementation.
//
// loanState shape:
//   {
//     contract: { capital, termYears, fixedMonths, fixedRate, spread },
//     euriborTenor, euriborHistory: [{startMonth, rates:{3,6,12}, desc}],
//     prepaymentsHistory: [{month, amount, option}],
//     scenarios: { optimistic: {3,6,12}, base: {...}, pessimistic: {...} }
//   }
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Calc = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Euribor rate applicable at a given loan month, for a given scenario
  // ('opt' | 'base' | 'pess'). Returns null during the fixed-rate period.
  function getEuriborAt(loanState, month, scenario) {
    const fixedMonths = loanState.contract.fixedMonths;
    if (month <= fixedMonths) return null;
    const hist = loanState.euriborHistory || [];
    const tenor = loanState.euriborTenor || 3;
    // Each historical entry covers [startMonth, startMonth+tenor[; after the
    // last known revision, fall back to the requested scenario.
    for (let i = hist.length - 1; i >= 0; i--) {
      const h = hist[i];
      const fim = h.startMonth + tenor;
      if (month >= h.startMonth && month < fim) {
        const rate = (h.rates && h.rates[loanState.euriborTenor]) ?? h.rate ?? 0;
        return { rate: rate / 100, type: 'hist' };
      }
    }
    const scenarios = loanState.scenarios || {};
    const scRates = scenario === 'opt' ? scenarios.optimistic
      : scenario === 'pess' ? scenarios.pessimistic
      : scenarios.base;
    const fallback = scRates ? (scRates[loanState.euriborTenor] || 0) : 0;
    return { rate: fallback / 100, type: scenario };
  }

  // Full amortization schedule (French method) for a loan under a given
  // scenario. `options.overridePrepayments` replaces loanState's own
  // prepayment history (used to compute "what if this abate never
  // happened" comparisons). `options.startDate`/`options.payDay`, when
  // given, attach a calendar `date` to each row.
  function buildSchedule(loanState, scenario, options) {
    options = options || {};
    const C = loanState.contract.capital, N = loanState.contract.termYears * 12, F = loanState.contract.fixedMonths;
    if (!C || !N) return [];
    const rF = loanState.contract.fixedRate / 100 / 12, sp = loanState.contract.spread / 100;
    const pmtF = rF > 0 ? C * rF / (1 - Math.pow(1 + rF, -N)) : C / N;
    let bal = C, rows = [];
    const prepayList = options.overridePrepayments !== undefined ? options.overridePrepayments : (loanState.prepaymentsHistory || []);
    const prepayByMonth = {};
    for (const p of prepayList) {
      if (!prepayByMonth[p.month]) prepayByMonth[p.month] = [];
      prepayByMonth[p.month].push(p);
    }
    // lockedPmt: when set, payment is held fixed (reduzir prazo) until the next
    // rate change, at which point it is recalculated and re-locked at the new
    // rate — matching periodic bank revisions, which recompute the payment for
    // every borrower regardless of past "reduzir prazo" prepayments.
    // null = always recalculate (reduzir prestação).
    let lockedPmt = null, lockedAtRate = null;
    for (let i = 1; i <= N; i++) {
      if (bal < 0.01) break;
      const isF = i <= F;
      const eu = isF ? null : getEuriborAt(loanState, i, scenario);
      const rM = isF ? rF : (eu.rate + sp) / 12;
      const rem = N - i + 1;
      let pmt;
      if (isF) {
        pmt = pmtF;
      } else if (lockedPmt !== null && rM === lockedAtRate) {
        pmt = lockedPmt;
      } else if (lockedPmt !== null) {
        pmt = bal > 0 ? rM * bal / (1 - Math.pow(1 + rM, -rem)) : 0;
        lockedPmt = pmt;
        lockedAtRate = rM;
      } else {
        pmt = bal > 0 ? rM * bal / (1 - Math.pow(1 + rM, -rem)) : 0;
      }
      const jur = bal * rM, amort = Math.min(pmt - jur, bal), nb = Math.max(bal - amort, 0);
      const row = {
        mes: i, pmt, jur, amort, bal: nb, balS: bal, isF,
        euType: isF ? 'fixed' : eu.type,
        euTot: isF ? loanState.contract.fixedRate : (eu.rate + sp) * 100,
        eu: isF ? null : eu.rate * 100
      };
      if (options.startDate) row.date = new Date(options.startDate.getFullYear(), options.startDate.getMonth() + i - 1, options.payDay || 1);
      rows.push(row);
      bal = nb;
      // apply prepayments after this month's normal payment
      if (prepayByMonth[i]) {
        for (const p of prepayByMonth[i]) {
          const abateAmt = Math.min(p.amount, bal);
          bal = Math.max(bal - abateAmt, 0);
          lockedPmt = p.option === 'term' ? pmt : null;
          lockedAtRate = p.option === 'term' ? rM : null;
        }
      }
      if (bal < 0.01) break;
    }
    return rows;
  }

  // Continuation of a schedule from a given month/balance (used to
  // simulate "what happens after this abate"), without a calendar date.
  function buildScheduleFrom(loanState, startMonth, startBalance, scenario, option, pmtRef) {
    const N = loanState.contract.termYears * 12, F = loanState.contract.fixedMonths, sp = loanState.contract.spread / 100;
    const rF = loanState.contract.fixedRate / 100 / 12;
    let bal = startBalance, rows = [];
    // Same "reduzir prazo" semantics as buildSchedule: keep pmtRef only while
    // the rate stays the one it was set at; recalculate and re-lock at each
    // rate change instead of holding pmtRef for the rest of the projection.
    let lockedPmt = option === 'term' ? pmtRef : null, lockedAtRate = null;
    for (let i = startMonth; i <= N; i++) {
      const isF = i <= F;
      const eu = isF ? null : getEuriborAt(loanState, i, scenario);
      const rM = isF ? rF : (eu.rate + sp) / 12;
      const rem = N - i + 1;
      let pmt;
      if (option === 'term') {
        if (lockedPmt > 0 && (lockedAtRate === null || rM === lockedAtRate)) {
          pmt = lockedPmt;
        } else {
          pmt = bal > 0 ? rM * bal / (1 - Math.pow(1 + rM, -rem)) : 0;
          lockedPmt = pmt;
        }
        lockedAtRate = rM;
      } else {
        // Recalculate payment each period with remaining balance and term
        pmt = bal > 0 ? rM * bal / (1 - Math.pow(1 + rM, -rem)) : 0;
      }
      const jur = bal * rM, amort = Math.min(pmt - jur, bal), nb = Math.max(bal - amort, 0);
      rows.push({ mes: i, jur, amort, pmt, bal: nb });
      bal = nb; if (bal < 0.01) break;
    }
    return rows;
  }

  // Impact of one recorded prepayment: interest saved (split into what's
  // already happened vs. still projected) and, for "reduzir prazo", months
  // saved, or for "reduzir prestação", the new payment. Compares the actual
  // schedule against a hypothetical one where that single prepayment never
  // happened.
  function prepayImpact(loanState, index, scenario, hoje) {
    const list = loanState.prepaymentsHistory || [];
    const p = list[index];
    if (!p) return null;
    const rowsWith = buildSchedule(loanState, scenario);
    const rowsWithout = buildSchedule(loanState, scenario, { overridePrepayments: list.filter((_, j) => j !== index) });
    const rowBefore = rowsWithout[p.month - 1];
    const capitalBefore = rowBefore ? rowBefore.bal : 0;
    const capitalAfter = Math.max(capitalBefore - p.amount, 0);
    let savedReal = 0, savedFuture = 0;
    const maxLen = Math.max(rowsWith.length, rowsWithout.length);
    for (let m = p.month - 1; m < maxLen; m++) {
      const withJur = m < rowsWith.length ? rowsWith[m].jur : 0;
      const withoutJur = m < rowsWithout.length ? rowsWithout[m].jur : 0;
      const diff = withoutJur - withJur;
      if (m + 1 <= hoje) savedReal += diff; else savedFuture += diff;
    }
    const penalty = p.amount * (p.penalRate || 0) / 100;
    const monthsSaved = rowsWithout.length - rowsWith.length;
    const newPayment = p.option === 'payment' && rowsWith[p.month] ? rowsWith[p.month].pmt : null;
    return { capitalBefore, capitalAfter, savedReal: Math.max(savedReal, 0), savedFuture: Math.max(savedFuture, 0), penalty, monthsSaved, newPayment };
  }

  // Compares keeping the current loan against switching to a new bank from
  // `opts.switchMonth` onward, with a new spread/fixed period and a one-off
  // transfer cost. Returns null if switchMonth falls outside the schedule.
  function refinanceComparison(loanState, scenario, opts) {
    const rowsAtual = buildSchedule(loanState, scenario);
    const rowAntes = rowsAtual[opts.switchMonth - 1];
    if (!rowAntes) return null;
    const capital = rowAntes.bal;
    let jurAtual = 0;
    for (let i = opts.switchMonth; i < rowsAtual.length; i++) jurAtual += rowsAtual[i].jur;
    const remainingMonths = rowsAtual.length - opts.switchMonth;
    const newLoanState = {
      contract: { capital, termYears: remainingMonths / 12, fixedMonths: opts.newFixedMonths, fixedRate: opts.newFixedRate, spread: opts.newSpread },
      euriborTenor: loanState.euriborTenor,
      euriborHistory: [],
      prepaymentsHistory: [],
      scenarios: loanState.scenarios
    };
    const rowsNovo = buildSchedule(newLoanState, scenario);
    let jurNovo = 0;
    for (const r of rowsNovo) jurNovo += r.jur;
    const poupanca = jurAtual - (jurNovo + (opts.transferCost || 0));
    return { capital, jurAtual, jurNovo, poupanca, newPmt: rowsNovo[0] ? rowsNovo[0].pmt : null };
  }

  return { getEuriborAt, buildSchedule, buildScheduleFrom, prepayImpact, refinanceComparison };
});
