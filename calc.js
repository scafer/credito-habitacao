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

  function getEuriborAt(loanState, month, scenario) {
    const fixedMonths = loanState.contract.fixedMonths;
    if (month <= fixedMonths) return null;
    const hist = loanState.euriborHistory || [];
    const tenor = loanState.euriborTenor || 3;
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

  // Solves the annuity formula for the period count instead of the payment.
  function nperForPayment(pmt, bal, rM, fallback) {
    if (!(bal > 0)) return 0;
    if (!(pmt > 0)) return fallback;
    if (rM === 0) return bal / pmt;
    if (pmt <= rM * bal) return fallback;
    return Math.log(pmt / (pmt - rM * bal)) / Math.log(1 + rM);
  }

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
    // "reduzir prazo": payment stays fixed until a rate change, then re-solves
    // against the payoff target fixed at lock time (lockedRemainingAtLock),
    // not the loan's original term — otherwise a revision would silently
    // undo the term reduction.
    let lockedPmt = null, lockedAtRate = null, lockedAtMonth = null, lockedRemainingAtLock = null;
    for (let i = 1; i <= N; i++) {
      if (bal < 0.01) break;
      const isF = i <= F;
      const eu = isF ? null : getEuriborAt(loanState, i, scenario);
      const rM = isF ? rF : (eu.rate + sp) / 12;
      const remOriginal = N - i + 1;
      let pmt;
      if (isF) {
        pmt = pmtF;
      } else if (lockedPmt !== null && rM === lockedAtRate) {
        pmt = lockedPmt;
      } else if (lockedPmt !== null) {
        const remLocked = Math.max(lockedRemainingAtLock - (i - lockedAtMonth), 1);
        pmt = bal > 0 ? rM * bal / (1 - Math.pow(1 + rM, -remLocked)) : 0;
        lockedPmt = pmt;
        lockedAtRate = rM;
      } else {
        pmt = bal > 0 ? rM * bal / (1 - Math.pow(1 + rM, -remOriginal)) : 0;
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
      if (prepayByMonth[i]) {
        for (const p of prepayByMonth[i]) {
          const abateAmt = Math.min(p.amount, bal);
          bal = Math.max(bal - abateAmt, 0);
          if (p.option === 'term') {
            lockedPmt = pmt;
            lockedAtRate = rM;
            lockedAtMonth = i;
            lockedRemainingAtLock = nperForPayment(pmt, bal, rM, remOriginal);
          } else {
            lockedPmt = null; lockedAtRate = null; lockedAtMonth = null; lockedRemainingAtLock = null;
          }
        }
      }
      if (bal < 0.01) break;
    }
    return rows;
  }

  // Continues a schedule from an arbitrary month/balance (simulating a
  // hypothetical abate), without a calendar date. Same locked-target
  // semantics as buildSchedule for "reduzir prazo".
  function buildScheduleFrom(loanState, startMonth, startBalance, scenario, option, pmtRef) {
    const N = loanState.contract.termYears * 12, F = loanState.contract.fixedMonths, sp = loanState.contract.spread / 100;
    const rF = loanState.contract.fixedRate / 100 / 12;
    let bal = startBalance, rows = [];
    let lockedPmt = null, lockedAtRate = null, lockedAtMonth = null, lockedRemainingAtLock = null;
    if (option === 'term') {
      const isF0 = startMonth <= F;
      const eu0 = isF0 ? null : getEuriborAt(loanState, startMonth, scenario);
      const rM0 = isF0 ? rF : (eu0.rate + sp) / 12;
      const rem0 = N - startMonth + 1;
      lockedPmt = pmtRef > 0 ? pmtRef : (bal > 0 ? rM0 * bal / (1 - Math.pow(1 + rM0, -rem0)) : 0);
      lockedAtRate = rM0;
      lockedAtMonth = startMonth;
      lockedRemainingAtLock = nperForPayment(lockedPmt, bal, rM0, rem0);
    }
    for (let i = startMonth; i <= N; i++) {
      const isF = i <= F;
      const eu = isF ? null : getEuriborAt(loanState, i, scenario);
      const rM = isF ? rF : (eu.rate + sp) / 12;
      const remOriginal = N - i + 1;
      let pmt;
      if (option === 'term') {
        if (rM === lockedAtRate) {
          pmt = lockedPmt;
        } else {
          const remLocked = Math.max(lockedRemainingAtLock - (i - lockedAtMonth), 1);
          pmt = bal > 0 ? rM * bal / (1 - Math.pow(1 + rM, -remLocked)) : 0;
          lockedPmt = pmt;
          lockedAtRate = rM;
        }
      } else {
        pmt = bal > 0 ? rM * bal / (1 - Math.pow(1 + rM, -remOriginal)) : 0;
      }
      const jur = bal * rM, amort = Math.min(pmt - jur, bal), nb = Math.max(bal - amort, 0);
      rows.push({ mes: i, jur, amort, pmt, bal: nb });
      bal = nb; if (bal < 0.01) break;
    }
    return rows;
  }

  // Interest saved by one recorded prepayment vs. a hypothetical schedule
  // without it (real vs. still-projected), plus months saved or new payment.
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
      const row = m < rowsWith.length ? rowsWith[m] : null;
      const withJur = row ? row.jur : 0;
      const withoutJur = m < rowsWithout.length ? rowsWithout[m].jur : 0;
      const diff = withoutJur - withJur;
      // "Real" excludes elapsed months still relying on a scenario guess
      // (no recorded Euribor for them yet).
      const confirmed = row && (row.euType === 'fixed' || row.euType === 'hist');
      if (m + 1 <= hoje && confirmed) savedReal += diff; else savedFuture += diff;
    }
    const penalty = p.amount * (p.penalRate || 0) / 100;
    const monthsSaved = rowsWithout.length - rowsWith.length;
    const newPayment = p.option === 'payment' && rowsWith[p.month] ? rowsWith[p.month].pmt : null;
    return { capitalBefore, capitalAfter, savedReal: Math.max(savedReal, 0), savedFuture: Math.max(savedFuture, 0), penalty, monthsSaved, newPayment };
  }

  // Keeping the current loan vs. switching to a new bank from opts.switchMonth
  // onward. Returns null if switchMonth falls outside the schedule.
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

  // Combined impact of every prepayment together, plus a cumulative
  // savings series for charting. Compares against a schedule with no
  // prepayments at all, rather than removing them one at a time.
  function totalPrepaymentImpact(loanState, scenario, hoje) {
    const rowsWith = buildSchedule(loanState, scenario);
    const rowsWithout = buildSchedule(loanState, scenario, { overridePrepayments: [] });
    const maxLen = Math.max(rowsWith.length, rowsWithout.length);
    let savedReal = 0, savedFuture = 0, cum = 0;
    const cumulative = [];
    for (let m = 0; m < maxLen; m++) {
      const row = m < rowsWith.length ? rowsWith[m] : null;
      const withJur = row ? row.jur : 0;
      const withoutJur = m < rowsWithout.length ? rowsWithout[m].jur : 0;
      const diff = withoutJur - withJur;
      cum += diff;
      cumulative.push(cum);
      const confirmed = row && (row.euType === 'fixed' || row.euType === 'hist');
      if (m + 1 <= hoje && confirmed) savedReal += diff; else savedFuture += diff;
    }
    const monthsSaved = rowsWithout.length - rowsWith.length;
    return { savedReal: Math.max(savedReal, 0), savedFuture: Math.max(savedFuture, 0), monthsSaved, cumulative };
  }

  return { getEuriborAt, buildSchedule, buildScheduleFrom, prepayImpact, refinanceComparison, totalPrepaymentImpact };
});
