// STATE
let euriborHistory = [{ startMonth: 25, rates: { 3: 2.50, 6: 2.70, 12: 3.10 }, desc: 'Q1 revision' }];
let euriborTenor = 3; // 3, 6 ou 12
let scenarioRates = {
  opt: { 3: 1.50, 6: 1.70, 12: 2.00 },
  base: { 3: 2.50, 6: 2.70, 12: 3.00 },
  pess: { 3: 4.00, 6: 4.20, 12: 4.50 }
};
let prepaymentsHistory = [];
let extraCosts = [];
let editHistIndex = null, editAbateIndex = null, editCustoIndex = null;
let tlSc = 'base', tblSc = 'base', tblRows = CONFIG.TABLE.INITIAL_ROWS, abatesImpactSc = 'base';
let capitalChartInstance = null;
let aggregateChartInstance = null;
let euriborChartInstance = null;
let abatesSavingsChartInstance = null;
let lang = 'pt';
let loans = [];
let activeLoanId = null;

// HELPERS
const EUR = n => Utils.formatCurrency(n, lang);
const PCT = n => Utils.formatPercent(n, 3);

// ── UNDO TOAST ──────────────────────────────────────────
let _undoTimer;
function showUndoToast(message, onUndo) {
  const t = i18n[lang] || i18n.pt;
  let el = document.getElementById('undo-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'undo-toast';
    el.className = 'undo-toast';
    document.body.appendChild(el);
  }
  clearTimeout(_undoTimer);
  el.innerHTML = `<span>${Utils.escapeHtml(message)}</span><button class="btn btn-ghost btn-sm" id="undo-toast-btn">${t.messages.undo}</button>`;
  el.classList.add('show');
  document.getElementById('undo-toast-btn').onclick = () => {
    clearTimeout(_undoTimer);
    el.classList.remove('show');
    onUndo();
  };
  _undoTimer = setTimeout(() => el.classList.remove('show'), 6000);
}

// Non-blocking info notice — reuses the undo-toast element/style, just
// without an action button.
function showInfoToast(message) {
  let el = document.getElementById('undo-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'undo-toast';
    el.className = 'undo-toast';
    document.body.appendChild(el);
  }
  clearTimeout(_undoTimer);
  el.innerHTML = `<span>${Utils.escapeHtml(message)}</span>`;
  el.classList.add('show');
  _undoTimer = setTimeout(() => el.classList.remove('show'), 4000);
}

// ── MODAL ───────────────────────────────────────────────
// Resolves to the raw input string (showInput mode), true/false (plain
// confirm), or null if cancelled.
function openModal({ title, message, inputValue, showInput, confirmLabel, cancelLabel, danger }) {
  const t = i18n[lang] || i18n.pt;
  return new Promise(resolve => {
    const overlay = document.getElementById('modal-overlay');
    const input = document.getElementById('modal-input');
    const msgEl = document.getElementById('modal-message');
    const confirmBtn = document.getElementById('modal-confirm');
    const cancelBtn = document.getElementById('modal-cancel');

    document.getElementById('modal-title').textContent = title;
    msgEl.textContent = message || '';
    msgEl.style.display = message ? 'block' : 'none';
    input.style.display = showInput ? 'block' : 'none';
    input.value = inputValue || '';
    confirmBtn.textContent = confirmLabel || t.form.save;
    cancelBtn.textContent = cancelLabel || t.form.cancel;
    confirmBtn.className = 'btn btn-sm ' + (danger ? 'btn-danger' : 'btn-primary');

    const close = result => {
      overlay.style.display = 'none';
      overlay.removeEventListener('keydown', onKeyDown);
      overlay.removeEventListener('click', onOverlayClick);
      confirmBtn.onclick = null; cancelBtn.onclick = null;
      resolve(result);
    };
    const onKeyDown = e => {
      if (e.key === 'Escape') close(showInput ? null : false);
      if (e.key === 'Enter' && showInput) close(input.value);
    };
    const onOverlayClick = e => { if (e.target === overlay) close(showInput ? null : false); };

    confirmBtn.onclick = () => close(showInput ? input.value : true);
    cancelBtn.onclick = () => close(showInput ? null : false);
    overlay.addEventListener('keydown', onKeyDown);
    overlay.addEventListener('click', onOverlayClick);
    overlay.style.display = 'flex';
    if (showInput) { input.focus(); input.select(); } else { confirmBtn.focus(); }
  });
}

function initStartDateSelects() {
  const mesEl = document.getElementById('cfg-inicio-mes');
  const anoEl = document.getElementById('cfg-inicio-ano');
  if (!mesEl || !anoEl) return;
  const meses = lang === 'en' ? ['Month', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] : ['Mês', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const mesSel = mesEl.value || '';
  mesEl.innerHTML = meses.map((m, i) => `<option value="${i === 0 ? '' : i}"${mesSel === (i === 0 ? '' : String(i)) ? ' selected' : ''}>${m}</option>`).join('');
  const anoSel = anoEl.value || '';
  const now = new Date().getFullYear();
  let opts = `<option value="">${lang === 'en' ? 'Year' : 'Ano'}</option>`;
  for (let y = now; y >= now - 40; y--)opts += `<option value="${y}"${anoSel === String(y) ? ' selected' : ''}>${y}</option>`;
  anoEl.innerHTML = opts;
}

function getStartDate() {
  const mes = parseInt(document.getElementById('cfg-inicio-mes')?.value || '0');
  const ano = parseInt(document.getElementById('cfg-inicio-ano')?.value || '0');
  if (mes && ano) return new Date(ano, mes - 1, 1);
  return null;
}
function getStartDateOrFallback() { return getStartDate() || new Date(new Date().getFullYear(), new Date().getMonth() - cfgI('cfg-hoje'), 1); }
const fmtM = n => { const locale = lang === 'en' ? 'en-GB' : 'pt-PT'; const s = getStartDateOrFallback(); const d = new Date(s.getFullYear(), s.getMonth() + n - 1, 1); return d.toLocaleDateString(locale, { month: 'short', year: 'numeric' }) };
const hasStartDate = () => !!getStartDate();
const cfg = id => parseFloat(document.getElementById(id).value) || 0;
const cfgI = id => parseInt(document.getElementById(id).value) || 0;

function syncHojeFromStartDate() {
  const m = parseInt(document.getElementById('cfg-inicio-mes')?.value || '0');
  const y = parseInt(document.getElementById('cfg-inicio-ano')?.value || '0');
  const hojeEl = document.getElementById('cfg-hoje');
  if (!hojeEl) return;
  if (!m || !y) { hojeEl.removeAttribute('readonly'); hojeEl.style.color = ''; return; }
  const payDay = cfgI('cfg-dia-pagamento') || 1;
  const now = new Date();
  // start month itself is loan-month 1, not 0
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() - (m - 1)) + 1;
  if (now.getDate() < payDay) months--;
  if (months < 0) months = 0;
  hojeEl.value = months;
  hojeEl.setAttribute('readonly', '');
  hojeEl.style.color = 'var(--steel)';
}

function calcMonthsElapsed() {
  syncHojeFromStartDate();
  recalc();
}

function buildSched(sc, overridePrepayments) {
  const loanState = captureContractData();
  const startDate = getStartDateOrFallback();
  const payDay = cfgI('cfg-dia-pagamento') || 1;
  return Calc.buildSchedule(loanState, sc, { overridePrepayments, startDate, payDay });
}

function renderResumo() {
  const C = cfg('cfg-capital');
  const rows = buildSched('base');
  const hoje = Math.min(cfgI('cfg-hoje'), rows.length);
  const rH = rows[hoje - 1];
  if (hoje > 0 && !rH) return;
  const balAtual = rH ? rH.bal : C;
  let jp = 0; for (let i = 0; i < hoje && i < rows.length; i++)jp += rows[i].jur;
  const pct = (C - balAtual) / C * 100;
  document.getElementById('r-capital').textContent = EUR(balAtual);
  document.getElementById('r-jpagos').textContent = EUR(jp);
  const t = i18n[lang] || i18n.pt;
  document.getElementById('r-mrest').textContent = (rows.length - hoje) + ' ' + t.summary.monthsLabel;
  document.getElementById('r-pct').textContent = EUR(C - balAtual) + ' (' + pct.toFixed(1) + t.summary.pctAmortized + ')';
  document.getElementById('r-bar').style.width = pct + '%';
  document.getElementById('r-data').textContent = `${t.summary.month} ${hoje} · ${fmtM(hoje)}`;
  const nR = rows[hoje];
  if (nR) { document.getElementById('r-pmt').textContent = EUR(nR.pmt); document.getElementById('r-taxa').textContent = PCT(nR.euTot) + ' ' + t.summary.totalLabel; }
  const totalMonths = cfgI('cfg-prazo') * 12;
  let totalCosts = 0;
  for (const c of extraCosts) {
    if (c.frequency === 'oneTime') {
      totalCosts += c.amount;
    } else {
      const monthly = c.frequency === 'annual' ? c.amount / 12 : c.amount;
      const end = c.endMonth || totalMonths;
      totalCosts += monthly * Math.max(0, end - c.startMonth + 1);
    }
  }
  let baseInterest = 0;
  ['opt', 'base', 'pess'].forEach(sc => {
    const r = sc === 'base' ? rows : buildSched(sc); let tj = 0; for (const x of r) tj += x.jur;
    if (sc === 'base') baseInterest = tj;
    document.getElementById('r-tot-' + sc).textContent = EUR(C + tj + totalCosts);
    document.getElementById('r-j-' + sc).textContent = EUR(tj) + ' ' + t.summary.interestLabel + (totalCosts > 0 ? ' + ' + EUR(totalCosts) + ' ' + (t.summary.costsLabel || 'custos') : '');
  });
  const breakdownEl = document.getElementById('r-costs-breakdown');
  if (breakdownEl) {
    if (totalCosts > 0) {
      breakdownEl.innerHTML = `🧾 <strong>${t.summary.costBreakdown || 'Decomposição (cenário base)'}:</strong> ${EUR(C)} capital + ${EUR(baseInterest)} juros + ${EUR(totalCosts)} ${t.summary.costsLabel || 'custos adicionais'}`;
      breakdownEl.style.display = 'block';
    } else {
      breakdownEl.style.display = 'none';
    }
  }
  const lh = euriborHistory[euriborHistory.length - 1];
  const nxRev = lh ? lh.startMonth + euriborTenor : cfgI('cfg-fixos') + 1;
  const tenorLabel = euriborTenor + 'M';
  const lastRate = lh ? ((lh.rates && lh.rates[euriborTenor]) ?? lh.rate) : null;
  const lastStatus = lh ? `${PCT(lastRate)} (${tenorLabel} ${t.summary.fromMonth || 'desde mês'} ${lh.startMonth})` : t.summary.none;
  document.getElementById('r-info').innerHTML = `📋 <strong>${t.summary.lastRateLabel}:</strong> ${lastStatus} &nbsp;·&nbsp; ${t.summary.nextReviewLabel}: ${t.summary.month} ${nxRev} (${fmtM(nxRev)})`;

  renderCapitalChart(rows, hoje);
}

