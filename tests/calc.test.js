const { test } = require('node:test');
const assert = require('node:assert/strict');
const Calc = require('../calc.js');

const closeTo = (actual, expected, epsilon = 0.01) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `expected ${actual} to be close to ${expected}`);

// Reference case: BBVA "Tesla Model Y" financing simulated as a mortgage-shaped
// loan (100% fixed rate for the full term) — 45.000€, 84 meses, TAN 4,5%.
// Numbers cross-checked by hand against the real FIN document.
test('buildSchedule — 100% fixed-rate loan matches the reference FIN numbers', () => {
  const loanState = {
    contract: { capital: 45000, termYears: 7, fixedMonths: 84, fixedRate: 4.5, spread: 0 },
    euriborTenor: 3,
    euriborHistory: [],
    prepaymentsHistory: [],
    scenarios: { optimistic: {}, base: {}, pessimistic: {} }
  };
  const rows = Calc.buildSchedule(loanState, 'base');
  assert.equal(rows.length, 84);
  closeTo(rows[0].pmt, 625.51);
  closeTo(rows[83].bal, 0);
  const totalInterest = rows.reduce((s, r) => s + r.jur, 0);
  closeTo(totalInterest, 7542.61, 0.1);
});

// Fixed period, then variable: one historical Euribor revision, then falls
// back to the 'base' scenario once the history runs out.
function variableLoanState() {
  return {
    contract: { capital: 100000, termYears: 10, fixedMonths: 12, fixedRate: 3.0, spread: 1.0 },
    euriborTenor: 3,
    euriborHistory: [{ startMonth: 13, rates: { 3: 2.0 }, desc: 'test' }],
    prepaymentsHistory: [],
    scenarios: { optimistic: { 3: 1.0 }, base: { 3: 2.5 }, pessimistic: { 3: 4.0 } }
  };
}

test('getEuriborAt — null during fixed period, historical during its window, scenario after', () => {
  const loanState = variableLoanState();
  assert.equal(Calc.getEuriborAt(loanState, 12, 'base'), null);
  assert.equal(Calc.getEuriborAt(loanState, 13, 'base').type, 'hist');
  closeTo(Calc.getEuriborAt(loanState, 13, 'base').rate, 0.02);
  assert.equal(Calc.getEuriborAt(loanState, 15, 'base').type, 'hist');
  assert.equal(Calc.getEuriborAt(loanState, 16, 'base').type, 'base');
  closeTo(Calc.getEuriborAt(loanState, 16, 'base').rate, 0.025);
  closeTo(Calc.getEuriborAt(loanState, 16, 'opt').rate, 0.01);
});

test('buildSchedule — variable-rate payment recalculates at each historical/scenario transition', () => {
  const rows = Calc.buildSchedule(variableLoanState(), 'base');
  closeTo(rows[0].pmt, 965.6074);
  closeTo(rows[11].pmt, 965.6074);
  closeTo(rows[12].pmt, 965.6074); // still within the historical-rate window
  closeTo(rows[15].pmt, 986.0923); // month 16 — falls to scenario, payment recalculated
  const totalInterest = rows.reduce((s, r) => s + r.jur, 0);
  closeTo(totalInterest, 18023.80, 0.1);
});

test('buildSchedule — prepayment with "reduzir prazo" locks the payment and shortens the term', () => {
  const loanState = variableLoanState();
  loanState.prepaymentsHistory = [{ month: 20, amount: 10000, option: 'term' }];
  const rows = Calc.buildSchedule(loanState, 'base');
  assert.equal(rows.length, 107);
  closeTo(rows[19].pmt, 986.0923); // month 20, before the abate takes effect
  closeTo(rows[20].pmt, 986.0923); // payment held fixed after the abate
  closeTo(rows[rows.length - 1].bal, 0);
});

test('buildSchedule — "reduzir prazo" still recalculates the payment at a later Euribor revision', () => {
  // Regression test: the payment used to stay frozen at its "reduzir prazo"
  // value for the rest of the loan, even across later rate changes. A real
  // bank revision recalculates the payment for every borrower regardless of
  // a past term-reduction prepayment — only the amount between revisions
  // should stay locked.
  const loanState = {
    contract: { capital: 100000, termYears: 10, fixedMonths: 0, fixedRate: 0, spread: 1.0 },
    euriborTenor: 3,
    euriborHistory: [
      { startMonth: 1, rates: { 3: 2.0 }, desc: 'rev1' },
      { startMonth: 30, rates: { 3: 5.0 }, desc: 'rev2 - big hike' }
    ],
    prepaymentsHistory: [{ month: 10, amount: 5000, option: 'term' }],
    scenarios: { optimistic: { 3: 1.0 }, base: { 3: 2.5 }, pessimistic: { 3: 4.0 } }
  };
  const rows = Calc.buildSchedule(loanState, 'base');
  closeTo(rows[8].pmt, 988.3081); // month 9, before the abate
  closeTo(rows[28].pmt, 988.3081); // month 29, still locked at the pre-hike rate
  closeTo(rows[29].pmt, 1008.7555); // month 30, rate jumps 2% -> 5%: payment must update
  closeTo(rows[30].pmt, 1008.7555); // month 31, re-locked at the new rate
  closeTo(rows[rows.length - 1].bal, 0);
});

test('buildSchedule — prepayment with "reduzir prestação" recalculates a lower payment, keeps the term', () => {
  const loanState = variableLoanState();
  loanState.prepaymentsHistory = [{ month: 20, amount: 10000, option: 'payment' }];
  const rows = Calc.buildSchedule(loanState, 'base');
  assert.equal(rows.length, 120);
  closeTo(rows[20].pmt, 870.6563); // recalculated the month after the abate
});

