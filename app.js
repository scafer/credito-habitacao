// STATE
let euriborHistory = [{startMonth:25,rates:{3:2.50,6:2.70,12:3.10},desc:'Q1 revision'}];
let euriborTenor = 3; // 3, 6 ou 12
let scenarioRates = {
  opt: {3:1.50, 6:1.70, 12:2.00},
  base: {3:2.50, 6:2.70, 12:3.00},
  pess: {3:4.00, 6:4.20, 12:4.50}
};
let prepaymentsHistory = [];
let tlSc='opt', tblSc='opt', tblRows=36;

// HELPERS
const EUR=n=>n==null?'—':n.toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
const PCT=n=>n.toFixed(3)+'%';
const fmtM=n=>{const d=new Date(2024,3,1);d.setMonth(d.getMonth()+n-1);return d.toLocaleDateString('pt-PT',{month:'short',year:'numeric'})};
const cfg=id=>parseFloat(document.getElementById(id).value)||0;
const cfgI=id=>parseInt(document.getElementById(id).value)||0;

function getEuAt(mes,sc){
  const fixos=cfgI('cfg-fixos');
  if(mes<=fixos)return null;
  // Each historical entry covers [startMonth, startMonth+3[
  // After the last known revision period, use scenario
  for(let i=euriborHistory.length-1;i>=0;i--){
    const h=euriborHistory[i];
    const fim=h.startMonth+3;
    if(mes>=h.startMonth && mes<fim){
      const rate=(h.rates && h.rates[euriborTenor]) ?? h.rate ?? 0;
      return {rate:rate/100, type:'hist'};
    }
  }
  const fallback = scenarioRates[sc] ? (scenarioRates[sc][euriborTenor] || 0) : 0;
  return {rate: fallback/100, type:sc};
}

function buildSched(sc){
  const C=cfg('cfg-capital'),N=cfgI('cfg-prazo')*12,F=cfgI('cfg-fixos');
  const rF=cfg('cfg-fixa')/100/12,sp=cfg('cfg-spread')/100;
  const pmtF=C*rF/(1-Math.pow(1+rF,-N));
  let bal=C,rows=[];
  for(let i=1;i<=N;i++){
    const isF=i<=F;
    const eu=isF?null:getEuAt(i,sc);
    const rM=isF?rF:(eu.rate+sp)/12;
    const rem=N-i+1;
    const pmt=isF?pmtF:(bal>0?rM*bal/(1-Math.pow(1+rM,-rem)):0);
    const jur=bal*rM,amort=Math.min(pmt-jur,bal),nb=Math.max(bal-amort,0);
    const d=new Date(2024,3,i-1);
    rows.push({mes:i,date:d,pmt,jur,amort,bal:nb,balS:bal,isF,euType:isF?'fixed':eu.type,euTot:isF?cfg('cfg-fixa'):(eu.rate+sp)*100,eu:isF?null:eu.rate*100});
    bal=nb;if(bal<0.01)break;
  }
  return rows;
}

function renderResumo(){
  const hoje=cfgI('cfg-hoje'),C=cfg('cfg-capital');
  const rows=buildSched('base'),rH=rows[hoje-1];
  if(!rH)return;
  let jp=0;for(let i=0;i<hoje&&i<rows.length;i++)jp+=rows[i].jur;
  const pct=(C-rH.bal)/C*100;
  document.getElementById('r-capital').textContent=EUR(rH.bal);
  document.getElementById('r-jpagos').textContent=EUR(jp);
  document.getElementById('r-mrest').textContent=(rows.length-hoje)+' meses';
  document.getElementById('r-pct').textContent=pct.toFixed(1)+'% amortizado';
  document.getElementById('r-bar').style.width=pct+'%';
  document.getElementById('r-data').textContent='Mês '+hoje+' · '+fmtM(hoje);
  const nR=rows[hoje];
  if(nR){document.getElementById('r-pmt').textContent=EUR(nR.pmt);document.getElementById('r-taxa').textContent=PCT(nR.euTot)+' total';}
  ['opt','base','pess'].forEach(sc=>{
    const r=buildSched(sc);let tj=0;for(const x of r)tj+=x.jur;
    document.getElementById('r-tot-'+sc).textContent=EUR(C+tj);
    document.getElementById('r-j-'+sc).textContent=EUR(tj)+' em juros';
  });
  const lh=euriborHistory[euriborHistory.length-1];
  const nxRev=lh?lh.startMonth+3:cfgI('cfg-fixos')+1;
  const tenorLabel=euriborTenor+'M';
  const lastRate = lh ? ((lh.rates && lh.rates[euriborTenor]) ?? lh.rate) : null;
  document.getElementById('r-info').innerHTML=`📋 <strong>Última Euribor registada:</strong> ${lh?PCT(lastRate)+' ('+tenorLabel+' desde mês '+lh.startMonth+')':'Nenhuma'} &nbsp;·&nbsp; Próxima revisão esperada: mês ${nxRev} (${fmtM(nxRev)})`;
}