function renderCapitalChart(rows, hoje) {
  const t = i18n[lang] || i18n.pt;
  const ctx = document.getElementById('capital-chart').getContext('2d');
  const labels = rows.map((r, i) => i + 1);
  const capitalPast = rows.map((r, i) => i <= hoje - 1 ? r.bal : null);
  const capitalFuture = rows.map((r, i) => i >= hoje - 1 ? r.bal : null);
  let cumJur = 0;
  const jurosData = rows.map((r, i) => { if (i < hoje) { cumJur += r.jur; return cumJur; } return null; });
  // cumJur now holds total real interest paid; start forecast from this anchor
  const totalRealJur = cumJur;
  let cumJurFut = totalRealJur;
  const jurosDataFuture = rows.map((r, i) => { if (i < hoje - 1) return null; if (i === hoje - 1) return totalRealJur; cumJurFut += r.jur; return cumJurFut; });
  if (capitalChartInstance) { capitalChartInstance.destroy(); capitalChartInstance = null; }
  capitalChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: t.summary.chartCapital,
        data: capitalPast,
        borderColor: 'var(--mid)',
        backgroundColor: 'rgba(44,82,130,0.1)',
        fill: false
      }, {
        label: '_future',
        data: capitalFuture,
        borderColor: 'rgba(44,82,130,0.3)',
        backgroundColor: 'transparent',
        borderDash: [5, 4],
        fill: false
      }, {
        label: t.summary.chartInterest,
        data: jurosData,
        borderColor: 'var(--gold)',
        backgroundColor: 'rgba(200,146,58,0.1)',
        fill: false
      }, {
        label: '_future_interest',
        data: jurosDataFuture,
        borderColor: 'rgba(200,146,58,0.35)',
        backgroundColor: 'transparent',
        borderDash: [5, 4],
        fill: false
      }]
    },
    options: {
      responsive: true,
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: { filter: item => !item.text.startsWith('_') }
        },
        tooltip: {
          enabled: true,
          filter: item => item.raw != null && !item.dataset.label.startsWith('_'),
          callbacks: { label: ctx => ctx.raw != null ? ctx.dataset.label + ': ' + EUR(ctx.raw) : null }
        }
      },
      elements: {
        point: { radius: 0, hoverRadius: 6, hitRadius: 8 }
      },
      scales: {
        x: { title: { display: true, text: t.summary.chartMonth } },
        y: { title: { display: true, text: t.summary.chartValue } }
      }
    }
  });
}

function renderHist() {
  const el = document.getElementById('hist-list');
  const t = i18n[lang] || i18n.pt;
  if (!euriborHistory.length) { el.innerHTML = `<div class="empty">${t.euribor.noHistory}</div>`; return; }
  el.innerHTML = euriborHistory.map((h, i) => {
    const rate = (h.rates && h.rates[euriborTenor]) ?? h.rate ?? 0;
    return `
    <div class="euribor-entry historical">
      <div><div class="entry-period">${t.table.month} ${h.startMonth}+</div><div style="font-size:.68rem;color:var(--steel)">${Utils.escapeHtml(h.desc) || fmtM(h.startMonth)}</div></div>
      <div class="entry-bar-wrap"><div class="entry-bar" style="width:${Math.min(rate / 5 * 100, 100)}%;background:var(--green2)"></div></div>
      <div class="entry-rate historical">${PCT(rate)}</div>
      <div style="display:flex;gap:4px;align-items:center">
        <span class="chip chip-hist">${t.table.chipHist}</span>
        <button class="btn btn-ghost btn-sm" onclick="editHist(${i})" aria-label="${t.form.edit}" title="${t.form.edit}" style="padding:3px 7px;font-size:.65rem">✎</button>
        <button class="btn btn-danger btn-sm" onclick="removeHist(${i})" style="padding:3px 7px;font-size:.65rem">✕</button>
      </div>
    </div>`;
  }).join('');
}

function renderTl() {
  const el = document.getElementById('tl-list');
  const t = i18n[lang] || i18n.pt;
  const F = cfgI('cfg-fixos'), N = cfgI('cfg-prazo') * 12, sp = cfg('cfg-spread');
  const scCol = { opt: '#16a34a', base: '#d97706', pess: '#dc2626' };
  const periods = [];
  periods.push({ label: `${t.table.months} 1–${F}`, eu: null, taxa: cfg('cfg-fixa'), type: 'fixed', desc: t.euribor.fixedRateDesc });
  for (let i = 0; i < euriborHistory.length; i++) {
    const hist = euriborHistory[i];
    const fim = hist.startMonth + euriborTenor - 1;
    const histRate = (hist.rates && hist.rates[euriborTenor]) ?? hist.rate ?? 0;
    periods.push({ label: `${t.table.months} ${hist.startMonth}–${fim}`, eu: histRate, taxa: histRate + sp, type: 'hist', desc: hist.desc });
  }
  const lastM = euriborHistory.length ? euriborHistory[euriborHistory.length - 1].startMonth + euriborTenor : F + 1;
  if (lastM <= N) {
    const scEu = (scenarioRates[tlSc] && scenarioRates[tlSc][euriborTenor]) || 0;
    const scLbl = { opt: t.euribor.scenarioOpt, base: t.euribor.scenarioBase, pess: t.euribor.scenarioPess };
    const scenarioName = scLbl[tlSc] || tlSc;
    periods.push({ label: `${t.table.months} ${lastM}–${N}`, eu: scEu, taxa: scEu + sp, type: tlSc, desc: t.euribor.scenarioForecast.replace('{scenario}', scenarioName) });
  }
  const maxT = Math.max(...periods.map(p => p.taxa));
  const rCls = { hist: 'historical', opt: 'future-opt', base: 'future-base', pess: 'future-pess' };
  el.innerHTML = periods.map(p => {
    const bc = p.type === 'fixed' ? '#c8923a' : p.type === 'hist' ? '#27a96a' : scCol[p.type] || '#aaa';
    const rc = p.type === 'fixed' ? 'historical' : rCls[p.type] || 'historical';
    const badge = p.type === 'fixed' ? `<span class="chip chip-fixed">${t.table.chipFixed}</span>` : p.type === 'hist' ? `<span class="chip chip-hist">${t.table.chipHist}</span>` : `<span class="chip chip-${p.type}">${p.type === 'opt' ? t.euribor.scenarioChartOpt : p.type === 'base' ? t.euribor.scenarioChartBase : t.euribor.scenarioChartPess}</span>`;
    const taxa = p.type === 'fixed' ? PCT(p.taxa) : t.euribor.rateFormula.replace('{eu}', PCT(p.eu)).replace('{sp}', PCT(sp)).replace('{taxa}', PCT(p.taxa));
    return `<div class="euribor-entry ${p.type !== 'fixed' && p.type !== 'hist' ? 'future' : 'historical'}">
      <div><div class="entry-period">${p.label}</div><div style="font-size:.67rem;color:var(--steel)">${Utils.escapeHtml(p.desc) || taxa}</div></div>
      <div class="entry-bar-wrap"><div class="entry-bar" style="width:${Math.min(p.taxa / maxT * 100, 100)}%;background:${bc}"></div></div>
      <div class="entry-rate ${rc}">${PCT(p.taxa)}</div>${badge}</div>`;
  }).join('');
  renderEuriborChart();
}

function renderEuriborChart() {
  const canvas = document.getElementById('euribor-chart');
  if (!canvas) return;
  const t = i18n[lang] || i18n.pt;
  const rows = buildSched(tlSc);
  const hoje = cfgI('cfg-hoje');
  const labels = rows.map((r, i) => i + 1);
  const euPast = rows.map((r, i) => i <= hoje - 1 ? r.eu : null);
  const euFuture = rows.map((r, i) => i >= Math.max(hoje - 1, 0) ? r.eu : null);
  if (euriborChartInstance) { euriborChartInstance.destroy(); euriborChartInstance = null; }
  euriborChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: t.euribor.chartApplied,
        data: euPast,
        borderColor: 'var(--green2)',
        backgroundColor: 'rgba(39,169,106,0.1)',
        fill: false
      }, {
        label: '_future_euribor',
        data: euFuture,
        borderColor: 'rgba(39,169,106,0.35)',
        backgroundColor: 'transparent',
        borderDash: [5, 4],
        fill: false
      }]
    },
    options: {
      responsive: true,
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: { filter: item => !item.text.startsWith('_') }
        },
        tooltip: {
          enabled: true,
          filter: item => item.raw != null && !item.dataset.label.startsWith('_'),
          callbacks: { label: ctx => ctx.raw != null ? ctx.dataset.label + ': ' + PCT(ctx.raw) : null }
        }
      },
      elements: {
        point: { radius: 0, hoverRadius: 6, hitRadius: 8 }
      },
      scales: {
        x: { title: { display: true, text: t.summary.chartMonth } },
        y: { title: { display: true, text: t.euribor.chartAxis } }
      }
    }
  });
}