test('buildSchedule — overridePrepayments ignores the loan\'s own history (used for "what-if without this abate")', () => {
  const loanState = variableLoanState();
  loanState.prepaymentsHistory = [{ month: 20, amount: 10000, option: 'term' }];
  const withAbate = Calc.buildSchedule(loanState, 'base');
  const withoutAbate = Calc.buildSchedule(loanState, 'base', { overridePrepayments: [] });
  assert.equal(withAbate.length, 107);
  assert.equal(withoutAbate.length, 120);
});

test('buildSchedule — attaches a calendar date only when startDate is given', () => {
  const loanState = variableLoanState();
  const withoutDate = Calc.buildSchedule(loanState, 'base');
  assert.equal(withoutDate[0].date, undefined);
  const withDate = Calc.buildSchedule(loanState, 'base', { startDate: new Date(2026, 0, 1), payDay: 5 });
  assert.equal(withDate[0].date.getDate(), 5);
  assert.equal(withDate[0].date.getMonth(), 0);
  assert.equal(withDate[11].date.getMonth(), 11);
});

test('buildScheduleFrom — continues a schedule from an arbitrary month/balance, matching buildSchedule\'s own continuation', () => {
  const loanState = variableLoanState();
  const full = Calc.buildSchedule(loanState, 'base');
  const pmtAtMonth20 = full[19].pmt;
  const continued = Calc.buildScheduleFrom(loanState, 21, full[19].bal, 'base', 'term', pmtAtMonth20);
  closeTo(continued[0].pmt, full[20].pmt);
  closeTo(continued[0].bal, full[20].bal);
});

test('prepayImpact — "reduzir prazo" reports months saved and no new payment', () => {
  const loanState = variableLoanState();
  loanState.prepaymentsHistory = [{ month: 20, amount: 10000, option: 'term', penalRate: 0.5 }];
  const imp = Calc.prepayImpact(loanState, 0, 'base', 24);
  closeTo(imp.capitalBefore, 85423.309);
  closeTo(imp.capitalAfter, 75423.309);
  closeTo(imp.penalty, 50);
  assert.equal(imp.monthsSaved, 13);
  assert.equal(imp.newPayment, null);
  // hoje=24 is past the prepayment month (20): all the interest saved so far
  // should land in savedReal, and only future months in savedFuture.
  closeTo(imp.savedReal, 117.178, 0.01);
  closeTo(imp.savedFuture, 3024.511, 0.01);
});

test('prepayImpact — "reduzir prestação" reports the new (lower) payment and no term change', () => {
  const loanState = variableLoanState();
  loanState.prepaymentsHistory = [{ month: 20, amount: 10000, option: 'payment', penalRate: 0.5 }];
  const imp = Calc.prepayImpact(loanState, 0, 'base', 24);
  assert.equal(imp.monthsSaved, 0);
  closeTo(imp.newPayment, 870.6563);
});

test('refinanceComparison — a lower spread and modest transfer cost shows real savings', () => {
  const loanState = variableLoanState();
  const result = Calc.refinanceComparison(loanState, 'base', { switchMonth: 24, newSpread: 0.3, newFixedMonths: 0, newFixedRate: 0, transferCost: 500 });
  closeTo(result.capital, 82462.623);
  closeTo(result.jurAtual, 12202.239);
  closeTo(result.jurNovo, 9676.098);
  closeTo(result.poupanca, 2026.141, 0.01);
  closeTo(result.newPmt, 959.7783);
});

test('refinanceComparison — same rate plus a large transfer cost makes switching worse', () => {
  const loanState = variableLoanState();
  const result = Calc.refinanceComparison(loanState, 'base', { switchMonth: 24, newSpread: 1.0, newFixedMonths: 0, newFixedRate: 0, transferCost: 20000 });
  closeTo(result.jurNovo, result.jurAtual); // identical rate/spread/term -> identical interest
  closeTo(result.poupanca, -20000);
});

test('refinanceComparison — returns null once switchMonth falls past the end of the loan', () => {
  const loanState = variableLoanState();
  const result = Calc.refinanceComparison(loanState, 'base', { switchMonth: 999, newSpread: 0.3, newFixedMonths: 0, newFixedRate: 0, transferCost: 0 });
  assert.equal(result, null);
});

test('totalPrepaymentImpact — combines every prepayment into one cumulative savings series', () => {
  const loanState = variableLoanState();
  loanState.prepaymentsHistory = [
    { month: 20, amount: 10000, option: 'term', penalRate: 0.5 },
    { month: 40, amount: 5000, option: 'payment', penalRate: 0.5 }
  ];
  const imp = Calc.totalPrepaymentImpact(loanState, 'base', 50);
  closeTo(imp.savedReal, 1031.838);
  closeTo(imp.savedFuture, 1481.268);
  assert.equal(imp.cumulative.length, 120);
  // interest for month N is computed on the balance before that month's
  // prepayment is applied, so the effect only shows up from month N+1 on
  assert.equal(imp.cumulative[19], 0); // month 20: the abate month itself
  assert.ok(imp.cumulative[20] > 0); // month 21: first month it shows up
  // savedReal is exactly the cumulative total up to "hoje" (month 50)
  closeTo(imp.cumulative[49], imp.savedReal);
});

test('totalPrepaymentImpact — an empty prepayment history saves nothing', () => {
  const loanState = variableLoanState();
  const imp = Calc.totalPrepaymentImpact(loanState, 'base', 50);
  assert.equal(imp.savedReal, 0);
  assert.equal(imp.savedFuture, 0);
  assert.equal(imp.monthsSaved, 0);
  assert.ok(imp.cumulative.every(v => v === 0));
});
