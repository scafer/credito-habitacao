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
let tlSc = 'opt', tblSc = 'opt', tblRows = 36;
let capitalChartInstance = null;
let lang = 'pt';

// I18N
const i18n = {
  pt: {
    tabs: { resumo: 'Resumo', euribor: 'Euribor & Cenários', tabela: 'Plano', abates: 'Abates', custos: 'Custos', config: 'Configuração', ajuda: 'Ajuda' },
    brand: { title: 'Crédito Habitação', subtitle: 'Simulador · Histórico · Cenários' },
    summary: { title: 'Situação actual', timeline: 'Evolução do capital', cost: 'Custo total estimado — por cenário', capitalDebt: 'Capital em dívida', currentPayment: 'Prestação actual', interestPaid: 'Juros pagos até hoje', remainingMonths: 'Meses restantes', capitalProgress: 'Capital amortizado', chartCapital: 'Capital em dívida (€)', chartInterest: 'Juros pagos (€)', chartMonth: 'Mês', chartValue: 'Valor (€)', monthsLabel: 'meses', pctAmortized: '% amortizado', totalLabel: 'total', interestLabel: 'em juros', costsLabel: 'custos adicionais', costBreakdown: 'Decomposição (cenário base)', lastRateLabel: 'Última Euribor registada', nextReviewLabel: 'Próxima revisão esperada', none: 'Nenhuma', month: 'mês', fromMonth: 'desde mês' },
    euribor: { history: 'Histórico de revisões (real)', future: 'Cenários futuros (previsão)', timeline: 'Linha do tempo — Euribor aplicada', tenor: 'Euribor tenor:', tenorLabel: 'Euribor {tenor}M (%)', futureInfo: 'Define os três cenários para os períodos futuros ainda sem revisão confirmada.', noHistory: 'Sem revisões. Adiciona a primeira revisão trimestral.', scenarioOpt: '🟢 Cenário Optimista', scenarioBase: '🟡 Cenário Base', scenarioPess: '🔴 Cenário Pessimista', scenarioChartOpt: 'Opt.', scenarioChartBase: 'Base', scenarioChartPess: 'Pess.', fixedRateDesc: 'Taxa fixa contratual', scenarioForecast: 'Cenário {scenario} (previsão)', rateFormula: 'Euribor {eu} + {sp} = {taxa}' },
    table: { title: 'Plano de amortização', legendFixed: '■ Fixa', legendHist: '■ Histórico', legendToday: '■ Hoje', legendSc: '■ Cenário', months: 'Meses', month: 'Mês', date: 'Data', payment: 'Prestação', interest: 'Juros', amort: 'Amortiz.', capital: 'Capital', euribor: 'Euribor', chipToday: 'Hoje', chipFixed: 'Fixa', chipHist: 'Real', chipOpt: 'Opt.', chipBase: 'Base', chipPess: 'Pess.' },
    prepayment: { title: 'Abates realizados', simulator: 'Simular abate antecipado', register: 'Registar abate', creditMonth: 'Mês do crédito em que foi feito', amountAmortized: 'Valor amortizado (€)', optionAfter: 'Opção após abate', penaltyRate: 'Taxa de penalização', penaltyVar: '0,5% (taxa variável)', penaltyFixed: '2% (taxa fixa)', scenarioFuture: 'Cenário Euribor futura', capitalAtPrepay: 'Capital no mês do abate', capitalAfterPay: 'Capital após abate', interestWithout: 'Juros restantes SEM abate', interestWith: 'Juros restantes COM abate', penaltyLabel: 'Penalização ({pct}% do capital amortizado)', warning: '⚠️ Verifique a penalização contratual por abate antecipado — habitualmente <strong>0,5%</strong> em taxa variável ou <strong>2%</strong> em taxa fixa.', savings: '💰 Poupança total em juros', optionTerm: 'Reduzir prazo', optionPayment: 'Reduzir prestação', prepayMonth: 'Mês em que faria o abate', prepayMonthHint: 'Nº do mês do crédito', prepayValue: 'Valor do abate (€)', prepayValueHint: 'Montante a amortizar', newPayment: 'Nova prestação mensal', reductionLabel: 'Redução no prazo', monthsLess: '{n} meses menos', noHistory: 'Sem abates registados.', historyTextTerm: 'Reduziu prazo', historyTextPayment: 'Reduziu prestação', tag: 'Abate', optionChoice: 'Opção escolhida' },
    config: { title: 'Dados do contrato', initialCapital: 'Capital inicial (€)', termYears: 'Prazo total (anos)', fixedMonths: 'Meses taxa fixa', fixedRate: 'Taxa fixa anual (%)', spread: 'Spread (%)', startDate: 'Data de início do crédito', startDateHint: 'Mês e ano da primeira prestação', paymentDay: 'Dia do pagamento', paymentDayHint: 'Dia do mês em que é debitada a prestação', exportImport: 'Exportar / Importar dados', exportInfo: 'Guarda todos os dados (contrato, histórico Euribor e cenários) num ficheiro .json. Importa quando quiseres recuperar tudo.', export: '⬇ Exportar dados', import: '⬆ Importar dados', autoSave: '💾 Gravação automática no browser activa', clear: '🗑 Limpar dados locais', currentMonths: 'Meses decorridos hoje', currentMonthsHint: 'Calculado automaticamente se definires a data de início' },
    about: { title: 'Sobre a Calculadora de Habitação', text: 'Uma ferramenta gratuita e open-source para simular e acompanhar empréstimos à habitação. Permite calcular prestações, juros totais, cenários futuros com diferentes taxas de revisão e simular amortizações antecipadas.', features: 'Funcionalidades principais:', cta: 'Contribuições, sugestões e correções são muito bem-vindas! Abra um issue ou pull request no repositório.', feature1: 'Simulação de plano de pagamentos com taxa fixa e variável', feature2: 'Histórico de revisões de taxa Euribor', feature3: 'Cenários optimista, base e pessimista para previsões', feature4: 'Simulação de amortizações antecipadas', feature5: 'Dados guardados automaticamente no browser', source: 'Código fonte', sourceSub: 'Disponível no GitHub com licença MIT', github: 'Ver no GitHub' },
    costs: { title: 'Custos adicionais', add: '+ Adicionar custo', noCosts: 'Sem custos registados. Adiciona seguros, taxa de manutenção ou outras despesas recorrentes.', name: 'Designação', amount: 'Valor (€)', frequency: 'Frequência', monthly: 'Mensal', annual: 'Anual', startMonth: 'Mês início (crédito)', endMonth: 'Mês fim (opcional)', desc: 'Descrição (opcional)', summary: 'Resumo de custos', monthlyTotal: 'Custo mensal actual', paidToDate: 'Total pago até hoje', projected: 'Total projetado (vida do crédito)', perMonth: '/mês', fromMonth: 'Mês', tag: 'Custo', noEndMonth: 'sem fim definido' },
    guide: { title: 'Guia de utilização', tabs: 'O que faz cada separador', tabResumo: '📊 Resumo — visão geral do crédito: capital em dívida, prestação actual, juros pagos e evolução gráfica do capital.', tabEuribor: '📈 Euribor & Cenários — regista revisões reais da Euribor e define três cenários futuros (optimista, base, pessimista).', tabPlano: '📋 Plano — tabela completa de amortização mês a mês, com destaque para o mês actual.', tabAbates: '💰 Abates — regista abates antecipados realizados e simula o impacto de futuros abates no custo total.', tabCustos: '🧾 Custos — regista despesas recorrentes como seguros de vida, multiriscos e taxas de manutenção.', tabConfig: '⚙️ Configuração — dados do contrato, data de início, exportação e importação de dados.', storage: 'Onde estão os dados', storageText: 'Todos os dados são guardados exclusivamente no teu browser (localStorage). Não são enviados para nenhum servidor. Se limpares o cache ou os dados do browser, os dados são apagados.', storageExport: '💡 Para não perderes os dados, usa a função Exportar em Configuração → Exportar / Importar dados. Guarda o ficheiro .json num local seguro.', exportImport: 'Exportar e importar dados', exportText: 'Em Configuração, clica em ⬇ Exportar dados para guardar tudo num ficheiro JSON. Para restaurar, clica em ⬆ Importar dados e selecciona o ficheiro. Útil para mudar de browser ou fazer backup.', calcTitle: 'Notas sobre os cálculos', calcText: 'O plano usa o método de amortização francês (prestação constante). Em períodos de taxa variável, a prestação é recalculada com base em: Euribor + spread, capital em dívida e meses restantes. Os cenários futuros são estimativas — a taxa real pode diferir.', aboutTitle: 'Sobre o projecto' },
    form: { add: 'Adicionar', save: 'Guardar', cancel: 'Cancelar', removeData: 'Limpar dados locais', startMonth: 'Mês de início (nº do mês do crédito)', euriborFuture: 'Euribor futura (%)', description: 'Descrição (opcional)' },
    messages: { fillPrepay: 'Preenche o mês e o valor do abate.', fillEuribor: 'Preenche o mês e a taxa Euribor.', fillCost: 'Indica pelo menos a designação e o valor.', confirmClear: 'Tens a certeza que queres apagar todos os dados guardados localmente?', imported: '✅ Dados importados com sucesso! Exportado em: {date}', importError: '❌ Erro ao importar: {error}', restored: '✅ Dados restaurados automaticamente da memória do browser.', noSaved: 'ℹ️ Sem dados guardados — a usar valores predefinidos.', toggleLang: 'Mudar idioma', addEuribor: 'Adicionar revisão Euribor', exportData: 'Exportar dados para ficheiro JSON', importData: 'Importar dados de ficheiro JSON', clearData: 'Limpar todos os dados locais' },
  },
  en: {
    tabs: { resumo: 'Summary', euribor: 'Euribor & Scenarios', tabela: 'Plan', abates: 'Prepayments', custos: 'Costs', config: 'Settings', ajuda: 'Guide' },
    brand: { title: 'Mortgage Calculator', subtitle: 'Simulator · History · Scenarios' },
    summary: { title: 'Current situation', timeline: 'Capital evolution', cost: 'Estimated total cost — per scenario', capitalDebt: 'Outstanding capital', currentPayment: 'Current payment', interestPaid: 'Interest paid to date', remainingMonths: 'Remaining months', capitalProgress: 'Capital amortized', chartCapital: 'Outstanding capital (€)', chartInterest: 'Interest paid (€)', chartMonth: 'Month', chartValue: 'Value (€)', monthsLabel: 'months', pctAmortized: '% amortized', totalLabel: 'total', interestLabel: 'interest', costsLabel: 'additional costs', costBreakdown: 'Breakdown (base scenario)', lastRateLabel: 'Last recorded Euribor', nextReviewLabel: 'Next expected review', none: 'None', month: 'month', fromMonth: 'since month' },
    euribor: { history: 'History of revisions (actual)', future: 'Future scenarios (forecast)', timeline: 'Timeline — Applied Euribor', tenor: 'Euribor tenor:', tenorLabel: 'Euribor {tenor}M (%)', futureInfo: 'Set the three scenarios for future periods without confirmed review yet.', noHistory: 'No revisions. Add the first quarterly revision.', scenarioOpt: '🟢 Optimistic Scenario', scenarioBase: '🟡 Base Scenario', scenarioPess: '🔴 Pessimistic Scenario', scenarioChartOpt: 'Opt.', scenarioChartBase: 'Base', scenarioChartPess: 'Pess.', fixedRateDesc: 'Contracted fixed rate', scenarioForecast: 'Scenario {scenario} (forecast)', rateFormula: 'Euribor {eu} + {sp} = {taxa}' },
    table: { title: 'Amortization plan', legendFixed: '■ Fixed', legendHist: '■ Historical', legendToday: '■ Today', legendSc: '■ Scenario', months: 'Months', month: 'Month', date: 'Date', payment: 'Payment', interest: 'Interest', amort: 'Amort.', capital: 'Capital', euribor: 'Euribor', chipToday: 'Today', chipFixed: 'Fixed', chipHist: 'Historical', chipOpt: 'Opt.', chipBase: 'Base', chipPess: 'Pess.' },
    prepayment: { title: 'Recorded prepayments', simulator: 'Simulate early prepayment', register: 'Register prepayment', creditMonth: 'Credit month when made', amountAmortized: 'Amortized amount (€)', optionAfter: 'Option after prepayment', penaltyRate: 'Penalty rate', penaltyVar: '0.5% (variable rate)', penaltyFixed: '2% (fixed rate)', scenarioFuture: 'Future Euribor scenario', capitalAtPrepay: 'Capital at prepayment month', capitalAfterPay: 'Capital after prepayment', interestWithout: 'Interest remaining WITHOUT prepayment', interestWith: 'Interest remaining WITH prepayment', penaltyLabel: 'Penalty ({pct}% of amortized capital)', warning: '⚠️ Check contractual penalty for early prepayment — usually <strong>0.5%</strong> for variable rate or <strong>2%</strong> for fixed rate.', savings: '💰 Total interest savings', optionTerm: 'Reduce term', optionPayment: 'Reduce payment', prepayMonth: 'Month for prepayment', prepayMonthHint: 'Credit month number', prepayValue: 'Prepayment amount (€)', prepayValueHint: 'Amount to amortize', newPayment: 'New monthly payment', reductionLabel: 'Term reduction', monthsLess: '{n} months less', noHistory: 'No recorded prepayments.', historyTextTerm: 'Term reduced', historyTextPayment: 'Payment reduced', tag: 'Prepayment', optionChoice: 'Chosen option' },
    config: { title: 'Contract data', initialCapital: 'Initial capital (€)', termYears: 'Total term (years)', fixedMonths: 'Fixed months', fixedRate: 'Annual fixed rate (%)', spread: 'Spread (%)', startDate: 'Credit start date', startDateHint: 'Month and year of first payment', paymentDay: 'Payment day', paymentDayHint: 'Day of the month the payment is debited', exportImport: 'Export / Import data', exportInfo: 'Save all data (contract, Euribor history and scenarios) in a .json file. Import anytime to restore it.', export: '⬇ Export data', import: '⬆ Import data', autoSave: '💾 Auto save on browser active', clear: '🗑 Clear local data', currentMonths: 'Months elapsed today', currentMonthsHint: 'Auto-calculated if you set a start date' },
    about: { title: 'About Mortgage Calculator', text: 'A free and open-source tool to simulate and track mortgage loans. It calculates installments, total interest, future scenarios with different interest rate revisions and simulates early amortizations.', features: 'Main features:', cta: 'Contributions, suggestions and fixes are welcome! Open an issue or pull request in the repository.', feature1: 'Amortization plan simulation with fixed and variable rates', feature2: 'Interest rate revision history', feature3: 'Optimistic, base and pessimistic scenarios for forecasts', feature4: 'Early amortization simulation', feature5: 'Data autosaved in browser', source: 'Source code', sourceSub: 'Available on GitHub under MIT license', github: 'See on GitHub' },
    costs: { title: 'Additional costs', add: '+ Add cost', noCosts: 'No costs registered. Add insurance, maintenance fees or other recurring expenses.', name: 'Name', amount: 'Amount (€)', frequency: 'Frequency', monthly: 'Monthly', annual: 'Annual', startMonth: 'Start month (credit)', endMonth: 'End month (optional)', desc: 'Description (optional)', summary: 'Cost summary', monthlyTotal: 'Current monthly cost', paidToDate: 'Total paid to date', projected: 'Total projected (loan life)', perMonth: '/month', fromMonth: 'Month', tag: 'Cost', noEndMonth: 'no end defined' },
    guide: { title: 'User guide', tabs: 'What each tab does', tabResumo: '📊 Summary — loan overview: outstanding capital, current payment, interest paid and capital chart.', tabEuribor: '📈 Euribor & Scenarios — record real Euribor revisions and set three future scenarios (optimistic, base, pessimistic).', tabPlano: '📋 Plan — full month-by-month amortization table highlighting the current month.', tabAbates: '💰 Prepayments — record made prepayments and simulate the impact of future ones on total cost.', tabCustos: '🧾 Costs — record recurring expenses like life insurance, home insurance and maintenance fees.', tabConfig: '⚙️ Settings — contract data, start date, export and import.', storage: 'Where your data is stored', storageText: 'All data is stored exclusively in your browser (localStorage). Nothing is sent to any server. Clearing your browser cache or data will erase everything.', storageExport: '💡 To avoid losing data, use the Export function in Settings → Export / Import data. Save the .json file somewhere safe.', exportImport: 'Exporting and importing data', exportText: 'In Settings, click ⬇ Export data to save everything in a JSON file. To restore, click ⬆ Import data and select the file. Useful for changing browsers or making backups.', calcTitle: 'Notes on calculations', calcText: 'The plan uses the French amortization method (constant payment). In variable rate periods, the payment is recalculated based on: Euribor + spread, outstanding capital and remaining months. Future scenarios are estimates — actual rates may differ.', aboutTitle: 'About the project' },
    form: { add: 'Add', save: 'Save', cancel: 'Cancel', removeData: 'Clear local data', startMonth: 'Start month (credit month number)', euriborFuture: 'Euribor future (%)', description: 'Description (optional)' },
    messages: { fillPrepay: 'Fill in the month and prepayment amount.', fillEuribor: 'Fill in the month and Euribor rate.', fillCost: 'Please enter at least a name and amount.', confirmClear: 'Are you sure you want to delete all locally stored data?', imported: '✅ Data imported successfully! Exported on: {date}', importError: '❌ Error importing: {error}', restored: '✅ Data automatically restored from browser memory.', noSaved: 'ℹ️ No saved data — using defaults.', toggleLang: 'Switch language', addEuribor: 'Add Euribor revision', exportData: 'Export data to JSON file', importData: 'Import data from JSON file', clearData: 'Clear all local data' }
  }
};