function renderTbl(reset) {
  if (reset) tblRows = CONFIG.TABLE.INITIAL_ROWS;
  const t = i18n[lang] || i18n.pt;
  const hoje = cfgI('cfg-hoje'), rows = buildSched(tblSc);
  if (!rows.length) {
    document.getElementById('tbl-body').innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--steel)">—</td></tr>`;
    document.getElementById('tbl-more').style.display = 'none';
    return;
  }
  const end = Math.min(tblRows, rows.length);
  const scLbl = { hist: t.table.chipHist, opt: t.euribor.scenarioChartOpt, base: t.euribor.scenarioChartBase, pess: t.euribor.scenarioChartPess };
  const scLeg = { opt: '🟢 ' + t.euribor.scenarioOpt, base: '🟡 ' + t.euribor.scenarioBase, pess: '🔴 ' + t.euribor.scenarioPess };
  document.getElementById('tbl-sc-legend').textContent = '■ ' + scLeg[tblSc];
  const prepayByMonth = {};
  for (const p of prepaymentsHistory) {
    if (!prepayByMonth[p.month]) prepayByMonth[p.month] = [];
    prepayByMonth[p.month].push(p);
  }
  let h = '';
  for (let i = 0; i < end; i++) {
    const r = rows[i], isT = r.mes === hoje;
    const rc = isT ? 'row-today' : r.isF ? 'row-fixed' : r.euType === 'hist' ? 'row-hist' : 'row-' + r.euType;
    const chip = isT ? `<span class="chip chip-today">${t.table.chipToday}</span>` : r.isF ? `<span class="chip chip-fixed">${t.table.chipFixed}</span>` : `<span class="chip chip-${r.euType}">${scLbl[r.euType]}</span>`;
    const eu = r.isF ? PCT(cfg('cfg-fixa')) : PCT(r.eu);
    const locale = lang === 'en' ? 'en-GB' : 'pt-PT';
    h += `<tr class="${rc}"><td>${r.mes}</td><td style="text-align:left;padding-left:10px">${r.date.toLocaleDateString(locale, { month: 'short', year: 'numeric' })}</td><td>${EUR(r.pmt)}</td><td>${EUR(r.jur)}</td><td>${EUR(r.amort)}</td><td>${EUR(r.bal)}</td><td>${eu}</td><td>${chip}</td></tr>`;
    if (prepayByMonth[r.mes]) {
      let runBal = r.bal;
      for (const p of prepayByMonth[r.mes]) {
        runBal = Math.max(runBal - p.amount, 0);
        h += `<tr class="row-prepay"><td colspan="8"><div class="prepay-detail">
          <span class="chip chip-prepay">${t.prepayment.tag}</span>
          <span style="color:var(--green);font-weight:600">−${EUR(p.amount)}</span>
          <span style="color:var(--steel)">·</span>
          <span style="color:var(--steel)">${t.prepayment.capitalAfterPay}:</span>
          <strong style="color:var(--ink)">${EUR(runBal)}</strong>
          ${p.desc ? `<span style="color:var(--steel);font-size:.68rem">${Utils.escapeHtml(p.desc)}</span>` : ''}
        </div></td></tr>`;
      }
    }
  }
  document.getElementById('tbl-body').innerHTML = h;
  document.getElementById('tbl-more').style.display = tblRows >= rows.length ? 'none' : 'block';
  const warnEl = document.getElementById('tbl-date-warn');
  if (warnEl) warnEl.style.display = hasStartDate() ? 'none' : 'block';
}

function buildSchedFrom(startMonth, startBalance, sc, op, pmtRef) {
  return Calc.buildScheduleFrom(captureContractData(), startMonth, startBalance, sc, op, pmtRef);
}

// Reads from a stored loan object instead of the DOM, so the aggregate view
// can compute every loan without switching the active one.
function buildScheduleForLoan(loan, sc) {
  return Calc.buildSchedule(loan, sc);
}

function renderAgregado() {
  syncActiveLoanIntoArray();
  const el = document.getElementById('agregado-list');
  const t = i18n[lang] || i18n.pt;
  if (!el) return;
  if (!loans.length) { el.innerHTML = `<div class="empty">${t.aggregate.noLoans}</div>`; return; }
  let totalCapital = 0, totalPmt = 0, totalJurosPagos = 0;
  const rowsHtml = loans.map(loan => {
    const rows = buildScheduleForLoan(loan, 'base');
    const hoje = Math.min(loan.contract.currentMonth || 0, rows.length);
    const rH = rows[hoje - 1];
    const capital = rH ? rH.bal : loan.contract.capital;
    let jp = 0; for (let i = 0; i < hoje && i < rows.length; i++) jp += rows[i].jur;
    const nR = rows[hoje];
    const pmtAtual = nR ? nR.pmt : (rows[0] ? rows[0].pmt : 0);
    const restantes = Math.max(rows.length - hoje, 0);
    totalCapital += capital; totalPmt += pmtAtual; totalJurosPagos += jp;
    const isActive = loan.id === activeLoanId;
    return `<tr class="${isActive ? 'row-today' : ''}"><td style="text-align:left;padding-left:10px">${Utils.escapeHtml(loan.name)}${isActive ? ` <span class="chip chip-today">${t.loans.activeTag}</span>` : ''}</td><td>${EUR(capital)}</td><td>${EUR(pmtAtual)}</td><td>${EUR(jp)}</td><td>${restantes} ${t.summary.monthsLabel}</td></tr>`;
  }).join('');
  el.innerHTML = `<div class="tbl-wrap"><table><thead><tr>
    <th style="text-align:left;padding-left:10px">${t.aggregate.loan}</th>
    <th>${t.table.capital}</th><th>${t.summary.currentPayment}</th><th>${t.summary.interestPaid}</th><th>${t.summary.remainingMonths}</th>
  </tr></thead><tbody>${rowsHtml}
    <tr style="font-weight:700;border-top:2px solid var(--border)"><td style="text-align:left;padding-left:10px">${t.aggregate.total}</td><td>${EUR(totalCapital)}</td><td>${EUR(totalPmt)}</td><td>${EUR(totalJurosPagos)}</td><td></td></tr>
  </tbody></table></div>`;
  document.getElementById('ag-total-capital').textContent = EUR(totalCapital);
  document.getElementById('ag-total-pmt').textContent = EUR(totalPmt);
  document.getElementById('ag-total-jpagos').textContent = EUR(totalJurosPagos);
  document.getElementById('ag-count').textContent = loans.length;
  renderAggregateChart();
}

function renderAggregateChart() {
  const canvas = document.getElementById('aggregate-chart');
  if (!canvas) return;
  const t = i18n[lang] || i18n.pt;
  const labels = loans.map(l => l.name);
  const capitais = loans.map(loan => {
    const rows = buildScheduleForLoan(loan, 'base');
    const hoje = Math.min(loan.contract.currentMonth || 0, rows.length);
    const rH = rows[hoje - 1];
    return rH ? rH.bal : loan.contract.capital;
  });
  if (aggregateChartInstance) { aggregateChartInstance.destroy(); aggregateChartInstance = null; }
  aggregateChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [{ label: t.summary.chartCapital, data: capitais, backgroundColor: 'rgba(44,82,130,0.55)', borderRadius: 4 }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => EUR(c.raw) } } },
      scales: { y: { title: { display: true, text: t.summary.chartValue } } }
    }
  });
}

function withCustomFallbackRate(loanState, ratePct) {
  return { ...loanState, scenarios: { ...loanState.scenarios, base: { ...(loanState.scenarios.base || {}), [loanState.euriborTenor]: ratePct } } };
}

// Contractual penalty is typically 0.5% in the variable-rate period and 2%
// in the fixed-rate one — pick the right default for the prepayment's month.
function defaultPenaltyRateFor(month) {
  const inFixedPeriod = month > 0 && month <= cfgI('cfg-fixos');
  return (inFixedPeriod ? CONFIG.PREPAYMENT_PENALTY.FIXED_RATE : CONFIG.PREPAYMENT_PENALTY.VARIABLE_RATE) * 100;
}

// Only overwrites the field while it still holds a known default (0.5 or 2).
function refreshPenaltyRateDefault(elId, month) {
  const el = document.getElementById(elId);
  if (!el) return;
  const cur = parseFloat(el.value);
  const isDefaultLike = isNaN(cur) || cur === CONFIG.PREPAYMENT_PENALTY.VARIABLE_RATE * 100 || cur === CONFIG.PREPAYMENT_PENALTY.FIXED_RATE * 100;
  if (isDefaultLike) el.value = defaultPenaltyRateFor(month);
}

function calcAbate() {
  const mesSim = parseInt(document.getElementById('ab-mes').value) || cfgI('cfg-hoje');
  refreshPenaltyRateDefault('ab-penal-rate', mesSim);
  const abate = parseFloat(document.getElementById('ab-val').value) || 0;
  const op = document.getElementById('ab-op').value;
  const scSelect = document.getElementById('ab-sc').value;
  const isCustom = scSelect === 'custom';
  const sc = isCustom ? 'base' : scSelect;
  let loanState = captureContractData();
  if (isCustom) {
    const customRate = parseFloat(document.getElementById('ab-sc-custom')?.value) || 0;
    loanState = withCustomFallbackRate(loanState, customRate);
  }
  const startDate = getStartDateOrFallback();
  const payDay = cfgI('cfg-dia-pagamento') || 1;
  const rows = Calc.buildSchedule(loanState, sc, { startDate, payDay });
  const rowAntes = rows[mesSim - 1];
  if (!rowAntes) { document.getElementById('ab-result').style.display = 'none'; return; }

  const capAntes = rowAntes.bal;
  const capApos = Math.max(capAntes - abate, 0);

  let jSem = 0;
  for (let i = mesSim; i < rows.length; i++) jSem += rows[i].jur;

  const pmtRef = rows[mesSim] ? rows[mesSim].pmt : 0;
  const rowsCom = Calc.buildScheduleFrom(loanState, mesSim + 1, capApos, sc, op, pmtRef);
  let jCom = 0; for (const r of rowsCom) jCom += r.jur;

  const mesesSem = rows.length - mesSim;
  const mesesCom = rowsCom.length;
  const poupar = jSem - jCom;
  const penalPct = parseFloat(document.getElementById('ab-penal-rate')?.value || defaultPenaltyRateFor(mesSim)) / 100;
  const penal = abate * penalPct;

  const novaPmt = op === 'payment' && rowsCom.length > 0 ? rowsCom[0].pmt : 0;

  document.getElementById('ab-result').style.display = 'block';
  document.getElementById('ab-poupar').textContent = EUR(Math.max(poupar, 0));
  document.getElementById('ab-cap-antes').textContent = EUR(capAntes);
  document.getElementById('ab-cap').textContent = EUR(capApos);
  document.getElementById('ab-sem').textContent = EUR(jSem);
  document.getElementById('ab-com').textContent = EUR(jCom);
  document.getElementById('ab-penal').textContent = EUR(penal);
  const t = i18n[lang] || i18n.pt;
  const penalLbl = document.getElementById('ab-penal-lbl');
  if (penalLbl) { const pctStr = (penalPct * 100).toString().replace('.', ','); penalLbl.textContent = (t.prepayment.penaltyLabel || 'Penalização').replace('{pct}', pctStr); }
  if (op === 'payment') {
    document.getElementById('ab-op-lbl').textContent = t.prepayment.newPayment;
    document.getElementById('ab-op-val').textContent = EUR(novaPmt);
  } else {
    const redução = mesesSem - mesesCom;
    document.getElementById('ab-op-lbl').textContent = t.prepayment.reductionLabel;
    document.getElementById('ab-op-val').textContent = redução > 0 ? t.prepayment.monthsLess.replace('{n}', redução) : '—';
  }
}