function renderHist(){
  const el=document.getElementById('hist-list');
  if(!euriborHistory.length){el.innerHTML='<div class="empty">Sem revisões. Adiciona a primeira revisão trimestral.</div>';return;}
  el.innerHTML=euriborHistory.map((h,i)=>{
    const rate = (h.rates && h.rates[euriborTenor]) ?? h.rate ?? 0;
    return `
    <div class="euribor-entry historical">
      <div><div class="entry-period">Mês ${h.startMonth}+</div><div style="font-size:.68rem;color:var(--steel)">${h.desc||fmtM(h.startMonth)}</div></div>
      <div class="entry-bar-wrap"><div class="entry-bar" style="width:${Math.min(rate/5*100,100)}%;background:var(--green2)"></div></div>
      <div class="entry-rate historical">${PCT(rate)}</div>
      <div style="display:flex;gap:4px;align-items:center">
        <span class="chip chip-hist">Real</span>
        <button class="btn btn-danger btn-sm" onclick="removeHist(${i})" style="padding:3px 7px;font-size:.65rem">✕</button>
      </div>
    </div>`;
  }).join('');
}

function renderTl(){
  const el=document.getElementById('tl-list');
  const F=cfgI('cfg-fixos'),N=cfgI('cfg-prazo')*12,sp=cfg('cfg-spread');
  const scCol={opt:'#16a34a',base:'#d97706',pess:'#dc2626'};
  const periods=[];
  periods.push({label:`Meses 1–${F}`,eu:null,taxa:cfg('cfg-fixa'),type:'fixed',desc:'Taxa fixa contratual'});
  for(let i=0;i<euriborHistory.length;i++){
    const hist = euriborHistory[i];
    const fim=hist.startMonth+2;
    const histRate=(hist.rates && hist.rates[euriborTenor]) ?? hist.rate ?? 0;
    periods.push({label:`Meses ${hist.startMonth}–${fim}`,eu:histRate,taxa:histRate+sp,type:'hist',desc:hist.desc});
  }
  const lastM=euriborHistory.length?euriborHistory[euriborHistory.length-1].startMonth+3:F+1;
  const futM=lastM+3;
  if(futM<=N){
    const scEu = (scenarioRates[tlSc] && scenarioRates[tlSc][euriborTenor]) || 0;
    const scLbl={opt:'Optimista',base:'Base',pess:'Pessimista'};
    periods.push({label:`Meses ${futM}–${N}`,eu:scEu,taxa:scEu+sp,type:tlSc,desc:`Cenário ${scLbl[tlSc]} (previsão)`});
  }
  const maxT=Math.max(...periods.map(p=>p.taxa));
  const rCls={hist:'historical',opt:'future-opt',base:'future-base',pess:'future-pess'};
  el.innerHTML=periods.map(p=>{
    const bc=p.type==='fixed'?'#c8923a':p.type==='hist'?'#27a96a':scCol[p.type]||'#aaa';
    const rc=p.type==='fixed'?'historical':rCls[p.type]||'historical';
    const badge=p.type==='fixed'?'<span class="chip chip-fixed">Fixa</span>':p.type==='hist'?'<span class="chip chip-hist">Real</span>':`<span class="chip chip-${p.type}">${p.type==='opt'?'Opt':p.type==='base'?'Base':'Pess'}</span>`;
    const taxa=p.type==='fixed'?PCT(p.taxa):`Euribor ${PCT(p.eu)} + ${PCT(sp)} = ${PCT(p.taxa)}`;
    return`<div class="euribor-entry ${p.type!=='fixed'&&p.type!=='hist'?'future':'historical'}">
      <div><div class="entry-period">${p.label}</div><div style="font-size:.67rem;color:var(--steel)">${p.desc||taxa}</div></div>
      <div class="entry-bar-wrap"><div class="entry-bar" style="width:${Math.min(p.taxa/maxT*100,100)}%;background:${bc}"></div></div>
      <div class="entry-rate ${rc}">${PCT(p.taxa)}</div>${badge}</div>`;
  }).join('');
}