// HELPERS
const EUR = n => n == null ? '—' : n.toLocaleString(lang === 'en' ? 'en-GB' : 'pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const PCT = n => n.toFixed(3) + '%';
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

function calcMonthsElapsed() {
  const m = parseInt(document.getElementById('cfg-inicio-mes')?.value || '0');
  const y = parseInt(document.getElementById('cfg-inicio-ano')?.value || '0');
  const hojeEl = document.getElementById('cfg-hoje');
  if (!m || !y) {
    if (hojeEl) { hojeEl.removeAttribute('readonly'); hojeEl.style.color = ''; }
    return;
  }
  const payDay = cfgI('cfg-dia-pagamento') || 1;
  const now = new Date();
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() - (m - 1));
  if (now.getDate() < payDay) months--;
  if (months < 0) months = 0;
  if (hojeEl) { hojeEl.value = months; hojeEl.setAttribute('readonly', ''); hojeEl.style.color = 'var(--steel)'; }
  recalc();
}

function getEuAt(mes, sc) {
  const fixos = cfgI('cfg-fixos');
  if (mes <= fixos) return null;
  // Each historical entry covers [startMonth, startMonth+3[
  // After the last known revision period, use scenario
  for (let i = euriborHistory.length - 1; i >= 0; i--) {
    const h = euriborHistory[i];
    const fim = h.startMonth + 3;
    if (mes >= h.startMonth && mes < fim) {
      const rate = (h.rates && h.rates[euriborTenor]) ?? h.rate ?? 0;
      return { rate: rate / 100, type: 'hist' };
    }
  }
  const fallback = scenarioRates[sc] ? (scenarioRates[sc][euriborTenor] || 0) : 0;
  return { rate: fallback / 100, type: sc };
}