// ── BANK OFFERS (comparador) — ephemeral, per-session only, like the rest
// of the comparator's inputs; not saved to loan state or localStorage.
let bankOffers = [{ id: 1, name: '', newSpread: 0.60, newFixedMonths: 0, newFixedRate: 3.00, transferCost: 1000 }];
let bankOfferSeq = 2;

function addBankOffer() {
  bankOffers.push({ id: bankOfferSeq++, name: '', newSpread: 0.60, newFixedMonths: 0, newFixedRate: 3.00, transferCost: 1000 });
  renderBankOffers();
  calcComparador();
}

function removeBankOffer(id) {
  if (bankOffers.length <= 1) return;
  bankOffers = bankOffers.filter(o => o.id !== id);
  renderBankOffers();
  calcComparador();
}

function updateBankOffer(id, field, value) {
  const o = bankOffers.find(o => o.id === id);
  if (!o) return;
  o[field] = field === 'name' ? value : (parseFloat(value) || 0);
  calcComparador();
}

function renderBankOffers() {
  const el = document.getElementById('refi-offers-list');
  if (!el) return;
  const t = i18n[lang] || i18n.pt;
  el.innerHTML = bankOffers.map(o => `
    <div class="bank-offer-row" data-id="${o.id}">
      <input type="text" class="offer-name" value="${Utils.escapeHtml(o.name)}" placeholder="${t.refi.offerNamePlaceholder}" oninput="updateBankOffer(${o.id},'name',this.value)">
      <input type="number" class="offer-spread" value="${o.newSpread}" step="0.01" min="0" max="5" oninput="updateBankOffer(${o.id},'newSpread',this.value)">
      <input type="number" class="offer-fixos" value="${o.newFixedMonths}" min="0" oninput="updateBankOffer(${o.id},'newFixedMonths',this.value)">
      <input type="number" class="offer-fixa" value="${o.newFixedRate}" step="0.01" min="0" max="20" oninput="updateBankOffer(${o.id},'newFixedRate',this.value)">
      <input type="number" class="offer-custo" value="${o.transferCost}" step="50" min="0" oninput="updateBankOffer(${o.id},'transferCost',this.value)">
      <button type="button" class="btn btn-danger btn-sm offer-remove" onclick="removeBankOffer(${o.id})" ${bankOffers.length <= 1 ? 'disabled' : ''}>✕</button>
    </div>`).join('');
}

function calcComparador() {
  const t = i18n[lang] || i18n.pt;
  const mesSim = parseInt(document.getElementById('refi-mes').value) || cfgI('cfg-hoje');
  const sc = document.getElementById('refi-sc').value;
  const loanState = captureContractData();
  const resultsEl = document.getElementById('refi-result');
  const tbody = document.getElementById('refi-comparison-body');

  const results = bankOffers.map(o => ({
    offer: o,
    result: Calc.refinanceComparison(loanState, sc, { switchMonth: mesSim, newSpread: o.newSpread, newFixedMonths: o.newFixedMonths, newFixedRate: o.newFixedRate, transferCost: o.transferCost })
  })).filter(r => r.result);

  if (!results.length) { resultsEl.style.display = 'none'; return; }
  resultsEl.style.display = 'block';
  document.getElementById('refi-jur-atual').textContent = EUR(results[0].result.jurAtual);
  document.getElementById('refi-capital').textContent = EUR(results[0].result.capital);

  const best = results.reduce((a, b) => b.result.poupanca > a.result.poupanca ? b : a);
  const multiple = results.length > 1;

  tbody.innerHTML = results.map((r, i) => {
    const name = r.offer.name.trim() || t.refi.offerDefaultName.replace('{n}', i + 1);
    const poupColor = r.result.poupanca >= 0 ? 'var(--green2)' : 'var(--red2)';
    const sign = r.result.poupanca >= 0 ? '' : '-';
    return `<tr>
      <td style="text-align:left">${Utils.escapeHtml(name)}${r === best && multiple ? `<span class="chip chip-today best-tag">${t.refi.bestOffer}</span>` : ''}</td>
      <td>${EUR(r.result.jurNovo)}</td>
      <td>${r.result.newPmt != null ? EUR(r.result.newPmt) : '—'}</td>
      <td style="color:${poupColor};font-weight:600">${sign}${EUR(Math.abs(r.result.poupanca))}</td>
    </tr>`;
  }).join('');

  document.getElementById('refi-poupar').textContent = EUR(Math.abs(best.result.poupanca));
  const banner = document.getElementById('refi-banner');
  const sub = document.getElementById('refi-banner-sub');
  if (best.result.poupanca >= 0) {
    banner.style.background = '';
    sub.textContent = multiple ? t.refi.bestSavings : t.refi.savings;
  } else {
    banner.style.background = 'linear-gradient(135deg, var(--red), #4a1a1a)';
    sub.textContent = (multiple ? t.refi.allWorse : t.refi.worse).replace('{amount}', EUR(Math.abs(best.result.poupanca)));
  }
}

function calcPrepayImpact(i, sc) {
  return Calc.prepayImpact(captureContractData(), i, sc, cfgI('cfg-hoje'));
}

function onAbScChange() {
  const row = document.getElementById('ab-sc-custom-row');
  if (row) row.style.display = document.getElementById('ab-sc').value === 'custom' ? 'flex' : 'none';
  calcAbate();
}

function setAbatesImpactSc(sc, el) {
  abatesImpactSc = sc;
  document.querySelectorAll('#abates-impact-sc .scenario-tab').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderAbatesHist();
}