function renderTbl(reset){
  if(reset)tblRows=36;
  const hoje=cfgI('cfg-hoje'),rows=buildSched(tblSc),end=Math.min(tblRows,rows.length);
  const scLbl={hist:'Real',opt:'Opt.',base:'Base',pess:'Pess.'};
  const scLeg={opt:'🟢 Optimista',base:'🟡 Base',pess:'🔴 Pessimista'};
  document.getElementById('tbl-sc-legend').textContent='■ '+scLeg[tblSc];
  let h='';
  for(let i=0;i<end;i++){
    const r=rows[i],isT=r.mes===hoje;
    const rc=isT?'row-today':r.isF?'row-fixed':r.euType==='hist'?'row-hist':'row-'+r.euType;
    const chip=isT?'<span class="chip chip-today">Hoje</span>':r.isF?'<span class="chip chip-fixed">Fixa</span>':`<span class="chip chip-${r.euType}">${scLbl[r.euType]}</span>`;
    const eu=r.isF?PCT(cfg('cfg-fixa')):PCT(r.eu);
    h+=`<tr class="${rc}"><td>${r.mes}</td><td style="text-align:left;padding-left:10px">${r.date.toLocaleDateString('pt-PT',{month:'short',year:'numeric'})}</td><td>${EUR(r.pmt)}</td><td>${EUR(r.jur)}</td><td>${EUR(r.amort)}</td><td>${EUR(r.bal)}</td><td>${eu}</td><td>${chip}</td></tr>`;
  }
  document.getElementById('tbl-body').innerHTML=h;
  document.getElementById('tbl-more').style.display=tblRows>=rows.length?'none':'block';
}

// Build schedule from a given month with a given starting balance (for abate simulation)
function buildSchedFrom(startMonth, startBalance, sc, op, pmtRef){
  const N=cfgI('cfg-prazo')*12, F=cfgI('cfg-fixos'), sp=cfg('cfg-spread')/100;
  const rF=cfg('cfg-fixa')/100/12;
  let bal=startBalance, rows=[], remainingMonths=N-startMonth+1;
  for(let i=startMonth;i<=N;i++){
    const isF=i<=F;
    const eu=isF?null:getEuAt(i,sc);
    const rM=isF?rF:(eu.rate+sp)/12;
    const rem=N-i+1;
    let pmt;
    if(op==='term'){
      // Keep original payment, shorten term
      pmt=pmtRef>0?pmtRef:(bal>0?rM*bal/(1-Math.pow(1+rM,-rem)):0);
    } else {
      // Recalculate payment each period with remaining balance and term
      pmt=bal>0?rM*bal/(1-Math.pow(1+rM,-rem)):0;
    }
    const jur=bal*rM, amort=Math.min(pmt-jur,bal), nb=Math.max(bal-amort,0);
    rows.push({mes:i,jur,amort,pmt,bal:nb});
    bal=nb; if(bal<0.01)break;
  }
  return rows;
}