function buildSched(sc) {
  const C = cfg('cfg-capital'), N = cfgI('cfg-prazo') * 12, F = cfgI('cfg-fixos');
  const rF = cfg('cfg-fixa') / 100 / 12, sp = cfg('cfg-spread') / 100;
  const pmtF = C * rF / (1 - Math.pow(1 + rF, -N));
  let bal = C, rows = [];
  const startDate = getStartDateOrFallback();
  const payDay = cfgI('cfg-dia-pagamento') || 1;
  // index prepayments by month for O(1) lookup
  const prepayByMonth = {};
  for (const p of prepaymentsHistory) {
    if (!prepayByMonth[p.month]) prepayByMonth[p.month] = [];
    prepayByMonth[p.month].push(p);
  }
  // lockedPmt: when set, payment is held fixed (reduzir prazo); null = recalculate (reduzir prestação)
  let lockedPmt = null;
  for (let i = 1; i <= N; i++) {
    if (bal < 0.01) break;
    const isF = i <= F;
    const eu = isF ? null : getEuAt(i, sc);
    const rM = isF ? rF : (eu.rate + sp) / 12;
    const rem = N - i + 1;
    let pmt;
    if (isF) {
      pmt = pmtF;
    } else if (lockedPmt !== null) {
      pmt = lockedPmt;
    } else {
      pmt = bal > 0 ? rM * bal / (1 - Math.pow(1 + rM, -rem)) : 0;
    }
    const jur = bal * rM, amort = Math.min(pmt - jur, bal), nb = Math.max(bal - amort, 0);
    const d = new Date(startDate.getFullYear(), startDate.getMonth() + i - 1, payDay);
    rows.push({ mes: i, date: d, pmt, jur, amort, bal: nb, balS: bal, isF, euType: isF ? 'fixed' : eu.type, euTot: isF ? cfg('cfg-fixa') : (eu.rate + sp) * 100, eu: isF ? null : eu.rate * 100 });
    bal = nb;
    // apply prepayments after this month's normal payment
    if (prepayByMonth[i]) {
      for (const p of prepayByMonth[i]) {
        const abateAmt = Math.min(p.amount, bal);
        bal = Math.max(bal - abateAmt, 0);
        if (p.option === 'term') {
          // lock payment so the term shortens instead of the payment dropping
          lockedPmt = pmt;
        } else {
          // reduzir prestação: recalculate from next month
          lockedPmt = null;
        }
      }
    }
    if (bal < 0.01) break;
  }
  return rows;
}