function renderAbatesHist() {
  const el = document.getElementById('abates-hist-list');
  const t = i18n[lang] || i18n.pt;
  renderAbatesSavingsChart();
  if (!prepaymentsHistory.length) { el.innerHTML = `<div class="empty">${t.prepayment.noHistory}</div>`; return; }
  const hoje = cfgI('cfg-hoje');
  const isPt = lang !== 'en';
  el.innerHTML = prepaymentsHistory.map((a, i) => {
    const imp = calcPrepayImpact(i, abatesImpactSc);
    const totalSaved = imp.savedReal + imp.savedFuture;
    const net = Math.max(totalSaved - imp.penalty, 0);
    const scLabel = abatesImpactSc === 'opt' ? (isPt ? 'opt.' : 'opt.') : abatesImpactSc === 'pess' ? (isPt ? 'pess.' : 'pess.') : (isPt ? 'base' : 'base');
    const optLine = a.option === 'term'
      ? (imp.monthsSaved > 0 ? `${t.prepayment.reductionLabel}: ${t.prepayment.monthsLess.replace('{n}', imp.monthsSaved)}` : (isPt ? 'Prazo: —' : 'Term: —'))
      : (imp.newPayment ? `${t.prepayment.newPayment}: ${EUR(imp.newPayment)}` : '—');
    return `
    <div style="margin-bottom:10px;border-radius:8px;overflow:hidden;border:1px solid var(--border)">
      <div class="euribor-entry historical" style="border-radius:0;margin-bottom:0;border:none;border-left:3px solid var(--green2);border-bottom:1px solid var(--border)">
        <div><div class="entry-period">${t.table.month} ${a.month}</div><div style="font-size:.68rem;color:var(--steel)">${Utils.escapeHtml(a.desc) || fmtM(a.month)} · ${a.option === 'term' ? t.prepayment.historyTextTerm : t.prepayment.historyTextPayment}${a.penalRate != null ? ' · pen. ' + a.penalRate + '%' : ''}</div></div>
        <div class="entry-bar-wrap"><div class="entry-bar" style="width:${Math.min(a.amount / 50000 * 100, 100)}%;background:var(--gold)"></div></div>
        <div class="entry-rate" style="color:var(--amber)">${EUR(a.amount)}${a.penalRate ? `<div style="font-size:.6rem;color:var(--red2);text-align:right">pen. ${EUR(imp.penalty)}</div>` : ''}</div>
        <div style="display:flex;gap:4px;align-items:center">
          <span class="chip chip-fixed">${t.prepayment.tag}</span>
          <button class="btn btn-ghost btn-sm" onclick="editAbate(${i})" aria-label="${t.form.edit}" title="${t.form.edit}" style="padding:3px 7px;font-size:.65rem">✎</button>
          <button class="btn btn-danger btn-sm" onclick="removeAbate(${i})" style="padding:3px 7px;font-size:.65rem">✕</button>
        </div>
      </div>
      <div style="background:var(--fog);padding:8px 14px 10px;border-top:none">
        <div style="font-size:.65rem;font-weight:600;color:var(--steel);text-transform:uppercase;letter-spacing:.04em;margin-bottom:7px">${isPt ? 'Impacto do abate' : 'Prepayment impact'}</div>
        <div style="font-size:.74rem;display:grid;grid-template-columns:repeat(3,1fr);gap:5px 16px">
          <div style="color:var(--steel)">${isPt ? 'Capital' : 'Capital'}: <strong style="color:var(--text)">${EUR(imp.capitalBefore)} → ${EUR(imp.capitalAfter)}</strong></div>
          <div style="color:var(--steel)">${isPt ? 'Poupança bruta' : 'Gross savings'}: <strong style="color:var(--green2)">${EUR(totalSaved)}</strong></div>
          <div style="color:var(--steel)">${isPt ? 'Poupança líquida' : 'Net savings'}: <strong style="color:var(--green2)">${EUR(net)}</strong></div>
          <div style="color:var(--steel)">${isPt ? `Real (até mês ${hoje})` : `Actual (to month ${hoje})`}: <strong style="color:var(--mid)">${EUR(imp.savedReal)}</strong></div>
          <div style="color:var(--steel)">${isPt ? `Previsto (${scLabel})` : `Forecast (${scLabel})`}: <strong style="color:var(--gold)">${EUR(imp.savedFuture)}</strong></div>
          <div style="color:var(--steel)">${optLine}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderAbatesSavingsChart() {
  const card = document.getElementById('abates-savings-card');
  if (!card) return;
  if (!prepaymentsHistory.length) { card.style.display = 'none'; return; }
  const t = i18n[lang] || i18n.pt;
  const loanState = captureContractData();
  const hoje = cfgI('cfg-hoje');
  const imp = Calc.totalPrepaymentImpact(loanState, abatesImpactSc, hoje);
  document.getElementById('ab-total-saved-real').textContent = EUR(imp.savedReal);
  document.getElementById('ab-total-saved-future').textContent = EUR(imp.savedFuture);
  card.style.display = 'block';

  const canvas = document.getElementById('abates-savings-chart');
  if (!canvas) return;
  const labels = imp.cumulative.map((_, i) => i + 1);
  const real = imp.cumulative.map((v, i) => i <= hoje - 1 ? v : null);
  const future = imp.cumulative.map((v, i) => i >= hoje - 1 ? v : null);
  if (abatesSavingsChartInstance) { abatesSavingsChartInstance.destroy(); abatesSavingsChartInstance = null; }
  abatesSavingsChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: t.prepayment.chartSaved,
        data: real,
        borderColor: 'var(--green2)',
        backgroundColor: 'rgba(39,169,106,0.12)',
        fill: true
      }, {
        label: '_future',
        data: future,
        borderColor: 'rgba(39,169,106,0.35)',
        backgroundColor: 'transparent',
        borderDash: [5, 4],
        fill: false
      }]
    },
    options: {
      responsive: true,
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: { display: true, labels: { filter: item => !item.text.startsWith('_') } },
        tooltip: {
          enabled: true,
          filter: item => item.raw != null && !item.dataset.label.startsWith('_'),
          callbacks: { label: ctx => ctx.raw != null ? ctx.dataset.label + ': ' + EUR(ctx.raw) : null }
        }
      },
      elements: { point: { radius: 0, hoverRadius: 6, hitRadius: 8 } },
      scales: {
        x: { title: { display: true, text: t.summary.chartMonth } },
        y: { title: { display: true, text: t.prepayment.chartSaved } }
      }
    }
  });
}

function renderCustos() {
  const el = document.getElementById('custos-list');
  const t = i18n[lang] || i18n.pt;
  if (!el) return;
  if (!extraCosts.length) { el.innerHTML = `<div class="empty">${t.costs.noCosts}</div>`; updateCostsSummary(); return; }
  el.innerHTML = extraCosts.map((c, i) => {
    let displayValue, displayUnit, barWidth;
    let freqLabel = c.frequency === 'annual' ? t.costs.annual : c.frequency === 'oneTime' ? t.costs.oneTime : t.costs.monthly;
    if (c.frequency === 'oneTime') {
      displayValue = EUR(c.amount);
      displayUnit = '';
      barWidth = Math.min(c.amount / 300 * 100, 100);
    } else {
      const monthly = c.frequency === 'annual' ? c.amount / 12 : c.amount;
      displayValue = EUR(monthly);
      displayUnit = `<div style="font-size:.6rem;color:var(--steel);text-align:right">${t.costs.perMonth}</div>`;
      barWidth = Math.min(monthly / 300 * 100, 100);
    }
    const endStr = c.frequency === 'oneTime' ? '' : c.endMonth ? ` → ${t.costs.fromMonth} ${c.endMonth}` : ` (${t.costs.noEndMonth})`;
    const dateStr = c.frequency === 'oneTime' ? `${t.costs.fromMonth} ${c.startMonth}` : `${t.costs.fromMonth} ${c.startMonth}${endStr}`;
    return `<div class="euribor-entry historical" style="border-left-color:var(--amber)">
      <div><div class="entry-period">${Utils.escapeHtml(c.name)}</div><div style="font-size:.68rem;color:var(--steel)">${dateStr} · ${freqLabel}</div></div>
      <div class="entry-bar-wrap"><div class="entry-bar" style="width:${barWidth}%;background:var(--amber)"></div></div>
      <div class="entry-rate" style="color:var(--amber);white-space:nowrap">${displayValue}${displayUnit}</div>
      <div style="display:flex;gap:4px;align-items:center">
        <span class="chip chip-base">${t.costs.tag}</span>
        <button class="btn btn-ghost btn-sm" onclick="editCusto(${i})" aria-label="${t.form.edit}" title="${t.form.edit}" style="padding:3px 7px;font-size:.65rem">✎</button>
        <button class="btn btn-danger btn-sm" onclick="removeCusto(${i})" style="padding:3px 7px;font-size:.65rem">✕</button>
      </div>
    </div>`;
  }).join('');
  updateCostsSummary();
}

function updateCostsSummary() {
  const hoje = cfgI('cfg-hoje');
  const totalMonths = cfgI('cfg-prazo') * 12;
  let monthlyNow = 0, totalPaid = 0, totalProjected = 0;
  for (const c of extraCosts) {
    if (c.frequency === 'oneTime') {
      if (c.startMonth <= hoje) totalPaid += c.amount;
      totalProjected += c.amount;
    } else {
      const monthly = c.frequency === 'annual' ? c.amount / 12 : c.amount;
      const end = c.endMonth || totalMonths;
      const paidMonths = Math.max(0, Math.min(hoje, end) - c.startMonth + 1);
      totalPaid += monthly * paidMonths;
      const projMonths = Math.max(0, end - c.startMonth + 1);
      totalProjected += monthly * projMonths;
      if (c.startMonth <= hoje && (!c.endMonth || c.endMonth >= hoje)) monthlyNow += monthly;
    }
  }
  const setEl = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  setEl('c-monthly-total', EUR(monthlyNow));
  setEl('c-paid-total', EUR(totalPaid));
  setEl('c-projected-total', EUR(totalProjected));
}

function addCusto() {
  const name = document.getElementById('c-nome').value.trim();
  const amount = parseFloat(document.getElementById('c-valor').value);
  const frequency = document.getElementById('c-freq').value;
  const startMonth = parseInt(document.getElementById('c-inicio').value) || 1;
  const endMonthVal = document.getElementById('c-fim').value;
  const endMonth = endMonthVal ? parseInt(endMonthVal) : null;
  const t = i18n[lang] || i18n.pt;
  const errEl = document.getElementById('c-error');
  if (!name || isNaN(amount) || amount <= 0) { if (errEl) { errEl.textContent = t.messages.fillCost; errEl.style.display = 'block'; } return; }
  if (errEl) errEl.style.display = 'none';
  const entry = { name, amount, frequency, startMonth, endMonth };
  if (editCustoIndex !== null) extraCosts[editCustoIndex] = entry;
  else extraCosts.push(entry);
  extraCosts.sort((a, b) => a.startMonth - b.startMonth);
  toggleCustosForm();
  recalc();
}

function editCusto(i) {
  const c = extraCosts[i];
  document.getElementById('c-nome').value = c.name;
  document.getElementById('c-valor').value = c.amount;
  document.getElementById('c-freq').value = c.frequency;
  document.getElementById('c-inicio').value = c.startMonth;
  document.getElementById('c-fim').value = c.endMonth ?? '';
  editCustoIndex = i;
  const el = document.getElementById('custos-form');
  if (el) el.style.display = 'block';
}

function removeCusto(i) {
  const t = i18n[lang] || i18n.pt;
  const [removed] = extraCosts.splice(i, 1);
  if (editCustoIndex === i) toggleCustosForm();
  else if (editCustoIndex !== null && editCustoIndex > i) editCustoIndex--;
  recalc();
  showUndoToast(t.messages.undoCusto.replace('{name}', removed.name), () => {
    extraCosts.splice(i, 0, removed);
    recalc();
  });
}
function toggleCustosForm() {
  const el = document.getElementById('custos-form');
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
  editCustoIndex = null;
  document.getElementById('c-nome').value = '';
  document.getElementById('c-valor').value = '';
  document.getElementById('c-freq').value = 'monthly';
  document.getElementById('c-inicio').value = '1';
  document.getElementById('c-fim').value = '';
}

function addAbateHist() {
  const mes = parseInt(document.getElementById('ab-hist-mes').value);
  const val = parseFloat(document.getElementById('ab-hist-val').value);
  const option = document.getElementById('ab-hist-op').value;
  const penalRate = parseFloat(document.getElementById('ab-hist-penal')?.value ?? defaultPenaltyRateFor(mes)) || 0;
  const desc = document.getElementById('ab-hist-desc').value.trim();
  const t = i18n[lang] || i18n.pt;
  const errEl = document.getElementById('ab-hist-error');
  if (!mes || isNaN(val) || val <= 0) { if (errEl) { errEl.textContent = t.messages.fillPrepay; errEl.style.display = 'block'; } return; }
  if (errEl) errEl.style.display = 'none';
  const entry = { month: mes, amount: val, option, penalRate, desc: desc || `${t.prepayment.tag} ${t.table.month} ${mes}` };
  if (editAbateIndex !== null) prepaymentsHistory[editAbateIndex] = entry;
  else prepaymentsHistory.push(entry);
  prepaymentsHistory.sort((a, b) => a.month - b.month);
  toggleAbateForm();
  recalc();
}

function editAbate(i) {
  const a = prepaymentsHistory[i];
  document.getElementById('ab-hist-mes').value = a.month;
  document.getElementById('ab-hist-val').value = a.amount;
  document.getElementById('ab-hist-op').value = a.option;
  const penalEl = document.getElementById('ab-hist-penal'); if (penalEl) penalEl.value = a.penalRate ?? defaultPenaltyRateFor(a.month);
  document.getElementById('ab-hist-desc').value = a.desc || '';
  editAbateIndex = i;
  const el = document.getElementById('abate-form');
  if (el) el.style.display = 'block';
}

function removeAbate(i) {
  const t = i18n[lang] || i18n.pt;
  const [removed] = prepaymentsHistory.splice(i, 1);
  if (editAbateIndex === i) toggleAbateForm();
  else if (editAbateIndex !== null && editAbateIndex > i) editAbateIndex--;
  recalc();
  showUndoToast(t.messages.undoAbate.replace('{month}', removed.month), () => {
    prepaymentsHistory.push(removed);
    prepaymentsHistory.sort((a, b) => a.month - b.month);
    recalc();
  });
}
function toggleAbateForm() {
  const el = document.getElementById('abate-form');
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
  editAbateIndex = null;
  document.getElementById('ab-hist-mes').value = '';
  document.getElementById('ab-hist-val').value = '';
  document.getElementById('ab-hist-op').value = 'payment';
  const penalEl = document.getElementById('ab-hist-penal'); if (penalEl) penalEl.value = CONFIG.PREPAYMENT_PENALTY.VARIABLE_RATE * 100;
  document.getElementById('ab-hist-desc').value = '';
}

const BDP_EURIBOR_URL = 'https://bpstat.bportugal.pt/data/v1/domains/22/datasets/2829cb9155cb4f6ba6906db6b204c4bc/?lang=PT&series_ids=13168436,13168438,13168437&decimal=true';

function updateEuriborImportDateLabel() {
  const el = document.getElementById('euribor-import-month');
  const label = document.getElementById('euribor-import-month-label');
  if (!el || !label) return;
  if (!el.value) { label.textContent = '--/--/----'; return; }
  const [y, m, d] = el.value.split('-');
  label.textContent = `${d}/${m}/${y}`;
}

async function importarEuriborBdP() {
  const t = i18n[lang] || i18n.pt;
  const btn = document.getElementById('btn-import-euribor');
  const msgEl = document.getElementById('euribor-import-msg');
  const showMsg = (cls, text) => { if (msgEl) { msgEl.className = cls; msgEl.textContent = text; msgEl.style.display = 'block'; } };

  if (!hasStartDate()) { showMsg('warn', t.euribor.importNoStartDate); return; }

  const startDate = getStartDate();
  const originalLabel = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = t.euribor.importing; }
  if (msgEl) msgEl.style.display = 'none';

  try {
    const res = await fetch(BDP_EURIBOR_URL);
    if (!res.ok) throw new Error('http-' + res.status);
    const data = await res.json();
    const dates = data.dimension.reference_date.category.index;
    const n = dates.length;
    const values = data.value;
    const monthInput = document.getElementById('euribor-import-month');
    const requestedYM = monthInput ? monthInput.value.slice(0, 7) : '';
    const idx = requestedYM ? dates.findIndex(d => d.startsWith(requestedYM)) : n - 1;
    if (idx === -1) throw new Error('month-not-found');
    const r3 = Math.round(values[idx] * 1000) / 1000;
    const r6 = Math.round(values[n + idx] * 1000) / 1000;
    const r12 = Math.round(values[2 * n + idx] * 1000) / 1000;
    const [Y, M] = dates[idx].split('-').map(Number);

    // BdP reports the Euribor average for a calendar month, but banks only
    // start applying it 2 months later (publication + revision lag).
    const EURIBOR_APPLY_LAG_MONTHS = 2;
    const y = startDate.getFullYear(), m = startDate.getMonth() + 1;
    const loanMonth = (Y - y) * 12 + (M - m) + 1 + EURIBOR_APPLY_LAG_MONTHS;
    if (loanMonth < 1) throw new Error('before-start');

    const dateLabel = String(M).padStart(2, '0') + '/' + Y;
    euriborHistory = euriborHistory.filter(h => h.startMonth !== loanMonth);
    euriborHistory.push({ startMonth: loanMonth, rates: { 3: r3, 6: r6, 12: r12 }, desc: t.euribor.importedDesc.replace('{date}', dateLabel) });
    euriborHistory.sort((a, b) => a.startMonth - b.startMonth);
    recalc();
    showMsg('info', t.euribor.importSuccess.replace('{month}', loanMonth).replace('{date}', dateLabel));
  } catch (err) {
    showMsg('warn', err.message === 'month-not-found' ? t.euribor.importMonthNotFound : t.euribor.importError);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = originalLabel; }
  }
}

function addHist() {
  const mes = parseInt(document.getElementById('ah-mes').value);
  const eu = parseFloat(document.getElementById('ah-eu').value);
  const desc = document.getElementById('ah-desc').value.trim();
  const t = i18n[lang] || i18n.pt;
  const errEl = document.getElementById('ah-error');
  if (!mes || isNaN(eu)) { if (errEl) { errEl.textContent = t.messages.fillEuribor; errEl.style.display = 'block'; } return; }
  if (errEl) errEl.style.display = 'none';
  const existing = editHistIndex !== null ? euriborHistory[editHistIndex] : null;
  if (editHistIndex !== null) euriborHistory.splice(editHistIndex, 1);
  euriborHistory = euriborHistory.filter(h => h.startMonth !== mes);
  const rates = { ...(existing && existing.rates) };
  rates[euriborTenor] = eu;
  euriborHistory.push({ startMonth: mes, rates, desc: desc || `${t.euribor.history} ${t.table.month} ${mes}` });
  euriborHistory.sort((a, b) => a.startMonth - b.startMonth);
  toggleForm(); recalc();
}

function editHist(i) {
  const h = euriborHistory[i];
  const rate = (h.rates && h.rates[euriborTenor]) ?? h.rate ?? '';
  document.getElementById('ah-mes').value = h.startMonth;
  document.getElementById('ah-eu').value = rate;
  document.getElementById('ah-desc').value = h.desc || '';
  editHistIndex = i;
  const el = document.getElementById('add-form');
  if (el) el.style.display = 'block';
}

function removeHist(i) {
  const t = i18n[lang] || i18n.pt;
  const [removed] = euriborHistory.splice(i, 1);
  if (editHistIndex === i) toggleForm();
  else if (editHistIndex !== null && editHistIndex > i) editHistIndex--;
  recalc();
  showUndoToast(t.messages.undoEuribor.replace('{month}', removed.startMonth), () => {
    euriborHistory.push(removed);
    euriborHistory.sort((a, b) => a.startMonth - b.startMonth);
    recalc();
  });
}
function toggleForm() {
  const el = document.getElementById('add-form');
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
  editHistIndex = null;
  document.getElementById('ah-mes').value = '';
  document.getElementById('ah-eu').value = '';
  document.getElementById('ah-desc').value = '';
}

function currentTheme() {
  const stored = localStorage.getItem('theme');
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function updateThemeToggleIcon() {
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = currentTheme() === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', next);
  document.documentElement.dataset.theme = next;
  updateThemeToggleIcon();
}

function initTheme() {
  const stored = localStorage.getItem('theme');
  if (stored) document.documentElement.dataset.theme = stored;
  updateThemeToggleIcon();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!localStorage.getItem('theme')) updateThemeToggleIcon();
  });
}

function toggleLang() {
  lang = lang === 'pt' ? 'en' : 'pt';
  localStorage.setItem('lang', lang);
  const toggle = document.getElementById('lang-toggle');
  if (toggle) toggle.textContent = lang.toUpperCase();
  updateLang();
}

function updateLang() {
  initStartDateSelects();
  const t = i18n[lang];
  if (!t) return;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const value = key.split('.').reduce((acc, part) => acc && acc[part], t);
    if (value) el.textContent = value;
  });

  const tab = i18n[lang].tabs;
  document.documentElement.lang = lang;
  document.getElementById('tab-resumo').textContent = tab.resumo;
  document.getElementById('tab-euribor').textContent = tab.euribor;
  document.getElementById('tab-tabela').textContent = tab.tabela;
  document.getElementById('tab-abates').textContent = tab.abates;
  document.getElementById('tab-custos').textContent = tab.custos || 'Custos';
  document.getElementById('tab-config').textContent = tab.config;
  document.getElementById('tab-ajuda').textContent = tab.ajuda || 'Ajuda';

  const msg = t.messages || {};
  const setAttr = (id, attr, value) => {
    const el = document.getElementById(id);
    if (el && value) el.setAttribute(attr, value);
  };
  setAttr('lang-toggle', 'aria-label', msg.toggleLang);
  setAttr('theme-toggle', 'aria-label', msg.toggleTheme);
  setAttr('btn-add-euribor', 'aria-label', msg.addEuribor);
  setAttr('loan-select', 'aria-label', t.loans.label);
  setAttr('btn-loan-rename', 'aria-label', t.loans.renameTitle);
  setAttr('btn-loan-rename', 'title', t.loans.renameTitle);
  setAttr('btn-loan-duplicate', 'aria-label', t.loans.duplicateTitle);
  setAttr('btn-loan-duplicate', 'title', t.loans.duplicateTitle);
  setAttr('btn-loan-delete', 'aria-label', t.loans.deleteTitle);
  setAttr('btn-loan-delete', 'title', t.loans.deleteTitle);
  setAttr('btn-export-data', 'aria-label', msg.exportData);
  setAttr('btn-import-data', 'aria-label', msg.importData);
  setAttr('btn-clear-data', 'aria-label', msg.clearData);

  const setScenarioAria = (selector, text) => {
    const el = document.querySelector(selector);
    if (el && text) el.setAttribute('aria-label', text);
  };
  setScenarioAria('.scenario-tab.sc-opt', t.euribor.scenarioOpt);
  setScenarioAria('.scenario-tab.sc-base', t.euribor.scenarioBase);
  setScenarioAria('.scenario-tab.sc-pess', t.euribor.scenarioPess);
  renderNotifStatus();
}
function setEuriborTenor(tenor, el) {
  euriborTenor = tenor;
  document.querySelectorAll('.euribor-tenor-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
  if (el) { el.classList.add('active'); el.setAttribute('aria-pressed', 'true'); }
  const t = i18n[lang] || i18n.pt;
  document.getElementById('ah-eu-label').textContent = t.euribor.tenorLabel.replace('{tenor}', tenor);
  updateScenarioInputs();
  recalc();
}

function setTlSc(sc, el) { tlSc = sc; document.querySelectorAll('#panel-euribor .card:last-child .scenario-tab').forEach(t => t.classList.remove('active')); el.classList.add('active'); renderTl(); }
function setTblSc(sc, el) { tblSc = sc; document.querySelectorAll('#panel-tabela .scenario-tab').forEach(t => t.classList.remove('active')); el.classList.add('active'); renderTbl(true); }
function loadMore() { tblRows += CONFIG.TABLE.PAGE_SIZE; renderTbl(false); }

function showTab(id, el) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
  document.getElementById('panel-' + id).classList.add('active'); el.classList.add('active'); el.setAttribute('aria-selected', 'true');
  if (id === 'tabela') renderTbl(true);
  if (id === 'abates') calcAbate();
  if (id === 'agregado') renderAgregado();
  if (id === 'comparador') calcComparador();
}

function exportarDados() {
  syncActiveLoanIntoArray();
  const dados = {
    version: 2,
    appVersion: CONFIG.APP_VERSION,
    exportedAt: new Date().toISOString(),
    activeLoanId,
    loans
  };
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'credito_habitacao_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click(); URL.revokeObjectURL(a.href);
  markBackupDone();
}

function exportarPlanoCSV() {
  const t = i18n[lang] || i18n.pt;
  const rows = buildSched(tblSc);
  const locale = lang === 'en' ? 'en-GB' : 'pt-PT';
  const header = [t.table.month, t.table.date, t.table.payment, t.table.interest, t.table.amort, t.table.capital, t.table.euribor].join(',');
  const lines = rows.map(r => {
    const eu = r.isF ? cfg('cfg-fixa') : r.eu;
    return [
      r.mes,
      r.date.toLocaleDateString(locale, { month: 'short', year: 'numeric' }),
      r.pmt.toFixed(2),
      r.jur.toFixed(2),
      r.amort.toFixed(2),
      r.bal.toFixed(2),
      eu != null ? eu.toFixed(3) : ''
    ].join(',');
  });
  const csv = '﻿' + [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'plano_amortizacao_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click(); URL.revokeObjectURL(a.href);
  markBackupDone();
}

function applyStateData(d) {
  document.getElementById('cfg-capital').value = d.contract.capital;
  document.getElementById('cfg-prazo').value = d.contract.termYears;
  document.getElementById('cfg-fixos').value = d.contract.fixedMonths;
  document.getElementById('cfg-fixa').value = d.contract.fixedRate;
  document.getElementById('cfg-spread').value = d.contract.spread;
  document.getElementById('cfg-hoje').value = d.contract.currentMonth;
  const mesEl = document.getElementById('cfg-inicio-mes');
  if (mesEl) mesEl.value = d.contract.startMes || '';
  const anoEl = document.getElementById('cfg-inicio-ano');
  if (anoEl) anoEl.value = d.contract.startAno || '';
  const diaEl = document.getElementById('cfg-dia-pagamento');
  if (diaEl) diaEl.value = d.contract.paymentDay || 1;
  syncHojeFromStartDate();
  euriborHistory = d.euriborHistory || [];
  euriborTenor = typeof d.euriborTenor === 'number' ? d.euriborTenor : 3;
  prepaymentsHistory = d.prepaymentsHistory || [];
  extraCosts = d.extraCosts || [];
  if (d.scenarios) {
    scenarioRates.opt = d.scenarios.optimistic || scenarioRates.opt;
    scenarioRates.base = d.scenarios.base || scenarioRates.base;
    scenarioRates.pess = d.scenarios.pessimistic || scenarioRates.pess;
  }
}

function afterLoanSwitch() {
  updateScenarioInputs();
  syncEuriborTenorButtons();
  resetScenarioTabs();
  checkEuriborReviewReminder();
}

function importarDados(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const msg = document.getElementById('import-msg');
    const t = i18n[lang] || i18n.pt;
    try {
      const d = JSON.parse(ev.target.result);
      const parsed = parseLoansPayload(d, t.loans.importedName);
      if (!parsed) throw new Error('Ficheiro inválido');
      if (parsed.isLegacyFormat) {
        // A legacy single-loan backup is added alongside whatever loans
        // already exist, rather than replacing them.
        syncActiveLoanIntoArray();
        loans.push(parsed.loans[0]);
        activeLoanId = parsed.activeLoanId;
        applyStateData(parsed.loans[0]);
      } else {
        loans = parsed.loans;
        activeLoanId = parsed.activeLoanId;
        applyStateData(loans.find(l => l.id === activeLoanId));
      }
      afterLoanSwitch();
      renderLoanSelector();
      recalc();
      msg.style.display = 'block'; msg.className = 'info';
      if (parsed.isLegacyFormat) {
        msg.textContent = t.messages.importedAsNew;
      } else {
        const dateText = d.exportedAt ? new Date(d.exportedAt).toLocaleString(lang === 'en' ? 'en-GB' : 'pt-PT') : '—';
        msg.textContent = t.messages.imported.replace('{date}', dateText);
      }
    } catch (err) {
      msg.style.display = 'block'; msg.className = 'warn';
      msg.textContent = t.messages.importError.replace('{error}', err.message);
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

// ── LOANS (multi-crédito) ──────────────────────────────
function genId() { return 'loan_' + Date.now().toString(36) + Utils.generateId(); }

function captureContractData() {
  return {
    contract: {
      capital: cfg('cfg-capital'),
      termYears: cfgI('cfg-prazo'),
      fixedMonths: cfgI('cfg-fixos'),
      fixedRate: cfg('cfg-fixa'),
      spread: cfg('cfg-spread'),
      currentMonth: cfgI('cfg-hoje'),
      startMes: parseInt(document.getElementById('cfg-inicio-mes')?.value || '0') || 0,
      startAno: parseInt(document.getElementById('cfg-inicio-ano')?.value || '0') || 0,
      paymentDay: cfgI('cfg-dia-pagamento') || 1
    },
    euriborTenor,
    euriborHistory,
    prepaymentsHistory,
    extraCosts,
    scenarios: { optimistic: scenarioRates.opt, base: scenarioRates.base, pessimistic: scenarioRates.pess }
  };
}

function defaultLoanTemplate(name) {
  return {
    id: genId(),
    name,
    contract: { capital: 150000, termYears: 30, fixedMonths: 24, fixedRate: 3.00, spread: 0.90, currentMonth: 0, startMes: 0, startAno: 0, paymentDay: 1 },
    euriborTenor: 3,
    euriborHistory: [],
    prepaymentsHistory: [],
    extraCosts: [],
    scenarios: { optimistic: { 3: 1.50, 6: 1.70, 12: 2.00 }, base: { 3: 2.50, 6: 2.70, 12: 3.00 }, pessimistic: { 3: 4.00, 6: 4.20, 12: 4.50 } }
  };
}

function syncActiveLoanIntoArray() {
  if (!activeLoanId) return;
  const idx = loans.findIndex(l => l.id === activeLoanId);
  if (idx === -1) return;
  loans[idx] = { id: activeLoanId, name: loans[idx].name, ...captureContractData() };
}

function syncEuriborTenorButtons() {
  document.querySelectorAll('.euribor-tenor-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
  const activeBtn = document.querySelector(`.euribor-tenor-btn[data-tenor="${euriborTenor}"]`);
  if (activeBtn) { activeBtn.classList.add('active'); activeBtn.setAttribute('aria-pressed', 'true'); }
}

function resetScenarioTabs() {
  tlSc = 'base'; tblSc = 'base'; abatesImpactSc = 'base'; tblRows = CONFIG.TABLE.INITIAL_ROWS;
  ['#panel-euribor .card:last-child', '#panel-tabela', '#abates-impact-sc'].forEach(sel => {
    document.querySelectorAll(sel + ' .scenario-tab').forEach(t => t.classList.remove('active'));
    const baseBtn = document.querySelector(sel + ' .scenario-tab.sc-base');
    if (baseBtn) baseBtn.classList.add('active');
  });
}

function renderLoanSelector() {
  const sel = document.getElementById('loan-select');
  if (!sel) return;
  sel.innerHTML = '';
  loans.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.id; opt.textContent = l.name;
    if (l.id === activeLoanId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function switchLoan(id) {
  if (id === activeLoanId) return;
  syncActiveLoanIntoArray();
  const loan = loans.find(l => l.id === id);
  if (!loan) return;
  activeLoanId = id;
  applyStateData(loan);
  afterLoanSwitch();
  recalc();
  renderLoanSelector();
}

async function createLoan() {
  const t = i18n[lang] || i18n.pt;
  const name = await openModal({ title: t.loans.namePrompt, inputValue: t.loans.newDefaultName, showInput: true });
  if (name === null) return;
  syncActiveLoanIntoArray();
  const loan = defaultLoanTemplate(name.trim() || t.loans.newDefaultName);
  loans.push(loan);
  activeLoanId = loan.id;
  applyStateData(loan);
  afterLoanSwitch();
  recalc();
  renderLoanSelector();
}

function duplicateLoan() {
  syncActiveLoanIntoArray();
  const current = loans.find(l => l.id === activeLoanId);
  if (!current) return;
  const t = i18n[lang] || i18n.pt;
  const clone = JSON.parse(JSON.stringify(current));
  clone.id = genId();
  clone.name = current.name + ' ' + t.loans.copySuffix;
  loans.push(clone);
  activeLoanId = clone.id;
  applyStateData(clone);
  afterLoanSwitch();
  recalc();
  renderLoanSelector();
}

async function renameLoan() {
  const loan = loans.find(l => l.id === activeLoanId);
  if (!loan) return;
  const t = i18n[lang] || i18n.pt;
  const name = await openModal({ title: t.loans.namePrompt, inputValue: loan.name, showInput: true });
  if (name === null || !name.trim()) return;
  loan.name = name.trim();
  renderLoanSelector();
  saveToStorage();
}

async function deleteLoan() {
  const t = i18n[lang] || i18n.pt;
  if (loans.length <= 1) { showInfoToast(t.loans.cannotDeleteLast); return; }
  const confirmed = await openModal({ title: t.loans.deleteTitle, message: t.loans.confirmDelete, confirmLabel: t.form.delete, danger: true });
  if (!confirmed) return;
  const idx = loans.findIndex(l => l.id === activeLoanId);
  loans.splice(idx, 1);
  const next = loans[Math.max(0, idx - 1)] || loans[0];
  activeLoanId = next.id;
  applyStateData(next);
  afterLoanSwitch();
  recalc();
  renderLoanSelector();
}

// ── LOCAL STORAGE ──────────────────────────────────────
const LS_KEY = CONFIG.LS_KEY;

function updateScenarioInputs() {
  document.getElementById('sc-opt').value = scenarioRates.opt[euriborTenor];
  document.getElementById('sc-base').value = scenarioRates.base[euriborTenor];
  document.getElementById('sc-pess').value = scenarioRates.pess[euriborTenor];
}

function setScenarioRate(scenario, value) {
  if (!scenarioRates[scenario]) return;
  scenarioRates[scenario][euriborTenor] = parseFloat(value) || 0;
  saveToStorage();
  recalc();
}

let storageSaveFailed = false;

function saveToStorage() {
  try {
    syncActiveLoanIntoArray();
    const state = { version: 2, activeLoanId, loans };
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    if (storageSaveFailed) { storageSaveFailed = false; hideStorageSaveWarning(); }
  } catch (e) {
    console.warn('localStorage save failed:', e);
    storageSaveFailed = true;
    showStorageSaveWarning();
  }
}

// Shows once and stays until a save succeeds or the user dismisses it,
// rather than re-popping on every failed attempt (recalc() runs constantly).
function showStorageSaveWarning() {
  const t = i18n[lang] || i18n.pt;
  let el = document.getElementById('storage-save-warn');
  if (!el) {
    el = document.createElement('div');
    el.id = 'storage-save-warn';
    el.className = 'storage-warn-banner';
    document.body.appendChild(el);
  }
  el.innerHTML = `<span>⚠️ ${t.messages.storageSaveFailed}</span><button class="btn btn-ghost btn-sm" id="storage-save-warn-export">${t.messages.storageSaveFailedExport}</button><button class="btn btn-ghost btn-sm" id="storage-save-warn-dismiss" aria-label="${t.form.cancel}">✕</button>`;
  el.classList.add('show');
  document.getElementById('storage-save-warn-export').onclick = () => exportarDados();
  document.getElementById('storage-save-warn-dismiss').onclick = () => el.classList.remove('show');
}

function hideStorageSaveWarning() {
  const el = document.getElementById('storage-save-warn');
  if (el) el.classList.remove('show');
}

// Normalizes either the current multi-loan JSON shape or the legacy
// single-loan one into { loans, activeLoanId }. Doesn't touch the app's
// own `loans` array — callers decide whether to replace or merge it in.
function parseLoansPayload(d, legacyLoanName) {
  if (Array.isArray(d.loans) && d.loans.length) {
    const loans = d.loans;
    const activeLoanId = loans.some(l => l.id === d.activeLoanId) ? d.activeLoanId : loans[0].id;
    return { loans, activeLoanId, isLegacyFormat: false };
  }
  if (d.contract && d.euriborHistory && d.scenarios) {
    const loan = { id: genId(), name: legacyLoanName, contract: d.contract, euriborTenor: d.euriborTenor, euriborHistory: d.euriborHistory, prepaymentsHistory: d.prepaymentsHistory || [], extraCosts: d.extraCosts || [], scenarios: d.scenarios };
    return { loans: [loan], activeLoanId: loan.id, isLegacyFormat: true };
  }
  return null;
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    const t = i18n[lang] || i18n.pt;
    const parsed = parseLoansPayload(d, t.loans.defaultName);
    if (!parsed) return false;
    loans = parsed.loans;
    activeLoanId = parsed.activeLoanId;
    applyStateData(loans.find(l => l.id === activeLoanId));
    return true;
  } catch (e) { console.warn('localStorage load failed:', e); return false; }
}

async function clearStorage() {
  const t = i18n[lang] || i18n.pt;
  const confirmed = await openModal({ title: t.form.removeData, message: t.messages.confirmClear, confirmLabel: t.form.removeData, danger: true });
  if (!confirmed) return;
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem(LAST_EXPORT_KEY);
  location.reload();
}

// ── BACKUP WARNING ──────────────────────────────────────
const LAST_EXPORT_KEY = LS_KEY + '_lastExport';
const BACKUP_WARN_DAYS = 90;

function markBackupDone() {
  try { localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString()); } catch (e) { console.warn('localStorage save failed:', e); }
  renderBackupWarning();
}

function renderBackupWarning() {
  const el = document.getElementById('backup-warn');
  if (!el) return;
  const t = i18n[lang] || i18n.pt;
  const raw = localStorage.getItem(LAST_EXPORT_KEY);
  const lastExport = raw ? new Date(raw) : null;
  const daysSince = lastExport ? (Date.now() - lastExport.getTime()) / 86400000 : Infinity;
  if (daysSince <= BACKUP_WARN_DAYS) { el.style.display = 'none'; return; }
  const msg = lastExport
    ? t.messages.backupWarnSince.replace('{days}', Math.floor(daysSince))
    : t.messages.backupWarnNever;
  el.textContent = '💡 ' + msg;
  el.style.display = 'block';
}

// ── EURIBOR REVIEW REMINDERS ─────────────────────────────
// No server, so this only fires while the app is open — not a background push.
const NOTIF_NOTIFIED_KEY = LS_KEY + '_notifiedReviews';

function renderNotifStatus() {
  const btn = document.getElementById('btn-enable-notif');
  const status = document.getElementById('notif-status');
  if (!btn || !status) return;
  const t = i18n[lang] || i18n.pt;
  if (!('Notification' in window)) {
    btn.style.display = 'none';
    status.textContent = t.notifications.statusUnsupported;
    return;
  }
  if (Notification.permission === 'granted') {
    btn.style.display = 'none';
    status.textContent = t.notifications.statusGranted;
  } else if (Notification.permission === 'denied') {
    btn.style.display = 'none';
    status.textContent = t.notifications.statusDenied;
  } else {
    btn.style.display = 'inline-flex';
    status.textContent = '';
  }
}

async function enableEuriborReminders() {
  if (!('Notification' in window)) return;
  await Notification.requestPermission();
  renderNotifStatus();
  checkEuriborReviewReminder();
}

function getNotifiedReviews() {
  try { return JSON.parse(localStorage.getItem(NOTIF_NOTIFIED_KEY) || '{}'); } catch (e) { return {}; }
}

// Fires one Notification the first time a review is found due, not on
// every check.
function checkEuriborReviewReminder() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const hoje = cfgI('cfg-hoje');
  const lh = euriborHistory[euriborHistory.length - 1];
  const nextReview = lh ? lh.startMonth + euriborTenor : cfgI('cfg-fixos') + 1;
  if (hoje < nextReview) return;
  const notified = getNotifiedReviews();
  if (notified[activeLoanId] === nextReview) return;
  const t = i18n[lang] || i18n.pt;
  const loan = loans.find(l => l.id === activeLoanId);
  try {
    new Notification(t.notifications.notifTitle, {
      body: t.notifications.notifBody.replace('{loan}', loan ? loan.name : '').replace('{month}', nextReview),
      icon: 'icon-192.png'
    });
  } catch (e) { console.warn('Notification failed:', e); }
  notified[activeLoanId] = nextReview;
  try { localStorage.setItem(NOTIF_NOTIFIED_KEY, JSON.stringify(notified)); } catch (e) {}
}

// ── VALIDATION ──────────────────────────────────────────
function validateContract() {
  const el = document.getElementById('cfg-error');
  if (!el) return true;
  const t = i18n[lang] || i18n.pt;
  const capital = cfg('cfg-capital'), prazo = cfgI('cfg-prazo'), fixos = cfgI('cfg-fixos'), hoje = cfgI('cfg-hoje');
  const errors = [];
  if (!(capital > 0)) errors.push(t.messages.errCapital);
  if (!(prazo > 0)) errors.push(t.messages.errPrazo);
  if (fixos < 0 || fixos > prazo * 12) errors.push(t.messages.errFixos);
  if (hoje < 0 || hoje > prazo * 12) errors.push(t.messages.errHoje);
  if (errors.length) {
    el.innerHTML = errors.map(e => `⚠️ ${e}`).join('<br>');
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
  return errors.length === 0;
}

// ── RECALC (saves to storage on every change) ──────────
const recalcDebounced = Utils.debounce(recalc, 250);
function recalc() {
  try {
    validateContract();
    renderResumo();
    renderHist();
    renderTl();
    renderAbatesHist();
    calcAbate();
    renderCustos();
    renderBackupWarning();
    if (document.getElementById('panel-tabela').classList.contains('active')) renderTbl(true);
    if (document.getElementById('panel-agregado').classList.contains('active')) renderAgregado();
  } catch (e) { console.error('recalc render error:', e); }
  finally { saveToStorage(); }
}

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ── INIT ────────────────────────────────────────────────
initTheme();
initStartDateSelects();
const savedLang = localStorage.getItem('lang') || 'pt';
lang = savedLang;
document.getElementById('lang-toggle').textContent = lang.toUpperCase();

const restoredFromStorage = loadFromStorage();
if (!restoredFromStorage) {
  const t0 = i18n[lang] || i18n.pt;
  const defaultLoan = { id: genId(), name: t0.loans.defaultName, ...captureContractData() };
  loans = [defaultLoan];
  activeLoanId = defaultLoan.id;
}
updateScenarioInputs();
syncEuriborTenorButtons();
const t = i18n[lang] || i18n.pt;
document.getElementById('ah-eu-label').textContent = t.euribor.tenorLabel.replace('{tenor}', euriborTenor);
updateLang();
renderLoanSelector();
recalc();
document.getElementById('ab-mes').value = document.getElementById('cfg-hoje').value;
document.getElementById('refi-mes').value = document.getElementById('cfg-hoje').value;
renderCustos();
renderBankOffers();
checkEuriborReviewReminder();

// Show storage status in config panel
(function () {
  const msg = document.getElementById('storage-status');
  if (!msg) return;
  const t = i18n[lang] || i18n.pt;
  if (restoredFromStorage) {
    msg.className = 'info';
    msg.textContent = t.messages.restored;
  } else {
    msg.className = 'info';
    msg.textContent = t.messages.noSaved;
  }
  msg.style.display = 'block';
})();