function calcAbate(){
  const mesSim=parseInt(document.getElementById('ab-mes').value)||cfgI('cfg-hoje');
  const abate=parseFloat(document.getElementById('ab-val').value)||0;
  const op=document.getElementById('ab-op').value, sc=document.getElementById('ab-sc').value;
  const rows=buildSched(sc);
  const rowAntes=rows[mesSim-1];
  if(!rowAntes){document.getElementById('ab-result').style.display='none';return;}

  const capAntes=rowAntes.bal;
  const capApos=Math.max(capAntes-abate,0);

  // Juros restantes SEM abate (a partir do mês seguinte ao abate)
  let jSem=0;
  for(let i=mesSim;i<rows.length;i++) jSem+=rows[i].jur;

  // Juros restantes COM abate — rebuild schedule from mesSim+1 with reduced capital
  // For "reduzir prazo": keep same payment as without abate
  const pmtRef = rows[mesSim]?rows[mesSim].pmt:0;
  const rowsCom = buildSchedFrom(mesSim+1, capApos, sc, op, pmtRef);
  let jCom=0; for(const r of rowsCom) jCom+=r.jur;

  const mesesSem = rows.length - mesSim;
  const mesesCom = rowsCom.length;
  const poupar = jSem - jCom;
  const penal  = abate * 0.005;

  // New payment (reduzir prestação) or months saved (reduzir prazo)
  const novaPmt = op==='payment' && rowsCom.length>0 ? rowsCom[0].pmt : 0;

  document.getElementById('ab-result').style.display='block';
  document.getElementById('ab-poupar').textContent=EUR(Math.max(poupar,0));
  document.getElementById('ab-cap-antes').textContent=EUR(capAntes);
  document.getElementById('ab-cap').textContent=EUR(capApos);
  document.getElementById('ab-sem').textContent=EUR(jSem);
  document.getElementById('ab-com').textContent=EUR(jCom);
  document.getElementById('ab-penal').textContent=EUR(penal);
  if(op==='payment'){
    document.getElementById('ab-op-lbl').textContent='Nova prestação mensal';
    document.getElementById('ab-op-val').textContent=EUR(novaPmt);
  } else {
    const redução=mesesSem-mesesCom;
    document.getElementById('ab-op-lbl').textContent='Redução no prazo';
    document.getElementById('ab-op-val').textContent=redução>0?redução+' meses menos':'—';
  }
}

function renderAbatesHist(){
  const el=document.getElementById('abates-hist-list');
  if(!prepaymentsHistory.length){el.innerHTML='<div class="empty">Sem abates registados.</div>';return;}
  el.innerHTML=prepaymentsHistory.map((a,i)=>`
    <div class="euribor-entry historical">
      <div><div class="entry-period">Mês ${a.month}</div><div style="font-size:.68rem;color:var(--steel)">${a.desc||fmtM(a.month)} · ${a.option==='term'?'Reduziu prazo':'Reduziu prestação'}</div></div>
      <div class="entry-bar-wrap"><div class="entry-bar" style="width:${Math.min(a.amount/50000*100,100)}%;background:var(--gold)"></div></div>
      <div class="entry-rate" style="color:var(--amber)">${EUR(a.amount)}</div>
      <div style="display:flex;gap:4px;align-items:center">
        <span class="chip chip-fixed">Abate</span>
        <button class="btn btn-danger btn-sm" onclick="removeAbate(${i})" style="padding:3px 7px;font-size:.65rem">✕</button>
      </div>
    </div>`).join('');
}

function addAbateHist(){
  const mes=parseInt(document.getElementById('ab-hist-mes').value);
  const val=parseFloat(document.getElementById('ab-hist-val').value);
  const option=document.getElementById('ab-hist-op').value;
  const desc=document.getElementById('ab-hist-desc').value.trim();
  if(!mes||isNaN(val)||val<=0){alert('Preenche o mês e o valor do abate.');return;}
  prepaymentsHistory.push({month:mes,amount:val,option,desc:desc||`Abate mês ${mes}`});
  prepaymentsHistory.sort((a,b)=>a.month-b.month);
  document.getElementById('ab-hist-mes').value='';
  document.getElementById('ab-hist-val').value='';
  document.getElementById('ab-hist-desc').value='';
  toggleAbateForm();
  renderAbatesHist();
}

function removeAbate(i){prepaymentsHistory.splice(i,1);renderAbatesHist();}
function toggleAbateForm(){const el=document.getElementById('abate-form');el.style.display=el.style.display==='none'?'block':'none';}