function renderResumo() {
  const hoje = cfgI('cfg-hoje'), C = cfg('cfg-capital');
  const rows = buildSched('base'), rH = rows[hoje - 1];
  if (!rH) return;
  let jp = 0; for (let i = 0; i < hoje && i < rows.length; i++)jp += rows[i].jur;
  const pct = (C - rH.bal) / C * 100;
  document.getElementById('r-capital').textContent = EUR(rH.bal);
  document.getElementById('r-jpagos').textContent = EUR(jp);
  const t = i18n[lang] || i18n.pt;
  document.getElementById('r-mrest').textContent = (rows.length - hoje) + ' ' + t.summary.monthsLabel;
  document.getElementById('r-pct').textContent = pct.toFixed(1) + t.summary.pctAmortized;
  document.getElementById('r-bar').style.width = pct + '%';
  document.getElementById('r-data').textContent = `${t.summary.month} ${hoje} · ${fmtM(hoje)}`;
  const nR = rows[hoje];
  if (nR) { document.getElementById('r-pmt').textContent = EUR(nR.pmt); document.getElementById('r-taxa').textContent = PCT(nR.euTot) + ' ' + t.summary.totalLabel; }
  // total projected costs (all extra costs over full loan life)
  const totalMonths = cfgI('cfg-prazo') * 12;
  let totalCosts = 0;
  for (const c of extraCosts) {
    const monthly = c.frequency === 'annual' ? c.amount / 12 : c.amount;
    const end = c.endMonth || totalMonths;
    totalCosts += monthly * Math.max(0, end - c.startMonth + 1);
  }
  let baseInterest = 0;
  ['opt', 'base', 'pess'].forEach(sc => {
    const r = buildSched(sc); let tj = 0; for (const x of r) tj += x.jur;
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
  const nxRev = lh ? lh.startMonth + 3 : cfgI('cfg-fixos') + 1;
  const tenorLabel = euriborTenor + 'M';
  const lastRate = lh ? ((lh.rates && lh.rates[euriborTenor]) ?? lh.rate) : null;
  const lastStatus = lh ? `${PCT(lastRate)} (${tenorLabel} ${t.summary.fromMonth || 'desde mês'} ${lh.startMonth})` : t.summary.none;
  document.getElementById('r-info').innerHTML = `📋 <strong>${t.summary.lastRateLabel}:</strong> ${lastStatus} &nbsp;·&nbsp; ${t.summary.nextReviewLabel}: ${t.summary.month} ${nxRev} (${fmtM(nxRev)})`;

  // Render chart
  renderCapitalChart(rows, hoje);
}

function renderCapitalChart(rows, hoje) {
  const t = i18n[lang] || i18n.pt;
  const ctx = document.getElementById('capital-chart').getContext('2d');
  const labels = rows.map((r, i) => i + 1);
  const capitalData = rows.map(r => r.bal);
  const jurosData = rows.map((r, i) => i < hoje ? r.jur : null);
  if (capitalChartInstance) { capitalChartInstance.destroy(); capitalChartInstance = null; }
  capitalChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: t.summary.chartCapital,
        data: capitalData,
        borderColor: 'var(--mid)',
        backgroundColor: 'rgba(44,82,130,0.1)',
        fill: false
      }, {
        label: t.summary.chartInterest,
        data: jurosData,
        borderColor: 'var(--gold)',
        backgroundColor: 'rgba(200,146,58,0.1)',
        fill: false
      }]
    },
    options: {
      responsive: true,
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: { display: true },
        tooltip: { enabled: true }
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
      <div><div class="entry-period">${t.table.month} ${h.startMonth}+</div><div style="font-size:.68rem;color:var(--steel)">${h.desc || fmtM(h.startMonth)}</div></div>
      <div class="entry-bar-wrap"><div class="entry-bar" style="width:${Math.min(rate / 5 * 100, 100)}%;background:var(--green2)"></div></div>
      <div class="entry-rate historical">${PCT(rate)}</div>
      <div style="display:flex;gap:4px;align-items:center">
        <span class="chip chip-hist">${t.table.chipHist}</span>
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
    const fim = hist.startMonth + 2;
    const histRate = (hist.rates && hist.rates[euriborTenor]) ?? hist.rate ?? 0;
    periods.push({ label: `${t.table.months} ${hist.startMonth}–${fim}`, eu: histRate, taxa: histRate + sp, type: 'hist', desc: hist.desc });
  }
  const lastM = euriborHistory.length ? euriborHistory[euriborHistory.length - 1].startMonth + 3 : F + 1;
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
      <div><div class="entry-period">${p.label}</div><div style="font-size:.67rem;color:var(--steel)">${p.desc || taxa}</div></div>
      <div class="entry-bar-wrap"><div class="entry-bar" style="width:${Math.min(p.taxa / maxT * 100, 100)}%;background:${bc}"></div></div>
      <div class="entry-rate ${rc}">${PCT(p.taxa)}</div>${badge}</div>`;
  }).join('');
}

function renderTbl(reset) {
  if (reset) tblRows = 36;
  const t = i18n[lang] || i18n.pt;
  const hoje = cfgI('cfg-hoje'), rows = buildSched(tblSc), end = Math.min(tblRows, rows.length);
  const scLbl = { hist: t.table.chipHist, opt: t.euribor.scenarioChartOpt, base: t.euribor.scenarioChartBase, pess: t.euribor.scenarioChartPess };
  const scLeg = { opt: '🟢 ' + t.euribor.scenarioOpt, base: '🟡 ' + t.euribor.scenarioBase, pess: '🔴 ' + t.euribor.scenarioPess };
  document.getElementById('tbl-sc-legend').textContent = '■ ' + scLeg[tblSc];
  let h = '';
  for (let i = 0; i < end; i++) {
    const r = rows[i], isT = r.mes === hoje;
    const rc = isT ? 'row-today' : r.isF ? 'row-fixed' : r.euType === 'hist' ? 'row-hist' : 'row-' + r.euType;
    const chip = isT ? `<span class="chip chip-today">${t.table.chipToday}</span>` : r.isF ? `<span class="chip chip-fixed">${t.table.chipFixed}</span>` : `<span class="chip chip-${r.euType}">${scLbl[r.euType]}</span>`;
    const eu = r.isF ? PCT(cfg('cfg-fixa')) : PCT(r.eu);
    const locale = lang === 'en' ? 'en-GB' : 'pt-PT';
    h += `<tr class="${rc}"><td>${r.mes}</td><td style="text-align:left;padding-left:10px">${r.date.toLocaleDateString(locale, { month: 'short', year: 'numeric' })}</td><td>${EUR(r.pmt)}</td><td>${EUR(r.jur)}</td><td>${EUR(r.amort)}</td><td>${EUR(r.bal)}</td><td>${eu}</td><td>${chip}</td></tr>`;
  }
  document.getElementById('tbl-body').innerHTML = h;
  document.getElementById('tbl-more').style.display = tblRows >= rows.length ? 'none' : 'block';
  const warnEl = document.getElementById('tbl-date-warn');
  if (warnEl) warnEl.style.display = hasStartDate() ? 'none' : 'block';
}

// Build schedule from a given month with a given starting balance (for abate simulation)
function buildSchedFrom(startMonth, startBalance, sc, op, pmtRef) {
  const N = cfgI('cfg-prazo') * 12, F = cfgI('cfg-fixos'), sp = cfg('cfg-spread') / 100;
  const rF = cfg('cfg-fixa') / 100 / 12;
  let bal = startBalance, rows = [];
  for (let i = startMonth; i <= N; i++) {
    const isF = i <= F;
    const eu = isF ? null : getEuAt(i, sc);
    const rM = isF ? rF : (eu.rate + sp) / 12;
    const rem = N - i + 1;
    let pmt;
    if (op === 'term') {
      // Keep original payment, shorten term
      pmt = pmtRef > 0 ? pmtRef : (bal > 0 ? rM * bal / (1 - Math.pow(1 + rM, -rem)) : 0);
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

function calcAbate() {
  const mesSim = parseInt(document.getElementById('ab-mes').value) || cfgI('cfg-hoje');
  const abate = parseFloat(document.getElementById('ab-val').value) || 0;
  const op = document.getElementById('ab-op').value, sc = document.getElementById('ab-sc').value;
  const rows = buildSched(sc);
  const rowAntes = rows[mesSim - 1];
  if (!rowAntes) { document.getElementById('ab-result').style.display = 'none'; return; }

  const capAntes = rowAntes.bal;
  const capApos = Math.max(capAntes - abate, 0);

  // Juros restantes SEM abate (a partir do mês seguinte ao abate)
  let jSem = 0;
  for (let i = mesSim; i < rows.length; i++) jSem += rows[i].jur;

  // Juros restantes COM abate — rebuild schedule from mesSim+1 with reduced capital
  // For "reduzir prazo": keep same payment as without abate
  const pmtRef = rows[mesSim] ? rows[mesSim].pmt : 0;
  const rowsCom = buildSchedFrom(mesSim + 1, capApos, sc, op, pmtRef);
  let jCom = 0; for (const r of rowsCom) jCom += r.jur;

  const mesesSem = rows.length - mesSim;
  const mesesCom = rowsCom.length;
  const poupar = jSem - jCom;
  const penalPct = parseFloat(document.getElementById('ab-penal-rate')?.value || '0.5') / 100;
  const penal = abate * penalPct;

  // New payment (reduzir prestação) or months saved (reduzir prazo)
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

function renderAbatesHist() {
  const el = document.getElementById('abates-hist-list');
  const t = i18n[lang] || i18n.pt;
  if (!prepaymentsHistory.length) { el.innerHTML = `<div class="empty">${t.prepayment.noHistory}</div>`; return; }
  el.innerHTML = prepaymentsHistory.map((a, i) => `
    <div class="euribor-entry historical">
      <div><div class="entry-period">${t.table.month} ${a.month}</div><div style="font-size:.68rem;color:var(--steel)">${a.desc || fmtM(a.month)} · ${a.option === 'term' ? t.prepayment.historyTextTerm : t.prepayment.historyTextPayment}${a.penalRate != null ? ' · pen. ' + a.penalRate + '%' : ''}</div></div>
      <div class="entry-bar-wrap"><div class="entry-bar" style="width:${Math.min(a.amount / 50000 * 100, 100)}%;background:var(--gold)"></div></div>
      <div class="entry-rate" style="color:var(--amber)">${EUR(a.amount)}${a.penalRate ? `<div style="font-size:.6rem;color:var(--red2);text-align:right">pen. ${EUR(a.amount * a.penalRate / 100)}</div>` : ''}</div>
      <div style="display:flex;gap:4px;align-items:center">
        <span class="chip chip-fixed">${t.prepayment.tag}</span>
        <button class="btn btn-danger btn-sm" onclick="removeAbate(${i})" style="padding:3px 7px;font-size:.65rem">✕</button>
      </div>
    </div>`).join('');
}

function renderCustos() {
  const el = document.getElementById('custos-list');
  const t = i18n[lang] || i18n.pt;
  if (!el) return;
  if (!extraCosts.length) { el.innerHTML = `<div class="empty">${t.costs.noCosts}</div>`; updateCostsSummary(); return; }
  el.innerHTML = extraCosts.map((c, i) => {
    const monthly = c.frequency === 'annual' ? c.amount / 12 : c.amount;
    const endStr = c.endMonth ? ` → ${t.costs.fromMonth} ${c.endMonth}` : ` (${t.costs.noEndMonth})`;
    return `<div class="euribor-entry historical" style="border-left-color:var(--amber)">
      <div><div class="entry-period">${c.name}</div><div style="font-size:.68rem;color:var(--steel)">${t.costs.fromMonth} ${c.startMonth}${endStr} · ${c.frequency === 'annual' ? t.costs.annual : t.costs.monthly}</div></div>
      <div class="entry-bar-wrap"><div class="entry-bar" style="width:${Math.min(monthly / 300 * 100, 100)}%;background:var(--amber)"></div></div>
      <div class="entry-rate" style="color:var(--amber);white-space:nowrap">${EUR(monthly)}<div style="font-size:.6rem;color:var(--steel);text-align:right">${t.costs.perMonth}</div></div>
      <div style="display:flex;gap:4px;align-items:center">
        <span class="chip chip-base">${t.costs.tag}</span>
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
    const monthly = c.frequency === 'annual' ? c.amount / 12 : c.amount;
    const end = c.endMonth || totalMonths;
    const paidMonths = Math.max(0, Math.min(hoje, end) - c.startMonth + 1);
    totalPaid += monthly * paidMonths;
    const projMonths = Math.max(0, end - c.startMonth + 1);
    totalProjected += monthly * projMonths;
    if (c.startMonth <= hoje && (!c.endMonth || c.endMonth >= hoje)) monthlyNow += monthly;
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
  if (!name || isNaN(amount) || amount <= 0) { alert(t.messages.fillCost); return; }
  extraCosts.push({ name, amount, frequency, startMonth, endMonth });
  extraCosts.sort((a, b) => a.startMonth - b.startMonth);
  document.getElementById('c-nome').value = '';
  document.getElementById('c-valor').value = '';
  document.getElementById('c-inicio').value = '1';
  document.getElementById('c-fim').value = '';
  toggleCustosForm();
  recalc();
}

