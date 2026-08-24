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