function addHist(){
  const mes=parseInt(document.getElementById('ah-mes').value);
  const eu3=parseFloat(document.getElementById('ah-eu-3').value);
  const eu6=parseFloat(document.getElementById('ah-eu-6').value);
  const eu12=parseFloat(document.getElementById('ah-eu-12').value);
  const desc=document.getElementById('ah-desc').value.trim();
  if(!mes||isNaN(eu3) || isNaN(eu6) || isNaN(eu12)){alert('Preenche o mês e as Euribors para 3M, 6M e 12M.');return;}
  euriborHistory=euriborHistory.filter(h=>h.startMonth!==mes);
  euriborHistory.push({startMonth:mes,rates:{3:eu3,6:eu6,12:eu12},desc:desc||`Revisão mês ${mes}`});
  euriborHistory.sort((a,b)=>a.startMonth-b.startMonth);
  document.getElementById('ah-mes').value='';
  document.getElementById('ah-eu-3').value='';
  document.getElementById('ah-eu-6').value='';
  document.getElementById('ah-eu-12').value='';
  document.getElementById('ah-desc').value='';
  toggleForm();recalc();
}

function removeHist(i){euriborHistory.splice(i,1);recalc();}
function toggleForm(){const el=document.getElementById('add-form');el.style.display=el.style.display==='none'?'block':'none';}
function setEuriborTenor(tenor,el){
  euriborTenor = tenor;
  document.querySelectorAll('.euribor-tenor-btn').forEach(b=>b.classList.remove('active'));
  if(el) el.classList.add('active');
  updateScenarioInputs();
  recalc();
}

function setTlSc(sc,el){tlSc=sc;document.querySelectorAll('#panel-euribor .card:last-child .scenario-tab').forEach(t=>t.classList.remove('active'));el.classList.add('active');renderTl();}
function setTblSc(sc,el){tblSc=sc;document.querySelectorAll('#panel-tabela .scenario-tab').forEach(t=>t.classList.remove('active'));el.classList.add('active');renderTbl(true);}
function loadMore(){tblRows+=60;renderTbl(false);}

function showTab(id,el){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('panel-'+id).classList.add('active');el.classList.add('active');
  if(id==='tabela')renderTbl(true);
  if(id==='abates')calcAbate();
}