function removeCusto(i) { extraCosts.splice(i, 1); recalc(); }
function toggleCustosForm() { const el = document.getElementById('custos-form'); if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; }

function addAbateHist() {
  const mes = parseInt(document.getElementById('ab-hist-mes').value);
  const val = parseFloat(document.getElementById('ab-hist-val').value);
  const option = document.getElementById('ab-hist-op').value;
  const penalRate = parseFloat(document.getElementById('ab-hist-penal')?.value ?? '0.5') || 0;
  const desc = document.getElementById('ab-hist-desc').value.trim();
  const t = i18n[lang] || i18n.pt;
  if (!mes || isNaN(val) || val <= 0) { alert(t.messages.fillPrepay); return; }
  prepaymentsHistory.push({ month: mes, amount: val, option, penalRate, desc: desc || `${t.prepayment.tag} ${t.table.month} ${mes}` });
  prepaymentsHistory.sort((a, b) => a.month - b.month);
  document.getElementById('ab-hist-mes').value = '';
  document.getElementById('ab-hist-val').value = '';
  const penalEl = document.getElementById('ab-hist-penal'); if (penalEl) penalEl.value = '0.5';
  document.getElementById('ab-hist-desc').value = '';
  toggleAbateForm();
  recalc();
}

function removeAbate(i) { prepaymentsHistory.splice(i, 1); recalc(); }
function toggleAbateForm() { const el = document.getElementById('abate-form'); el.style.display = el.style.display === 'none' ? 'block' : 'none'; }

function addHist() {
  const mes = parseInt(document.getElementById('ah-mes').value);
  const eu = parseFloat(document.getElementById('ah-eu').value);
  const desc = document.getElementById('ah-desc').value.trim();
  const t = i18n[lang] || i18n.pt;
  if (!mes || isNaN(eu)) { alert(t.messages.fillEuribor); return; }
  euriborHistory = euriborHistory.filter(h => h.startMonth !== mes);
  const rates = {};
  rates[euriborTenor] = eu;
  euriborHistory.push({ startMonth: mes, rates, desc: desc || `${t.euribor.history} ${t.table.month} ${mes}` });
  euriborHistory.sort((a, b) => a.startMonth - b.startMonth);
  document.getElementById('ah-mes').value = '';
  document.getElementById('ah-eu').value = '';
  document.getElementById('ah-desc').value = '';
  toggleForm(); recalc();
}

function removeHist(i) { euriborHistory.splice(i, 1); recalc(); }
function toggleForm() { const el = document.getElementById('add-form'); if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; }

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
  setAttr('btn-add-euribor', 'aria-label', msg.addEuribor);
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
function loadMore() { tblRows += 60; renderTbl(false); }

function showTab(id, el) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
  document.getElementById('panel-' + id).classList.add('active'); el.classList.add('active'); el.setAttribute('aria-selected', 'true');
  if (id === 'tabela') renderTbl(true);
  if (id === 'abates') calcAbate();
}