function exportarDados(){
  const dados={
    version:1,
    exportedAt:new Date().toISOString(),
    contract:{capital:cfg('cfg-capital'),termYears:cfgI('cfg-prazo'),fixedMonths:cfgI('cfg-fixos'),fixedRate:cfg('cfg-fixa'),spread:cfg('cfg-spread'),currentMonth:cfgI('cfg-hoje')},
    euriborHistory,
    prepaymentsHistory,
    scenarios:{
      optimistic: scenarioRates.opt,
      base: scenarioRates.base,
      pessimistic: scenarioRates.pess
    }
  };  const blob=new Blob([JSON.stringify(dados,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='credito_habitacao_'+new Date().toISOString().slice(0,10)+'.json';
  a.click();URL.revokeObjectURL(a.href);
}

function importarDados(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    const msg=document.getElementById('import-msg');
    try{
      const d=JSON.parse(ev.target.result);
      if(!d.contract||!d.euriborHistory||!d.scenarios)throw new Error('Ficheiro inválido');
      document.getElementById('cfg-capital').value=d.contract.capital;
      document.getElementById('cfg-prazo').value=d.contract.termYears;
      document.getElementById('cfg-fixos').value=d.contract.fixedMonths;
      document.getElementById('cfg-fixa').value=d.contract.fixedRate;
      document.getElementById('cfg-spread').value=d.contract.spread;
      document.getElementById('cfg-hoje').value=d.contract.currentMonth;
      euriborHistory=d.euriborHistory;
      prepaymentsHistory=d.prepaymentsHistory||[];
      if(d.scenarios){
        scenarioRates.opt = d.scenarios.optimistic || scenarioRates.opt;
        scenarioRates.base = d.scenarios.base || scenarioRates.base;
        scenarioRates.pess = d.scenarios.pessimistic || scenarioRates.pess;
      }
      updateScenarioInputs();
      recalc();
      msg.style.display='block';msg.className='info';
      msg.textContent='\u2705 Dados importados com sucesso! Exportado em: '+(d.exportedAt?new Date(d.exportedAt).toLocaleString('pt-PT'):'\u2014');
    }catch(err){
      msg.style.display='block';msg.className='warn';
      msg.textContent='\u274c Erro ao importar: '+err.message;
    }
    e.target.value='';
  };
  reader.readAsText(file);
}

// ── LOCAL STORAGE ──────────────────────────────────────
const LS_KEY = 'mortgage_tracker_v1';

function updateScenarioInputs(){
  document.getElementById('sc-opt').value = scenarioRates.opt[euriborTenor];
  document.getElementById('sc-base').value = scenarioRates.base[euriborTenor];
  document.getElementById('sc-pess').value = scenarioRates.pess[euriborTenor];
}

function setScenarioRate(scenario, value){
  if(!scenarioRates[scenario]) return;
  scenarioRates[scenario][euriborTenor] = parseFloat(value)||0;
  recalc();
}

function saveToStorage(){
  try{
    const state = {
      contract:{
        capital: cfg('cfg-capital'),
        termYears: cfgI('cfg-prazo'),
        fixedMonths: cfgI('cfg-fixos'),
        fixedRate: cfg('cfg-fixa'),
        spread: cfg('cfg-spread'),
        currentMonth: cfgI('cfg-hoje')
      },
      euriborTenor,
      euriborHistory,
      prepaymentsHistory,
      scenarios:{
        optimistic: scenarioRates.opt,
        base: scenarioRates.base,
        pessimistic: scenarioRates.pess
      }
    };
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch(e){ console.warn('localStorage save failed:', e); }
}

function loadFromStorage(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return false;
    const d = JSON.parse(raw);
    if(!d.contract||!d.euriborHistory||!d.scenarios) return false;
    document.getElementById('cfg-capital').value = d.contract.capital;
    document.getElementById('cfg-prazo').value   = d.contract.termYears;
    document.getElementById('cfg-fixos').value   = d.contract.fixedMonths;
    document.getElementById('cfg-fixa').value    = d.contract.fixedRate;
    document.getElementById('cfg-spread').value  = d.contract.spread;
    document.getElementById('cfg-hoje').value    = d.contract.currentMonth;
    euriborHistory       = d.euriborHistory;
    prepaymentsHistory   = d.prepaymentsHistory || [];
    if(typeof d.euriborTenor === 'number') euriborTenor = d.euriborTenor;
    if(d.scenarios){
      scenarioRates.opt = d.scenarios.optimistic || scenarioRates.opt;
      scenarioRates.base = d.scenarios.base || scenarioRates.base;
      scenarioRates.pess = d.scenarios.pessimistic || scenarioRates.pess;
    }
    updateScenarioInputs();
    document.querySelectorAll('.euribor-tenor-btn').forEach(b=>b.classList.remove('active'));
    const activeBtn = document.querySelector(`.euribor-tenor-btn[data-tenor="${euriborTenor}"]`);
    if(activeBtn) activeBtn.classList.add('active');
    return true;
  } catch(e){ console.warn('localStorage load failed:', e); return false; }
}

function clearStorage(){
  if(!confirm('Tens a certeza que queres apagar todos os dados guardados localmente?')) return;
  localStorage.removeItem(LS_KEY);
  location.reload();
}

// ── RECALC (saves to storage on every change) ──────────
function recalc(){
  renderResumo();renderHist();renderTl();renderAbatesHist();calcAbate();
  if(document.getElementById('panel-tabela').classList.contains('active'))renderTbl(true);
  saveToStorage();
}

// ── INIT ────────────────────────────────────────────────
const restoredFromStorage = loadFromStorage();
updateScenarioInputs();
recalc();
document.getElementById('ab-mes').value = document.getElementById('cfg-hoje').value;

// Show storage status in config panel
(function(){
  const msg = document.getElementById('storage-status');
  if(!msg) return;
  if(restoredFromStorage){
    msg.className='info';
    msg.textContent='✅ Dados restaurados automaticamente da memória do browser.';
  } else {
    msg.className='info';
    msg.textContent='ℹ️ Sem dados guardados — a usar valores predefinidos.';
  }
  msg.style.display='block';
})();