function exportarDados() {
  const dados = {
    version: 1,
    exportedAt: new Date().toISOString(),
    contract: { capital: cfg('cfg-capital'), termYears: cfgI('cfg-prazo'), fixedMonths: cfgI('cfg-fixos'), fixedRate: cfg('cfg-fixa'), spread: cfg('cfg-spread'), currentMonth: cfgI('cfg-hoje'), startMes: parseInt(document.getElementById('cfg-inicio-mes')?.value || '0') || 0, startAno: parseInt(document.getElementById('cfg-inicio-ano')?.value || '0') || 0, paymentDay: cfgI('cfg-dia-pagamento') || 1 },
    euriborHistory,
    prepaymentsHistory,
    extraCosts,
    scenarios: {
      optimistic: scenarioRates.opt,
      base: scenarioRates.base,
      pessimistic: scenarioRates.pess
    }
  }; const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'credito_habitacao_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click(); URL.revokeObjectURL(a.href);
}

function importarDados(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const msg = document.getElementById('import-msg');
    try {
      const d = JSON.parse(ev.target.result);
      if (!d.contract || !d.euriborHistory || !d.scenarios) throw new Error('Ficheiro inválido');
      document.getElementById('cfg-capital').value = d.contract.capital;
      document.getElementById('cfg-prazo').value = d.contract.termYears;
      document.getElementById('cfg-fixos').value = d.contract.fixedMonths;
      document.getElementById('cfg-fixa').value = d.contract.fixedRate;
      document.getElementById('cfg-spread').value = d.contract.spread;
      document.getElementById('cfg-hoje').value = d.contract.currentMonth;
      if (d.contract.startMes) { const el = document.getElementById('cfg-inicio-mes'); if (el) el.value = d.contract.startMes; }
      if (d.contract.startAno) { const el = document.getElementById('cfg-inicio-ano'); if (el) el.value = d.contract.startAno; }
      if (d.contract.startMes && d.contract.startAno) { const el = document.getElementById('cfg-hoje'); if (el) { el.setAttribute('readonly', ''); el.style.color = 'var(--steel)'; } }
      if (d.contract.paymentDay) { const el = document.getElementById('cfg-dia-pagamento'); if (el) el.value = d.contract.paymentDay; }
      euriborHistory = d.euriborHistory;
      prepaymentsHistory = d.prepaymentsHistory || [];
      extraCosts = d.extraCosts || [];
      if (d.scenarios) {
        scenarioRates.opt = d.scenarios.optimistic || scenarioRates.opt;
        scenarioRates.base = d.scenarios.base || scenarioRates.base;
        scenarioRates.pess = d.scenarios.pessimistic || scenarioRates.pess;
      }
      updateScenarioInputs();
      recalc();
      const t = i18n[lang] || i18n.pt;
      msg.style.display = 'block'; msg.className = 'info';
      const dateText = d.exportedAt ? new Date(d.exportedAt).toLocaleString(lang === 'en' ? 'en-GB' : 'pt-PT') : '—';
      msg.textContent = t.messages.imported.replace('{date}', dateText);
    } catch (err) {
      const t = i18n[lang] || i18n.pt;
      msg.style.display = 'block'; msg.className = 'warn';
      msg.textContent = t.messages.importError.replace('{error}', err.message);
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

// ── LOCAL STORAGE ──────────────────────────────────────
const LS_KEY = 'mortgage_tracker_v1';

function updateScenarioInputs() {
  document.getElementById('sc-opt').value = scenarioRates.opt[euriborTenor];
  document.getElementById('sc-base').value = scenarioRates.base[euriborTenor];
  document.getElementById('sc-pess').value = scenarioRates.pess[euriborTenor];
}

function setScenarioRate(scenario, value) {
  if (!scenarioRates[scenario]) return;
  scenarioRates[scenario][euriborTenor] = parseFloat(value) || 0;
  recalc();
}

function saveToStorage() {
  try {
    const state = {
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
      scenarios: {
        optimistic: scenarioRates.opt,
        base: scenarioRates.base,
        pessimistic: scenarioRates.pess
      }
    };
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (e) { console.warn('localStorage save failed:', e); }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d.contract || !d.euriborHistory || !d.scenarios) return false;
    document.getElementById('cfg-capital').value = d.contract.capital;
    document.getElementById('cfg-prazo').value = d.contract.termYears;
    document.getElementById('cfg-fixos').value = d.contract.fixedMonths;
    document.getElementById('cfg-fixa').value = d.contract.fixedRate;
    document.getElementById('cfg-spread').value = d.contract.spread;
    document.getElementById('cfg-hoje').value = d.contract.currentMonth;
    if (d.contract.startMes) { const el = document.getElementById('cfg-inicio-mes'); if (el) el.value = d.contract.startMes; }
    if (d.contract.startAno) { const el = document.getElementById('cfg-inicio-ano'); if (el) el.value = d.contract.startAno; }
    if (d.contract.startMes && d.contract.startAno) { const el = document.getElementById('cfg-hoje'); if (el) { el.setAttribute('readonly', ''); el.style.color = 'var(--steel)'; } }
    if (d.contract.paymentDay) { const el = document.getElementById('cfg-dia-pagamento'); if (el) el.value = d.contract.paymentDay; }
    euriborHistory = d.euriborHistory;
    prepaymentsHistory = d.prepaymentsHistory || [];
    extraCosts = d.extraCosts || [];
    if (typeof d.euriborTenor === 'number') euriborTenor = d.euriborTenor;
    if (d.scenarios) {
      scenarioRates.opt = d.scenarios.optimistic || scenarioRates.opt;
      scenarioRates.base = d.scenarios.base || scenarioRates.base;
      scenarioRates.pess = d.scenarios.pessimistic || scenarioRates.pess;
    }
    updateScenarioInputs();
    document.querySelectorAll('.euribor-tenor-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.euribor-tenor-btn[data-tenor="${euriborTenor}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    return true;
  } catch (e) { console.warn('localStorage load failed:', e); return false; }
}

function clearStorage() {
  const t = i18n[lang] || i18n.pt;
  if (!confirm(t.messages.confirmClear)) return;
  localStorage.removeItem(LS_KEY);
  location.reload();
}

// ── RECALC (saves to storage on every change) ──────────
function recalc() {
  try {
    renderResumo();
    renderHist();
    renderTl();
    renderAbatesHist();
    calcAbate();
    renderCustos();
    if (document.getElementById('panel-tabela').classList.contains('active')) renderTbl(true);
  } catch (e) { console.error('recalc render error:', e); }
  finally { saveToStorage(); }
}

// ── INIT ────────────────────────────────────────────────
initStartDateSelects();
const restoredFromStorage = loadFromStorage();
updateScenarioInputs();
const t = i18n[lang] || i18n.pt;
document.getElementById('ah-eu-label').textContent = t.euribor.tenorLabel.replace('{tenor}', euriborTenor);
const savedLang = localStorage.getItem('lang') || 'pt';
lang = savedLang;
document.getElementById('lang-toggle').textContent = lang.toUpperCase();
updateLang();
recalc();
document.getElementById('ab-mes').value = document.getElementById('cfg-hoje').value;
renderCustos();

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
