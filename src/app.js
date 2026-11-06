(function(){
"use strict";
const VERSION="1.3";
const NOTES_ID="1jzW0uELNty_8Dx0AWhwJXzg7YObm6Nr_fYbNlP0Z3mo";
const NOTES_URL="https://docs.google.com/spreadsheets/d/"+NOTES_ID+"/edit";
const DS_COACH="collection://264112d7-0f3d-80c1-9340-000bfe370a29";
const DS_VF="collection://800b8a16-6f27-4a04-984f-3f9e2ce7f640";
const DEFAULT_BACKEND="https://script.google.com/macros/s/AKfycbw3n7F9-MfjAbRasuj6DICyN_plOyC8MxJOcryWQ8uayT1CxiTFtDRiDg9gV7OdsUMv/exec";
const CRUSCOTTO_URL="https://claude.ai/artifact/5R9e198gvYnQpQsJW7d2K9";
const IN_CLAUDE=!!(window.claude&&typeof window.claude.use==="function");
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const store={
  get(k,d){try{const v=localStorage.getItem("serkis:"+k);return v?JSON.parse(v):d}catch(e){return d}},
  set(k,v){try{localStorage.setItem("serkis:"+k,JSON.stringify(v))}catch(e){}},
  del(k){try{localStorage.removeItem("serkis:"+k)}catch(e){}}
};
const ICON={
  ext:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>',
  copy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="1"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/></svg>'
};

/* ================= stato ================= */
const S={
  mode:IN_CLAUDE?"claude":"app",adapter:null,cfg:null,
  athletes:[],sheets:{},notes:[],notesState:"idle",notesErr:null,
  files:{},tests:{},bodies:{},hist:{},ai:{},alt:{},sessSel:{},pickTab:{},
  view:"oggi",sel:null,tab:"scheda",prev:"oggi",
  filter:{sede:"all",stato:"attivi",focus:null,q:""},sort:"urgenza",
  load:{state:"idle",err:null,at:null},edit:null,editErr:null,saving:false,
  templates:null,tplErr:null,nuovo:null,created:null,creating:false,createErr:null,
  drafts:{},extra:{},nav:0,delArm:null,unlinkArm:false,setupErr:null,setupBusy:false
};
(function(){const p=store.get("prefs",{});if(p.sede)S.filter.sede=p.sede;if(p.stato)S.filter.stato=p.stato;if(p.sort)S.sort=p.sort;if(p.tab)S.tab=p.tab})();
function savePrefs(){store.set("prefs",{sede:S.filter.sede,stato:S.filter.stato,sort:S.sort,tab:S.tab})}

/* ================= date ================= */
function pd(s){if(!s)return null;const m=String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);return m?new Date(+m[1],+m[2]-1,+m[3]):null}
function today(){const d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate())}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
const p2=n=>String(n).padStart(2,"0");
function fd(d){return d?p2(d.getDate())+"/"+p2(d.getMonth()+1):"—"}
function fdy(d){return d?fd(d)+"/"+d.getFullYear():"—"}
function iso(d){return d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate())}
function parseIt(s){const m=String(s||"").match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);if(!m)return null;let y=+m[3];if(y<100)y+=2000;const d=new Date(y,+m[2]-1,+m[1]);return isNaN(d)?null:d}
function anyDate(s){if(!s)return null;s=String(s);if(/^\d{4}-\d{2}-\d{2}/.test(s)){const d=new Date(s);return isNaN(d)?pd(s):new Date(d.getFullYear(),d.getMonth(),d.getDate())}const a=parseIt(s);if(a)return a;const d=new Date(s);return isNaN(d)?null:new Date(d.getFullYear(),d.getMonth(),d.getDate())}
const GIORNI=["domenica","lunedì","martedì","mercoledì","giovedì","venerdì","sabato"];
const MESI=["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
function weekInfo(start,dur){
  if(!start)return null;
  const days=Math.round((today()-start)/86400000);
  if(days<0)return{future:true,days,week:0,dur,end:dur?addDays(start,dur*7-1):null,scad:null};
  const week=Math.floor(days/7)+1,end=dur?addDays(start,dur*7-1):null;let scad=null;
  if(dur){
    if(week>dur)scad={level:"bad",label:"Scaduta da "+(days-dur*7+1)+" gg",rank:0};
    else if(week===dur)scad={level:"bad",label:"Ultima settimana",rank:1};
    else if(week===dur-1)scad={level:"warn",label:"Penultima settimana",rank:2};
  }
  return{week,dur,end,scad,days};
}

/* ================= atleti ================= */
function nid(u){const s=String(u||"").replace(/-/g,"");const m=s.match(/([0-9a-f]{32})/i);return m?m[1].toLowerCase():null}
function linksOf(v){
  if(v==null)return[];let s=typeof v==="string"?v:JSON.stringify(v);
  if(/%2F/i.test(s))s=s.replace(/[^"\s,\]\[]+/g,m=>{if(!/%[0-9A-F]{2}/i.test(m))return m;try{return decodeURIComponent(decodeURIComponent(m))}catch(e){try{return decodeURIComponent(m)}catch(x){return m}}});
  const out=[],re=/spreadsheets\/d\/([A-Za-z0-9_-]{20,})([^"\s,\]]*)/g;let m;
  while((m=re.exec(s))){const g=(m[2].match(/[#&?]gid=(\d+)/)||[])[1]||null;const ex=out.find(x=>x.id===m[1]);if(ex){if(g)ex.gid=g}else out.push({id:m[1],gid:g})}
  return out;
}
function sheetIdOf(v){const l=linksOf(v);return l.length?l[0].id:null}
function slugOf(n){return norm(n).replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"atleta"}
function sedeOf(tag,src){if(src==="vf")return"kineva";tag=String(tag||"");return /STENIKA/i.test(tag)?"stenika":/ONLINE|MESI/i.test(tag)?"online":"altro"}
function fromCoachRow(r){
  return{src:"coach",id:nid(r.url),name:String(r["Nome Cognome"]||"Senza nome").trim(),tag:String(r["Multi-select"]||""),
    status:r["Status programma"]||"—",start:r["date:Data inizio:start"]||null,dur:parseInt(r["Durata scheda"],10)||null,
    subStart:r["date:Inizio abbonamento:start"]||null,sheetLinks:linksOf(r["Training Program"]),
    notionUrl:r.url,analisiUrl:r["Analisi allenamento"]||null};
}
function fromVFRow(r){
  return{src:"vf",id:nid(r.url),name:String(r["Nome Cognome"]||"Senza nome").trim(),tag:"Kineva",status:r["Stato"]||"—",
    start:r["date:Inizio programma:start"]||null,dur:null,firstEval:r["date:Data prima valutazione:start"]||null,
    sheetLinks:linksOf(r["Scheda"]),valId:sheetIdOf(r["Valutazione"]),notionUrl:r.url,videoUrl:r["Cartella video Drive"]||null};
}
const SEDE={stenika:"Stenika",online:"Online",kineva:"Kineva",altro:"Da classificare"};
function finalize(list){
  const used={};
  return list.filter(a=>a&&a.id).map(a=>{
    if(!a.sheetLinks)a.sheetLinks=a.sheetId?[{id:a.sheetId,gid:a.sheetGid||null}]:[];
    if(!a.sheetId&&a.sheetLinks.length){const l=a.sheetLinks[a.sheetLinks.length-1];a.sheetId=l.id;a.sheetGid=l.gid}
    if(a.sheetId&&!a.sheetGid){const l=a.sheetLinks.find(x=>x.id===a.sheetId);if(l)a.sheetGid=l.gid}
    a.sede=sedeOf(a.tag,a.src);a.startD=pd(a.start);a.subD=pd(a.subStart);a.evalD=pd(a.firstEval);
    a.wk=weekInfo(a.startD,a.dur);a.active=a.status!=="Fine collaborazione";
    let s=slugOf(a.name);if(used[s])s+="-"+(a.src==="vf"?"kineva":++used[s]);used[s]=1;a.slug=s;
    a.ini=a.name.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase();
    return a;
  });
}
function linkIds(a){const ids=(a.sheetLinks||[]).map(l=>l.id);if(a.sheetId&&!ids.includes(a.sheetId))ids.push(a.sheetId);return ids}
const NOT_SCHEDA=/(foglio ore|modulo|anagrafica|trattament|massagg|fattura|\bore_|\bsergio\b|layout|\bprove\b|copia di|copy of)/;
function surname(n){const p=String(n).trim().split(/\s+/);return p[p.length-1]||n}
const byId=id=>S.athletes.find(a=>a.id===id);

/* ================= lettura fogli ================= */
// Riconosce: template Serkis (G1 · ESERCIZIO · SCHEMA E REST · NOTE · FEEDBACK S1–S6),
// schede vecchie (GIORNO N · ESERCIZIO - SERIE x REP/TEMPO con esercizio e schema nella stessa cella,
// feedback ➊–➏ anche su colonne senza intestazione, oppure colonne "Sett #N"), schede VF, test e valutazioni.
function isHdrCell(c){const u=String(c||"").trim().toUpperCase();return u==="VOCE"||(u.startsWith("ESERCIZIO")&&u.length<=40)}
function colKey(label){
  const u=label.toUpperCase().trim();
  if(u.startsWith("ESERCIZIO"))return /SERIE|REP|SCHEMA/.test(u)?"exs":"ex";
  if(u==="VOCE")return"ex";
  if(u.startsWith("SCHEMA")||/^(SET|SERIE)\s*[X×]\s*(REP|RIP)/.test(u))return"schema";if(u.startsWith("NOTE"))return"note";if(u.startsWith("FEEDBACK"))return"fb";
  if(/^SETT(IMANA)?\.?\s*#?\s*\d+$/.test(u))return"fb";
  if(u.startsWith("PROTOCOLLO"))return"prot";if(u.startsWith("RISULTATO"))return"ris";if(u==="SERIE")return"serie";
  if(u.startsWith("RIP"))return"rip";if(u.startsWith("RECUPERO"))return"rec";if(u.startsWith("TIPOLOGIA"))return"tipo";
  return"x";
}
const MONO={schema:1,serie:1,rip:1,rec:1,ris:1,exs:1};
function slotTitle(t){const m=String(t).trim().match(/^(G|D|DAY|GIORNO|SEDUTA)\s*(\w+)$/i);if(!m)return t;const k=m[1].toUpperCase();return(k==="G"||k==="GIORNO"?"Giorno ":k==="SEDUTA"?"Seduta ":"Day ")+m[2]}
const METH=/^(?:\d+\s*[x×]?\s*)?(jump\s*set|super\s*set|superserie|giant\s*set|drop\s*set|circuito|e\d*["″'’′]?mom|amrap|ladder|cluster|ramping|tabata|blocco|accumulo|density|rest[\s-]*pause|rt\b|rxt\b|rest\b|recuper|poi fai|dopo |riscald|defatic|finisher|round\b)/i;
// blocchi a tempo o a giri (AMRAP, EMOM, circuiti): niente grafico dei kg
const BLOCK=/^(amrap|e\d*["″'’′]?mom|circuito|tabata|round\b|finisher|density|accumulo)/i;
function isNameLine(l){
  if(!l||l.length>48||/^[-–(•*➊-➓①-⑩❶-❿]/.test(l))return false;
  if(/\d\s*[x×]\s*\(?\d/.test(l)||/kg\b/i.test(l)||/\d+\s*["'″′]/.test(l)||METH.test(l))return false;
  return /^[A-ZÀ-Ü][A-ZÀ-Ü ]{2,}/.test(l);
}
function splitExercises(text){
  const out=[];let cur=null;
  String(text||"").split("\n").map(s=>s.trim()).forEach(l=>{
    if(!l)return;
    const m=l.match(/^([A-ZÀ-Ü][A-ZÀ-Ü0-9 '’.\/&+]{1,40}?)\s*:\s*(.+)$/);
    if(m&&!METH.test(m[1])){cur={name:m[1].trim(),plan:[m[2]]};out.push(cur);return}
    if(isNameLine(l)){cur={name:l,plan:[]};out.push(cur);return}
    if(!cur){cur={name:"",plan:[]};out.push(cur)}
    cur.plan.push(l);
  });
  return out.filter(e=>e.name||e.plan.length);
}
function exLabel(sec,it){
  if(sec.cols.some(c=>c.key==="exs")){const n=splitExercises(it.ex).map(e=>e.name).filter(Boolean);if(n.length)return n.join(" + ")}
  const ls=it.ex.split("\n").map(s=>s.trim()).filter(Boolean);if(ls[0]&&BLOCK.test(ls[0]))return ls[0];
  return ls.find(l=>!METH.test(l)&&l!=="+"&&!/^ss$/i.test(l))||ls[0]||it.ex;
}
function metaDate(rows){
  for(let r=0;r<Math.min(14,rows.length);r++){
    const row=rows[r];if(!row.some(c=>/training program|periodo|data\b/i.test(c)))continue;
    for(const c of row){const d=parseIt(c);if(d)return d}
  }
  for(let r=0;r<Math.min(14,rows.length);r++)for(const c of rows[r]){if(c.length<=40){const d=parseIt(c);if(d)return d}}
  return null;
}
function sanePlanDate(d){
  if(!d)return d;const hi=Date.now()+400*864e5;if(+d<=hi)return d;
  for(const k of[900,100,10,1]){const c=new Date(d);c.setFullYear(d.getFullYear()-k);if(+c<=hi&&c.getFullYear()>=2015)return c}
  return d;
}
function parseSheet(values){
  const rows=(values||[]).map(r=>(r||[]).map(c=>String(c==null?"":c)));
  const out={sections:[],meta:{},hasFeedback:false,kind:"altro"};
  for(let r=0;r<Math.min(12,rows.length);r++){
    rows[r].forEach((c,ci)=>{
      const t=c.trim(),u=t.toUpperCase();let m;
      if((m=t.match(/^Periodo:\s*(.+)$/i)))out.meta.periodo=m[1];
      else if((m=t.match(/^(?:Nome|Atleta|Atelta):\s*(.+)$/i)))out.meta.nome=m[1].trim();
      else if(u==="NOME"||u==="PERIODO"||u==="DATA"){const v=(rows[r].slice(ci+1).find(x=>x.trim())||"").trim();const k=u.toLowerCase();if(v&&!["NOME","PERIODO","DATA"].includes(v.toUpperCase()))out.meta[k]=v}
      else if(/^PROGRAMMA DI ALLENAMENTO\s*#?\s*\d+/i.test(t))out.meta.numero=t.replace(/^PROGRAMMA DI ALLENAMENTO\s*/i,"");
    });
  }
  out.meta.when=sanePlanDate(parseIt(out.meta.periodo)||parseIt(out.meta.data)||metaDate(rows));
  let i=0;
  while(i<rows.length){
    const row=rows[i];const exCol=row.findIndex(isHdrCell);
    if(exCol===-1){i++;continue}
    let slotCol=-1,title="";const cols=[];
    for(let c=0;c<row.length;c++){
      const t=row[c].trim();if(!t)continue;
      if(c<exCol&&/^(G|D|DAY|GIORNO|SEDUTA)?\s*\d{0,2}$/i.test(t)&&t.length<=8){slotCol=c;title=slotTitle(t);continue}
      const key=colKey(t);
      const adjacent=(row[c-1]||"").trim()||(row[c+1]||"").trim();
      if(key!=="x"||adjacent||c===exCol)cols.push({c,label:t,key,week:key==="fb"?((t.match(/(\d+)\s*$/)||[])[1]?+(t.match(/(\d+)\s*$/)[1]):null):null});
    }
    if(slotCol<0&&exCol>0&&!row[exCol-1].trim())slotCol=exCol-1;
    if(!title){
      for(let j=i-1;j>=0&&j>=i-3;j--){const f=rows[j].find(x=>x.trim());if(!f)continue;const t=f.trim();
        if(t.length<=60&&!/^(NOME|DATA|PERIODO)\b/i.test(t)&&!t.includes(":")&&!/^[─—-]+/.test(t)&&!/^➍|giornata no/i.test(t)){title=t;break}}
    }
    const hdrRow=i+1,lo=Math.min(...cols.map(c=>c.c)),hi=Math.max(...cols.map(c=>c.c));
    // righe della sezione
    const secRows=[];let freeAfter=[];
    i++;
    while(i<rows.length){
      const rr=rows[i];
      if(!rr.slice(lo,hi+1).some(c=>c.trim())){
        let k=0;while(i+k<rows.length&&!(rows[i+k]||[]).slice(lo,hi+1).some(c=>String(c).trim()))k++;
        if(k>=3&&i+k<rows.length&&slotCol<0)for(let j=0;j<Math.min(k-1,12);j++)freeAfter.push(i+j);
        break;
      }
      if(rr.some(isHdrCell))break;
      if(/^(COME COMPILARE|METODI|▤|NOTA BENE|OSSERVAZIONI GENERALI|EMOM:|AMRAP:)/i.test((rr.find(c=>c.trim())||"").trim()))break;
      secRows.push(i);i++;
    }
    // colonne senza intestazione: prendono il tipo della colonna a sinistra (schema su più colonne, feedback ➍–➏ a destra di FEEDBACK)
    {const lastHdr=cols[cols.length-1];let maxC=hi;
      if(lastHdr&&lastHdr.key==="fb")secRows.forEach(r=>{rows[r].forEach((c,ci)=>{if(c.trim()&&ci>maxC&&ci<=hi+4)maxC=ci})});
      for(let c=lo+1;c<=maxC;c++){
        if(cols.some(x=>x.c===c)||(row[c]||"").trim()||!secRows.some(r=>(rows[r][c]||"").trim()))continue;
        const left=cols.filter(x=>x.c<c).sort((x,y)=>y.c-x.c)[0];if(!left)continue;
        if(left.key==="fb")cols.push({c,label:"FEEDBACK",key:"fb",week:null,extra:true});
        else if(left.key==="schema"||(left.key==="exs"&&c===left.c+1))cols.push({c,label:(left.key==="exs"?"SCHEMA":left.label.replace(/\s*\(\d+\)$/,""))+" (2)",key:"schema",extra:true});
      }
      cols.sort((x,y)=>x.c-y.c);
    }
    if(cols.some(x=>x.key==="prot")&&!cols.some(x=>x.key==="ris"))cols.forEach(x=>{if(x.key==="prot")x.key="schema"});
    const sec={title:title||"Sezione",hr:hdrRow,cols,slotCol,exCol,items:[],kind:"altro"};
    const keys=cols.map(c=>c.key);
    sec.kind=keys.includes("ris")?"test":(keys.includes("schema")||keys.includes("serie")||keys.includes("exs"))?"scheda":"altro";
    if(keys.includes("fb"))out.hasFeedback=true;
    const mk=r=>{const rr=rows[r]||[];const cells={};cols.forEach(col=>{cells[col.c]=rr[col.c]||""});const ex=(rr[exCol]||"").trim();
      const it={r:r+1,cells,ex,empty:!ex,slot:slotCol>=0?(rr[slotCol]||"").trim():""};
      it.fb=[];cols.filter(c=>c.key==="fb").forEach(c=>{const v=cells[c.c];if(!String(v).trim())return;
        if(c.week){const t=String(v).trim();it.fb.push({week:c.week,text:t,tone:tone(t)})}else it.fb.push(...splitFeedback(v))});
      it.fb.sort((a,b)=>(a.week||0)-(b.week||0));return it};
    secRows.forEach(r=>sec.items.push(mk(r)));
    freeAfter.forEach(r=>{const cells={};cols.forEach(col=>{cells[col.c]=""});sec.items.push({r:r+1,cells,ex:"",empty:true,slot:"",fb:[]})});
    out.sections.push(sec);
  }
  const kinds=out.sections.map(s=>s.kind);
  out.kind=kinds.includes("scheda")?"scheda":kinds.includes("test")?"test":kinds.length?"altro":"vuoto";
  return out;
}
function cellOf(sec,it,key){const c=sec.cols.find(x=>x.key===key);return c?(it.cells[c.c]||"").trim():""}
const RED=/(dolor|fastidi|infortun|\bmale\b|fa male|mal di|pain|hurt|injur|strapp|contrattur|infiamm|formicol)/i;
const YEL=/(tost|difficil|durissim|pesant|stanc|\bcott[oa]\b|troppo|non riesc|non (sono )?riuscit|saltat|\bhard\b|tough|bloccat|fatica alta|faticos|crampi|cedut|calant)/i;
const GRN=/(facil|\bbene\b|meglio|easy|good|\bok\b|\bfine\b|ottim|tranquill|sciolt|\btop\b)/i;
function tone(t){const s=String(t||"").replace(/non male/ig,"");if(RED.test(s))return"bad";if(YEL.test(s))return"warn";if(GRN.test(s))return"ok";return""}
const CIRC={"➊":1,"➋":2,"➌":3,"➍":4,"➎":5,"➏":6,"➐":7,"➑":8,"➒":9,"➓":10,"①":1,"②":2,"③":3,"④":4,"⑤":5,"⑥":6,"⑦":7,"⑧":8,"⑨":9,"⑩":10,"❶":1,"❷":2,"❸":3,"❹":4,"❺":5,"❻":6,"❼":7,"❽":8,"❾":9,"❿":10};
function splitFeedback(txt){
  txt=String(txt||"").replace(/[➊-➓①-⑩❶-❿]/g,c=>" W"+CIRC[c]+": ");if(!txt.trim())return[];
  const re=/(^|[\s;,(|.])((?:week|wk|sett(?:imana)?\.?)\s*#?\s*(\d{1,2})\b\s*[-–—:.)]?|(?:w|s)\s?(\d{1,2})\s*[-–—:.)]|(\d{1,2})\s*°?\s*sett(?:imana|\.)?\b\s*[-–—:.)]?|(prima|seconda|terza|quarta|quinta|sesta|settima|ottava)\s+sett(?:imana)?\b\s*[-–—:.)]?)/gi;
  const ORD={prima:1,seconda:2,terza:3,quarta:4,quinta:5,sesta:6,settima:7,ottava:8};
  const marks=[];let m;
  while((m=re.exec(txt))){const w=+(m[3]||m[4]||m[5])||ORD[String(m[6]||"").toLowerCase()];if(w&&w<=12)marks.push({i:m.index+m[1].length,end:m.index+m[0].length,w})}
  if(!marks.length){const t=txt.trim();return[{week:null,text:t,tone:tone(t)}]}
  const res=[];const pre=txt.slice(0,marks[0].i).trim();if(pre)res.push({week:null,text:pre,tone:tone(pre)});
  marks.forEach((mk,k)=>{const b=k+1<marks.length?marks[k+1].i:txt.length;const t=txt.slice(mk.end,b).replace(/^[\s;,.|:\-–]+|[\s;,|]+$/g,"").trim();res.push({week:mk.w,text:t,tone:tone(t)})});
  return res;
}
function analyze(P){
  const weeks=new Set(),flags=[];
  P.sections.forEach(sec=>sec.items.forEach(it=>{if(it.empty)return;
    it.fb.forEach(f=>{if(f.week&&f.text)weeks.add(f.week);if(f.text&&(f.tone==="bad"||f.tone==="warn"))flags.push({ex:exLabel(sec,it),week:f.week,tone:f.tone,text:f.text})})}));
  return{lastFb:weeks.size?Math.max(...weeks):0,flags};
}
function kgOf(pt){
  const m=pt.match(/(?:\+|@)\s*(\d+(?:[.,]\d+)?)(?:\s*[\/\-–]\s*(\d+(?:[.,]\d+)?))?\s*kg/i)||pt.match(/(\d+(?:[.,]\d+)?)(?:\s*[\/\-–]\s*(\d+(?:[.,]\d+)?))?\s*kg/i);
  if(!m)return null;const a=parseFloat(m[1].replace(",",".")),b=m[2]?parseFloat(m[2].replace(",",".")):a;return Math.max(a,b);
}
function parsePlan(schema){
  const entries=[];let autoW=0;
  String(schema||"").split("\n").forEach(line=>{
    const parts=line.split("//").map(s=>s.trim()).filter(Boolean),found=[];
    parts.forEach((pt,pi)=>{
      if(/^(-?\s*rest|rxt|recupero)\b/i.test(pt))return;
      const wm=pt.match(/sett\.?\s*(\d{1,2})(?:\s*[-–\/]\s*(\d{1,2}))?/i);
      const body=pt.replace(/\(?\s*sett\.?\s*\d{1,2}(?:\s*[-–\/]\s*\d{1,2})?\s*\)?/i,"").trim();
      const srs=[...body.matchAll(/(\d{1,2})\s*(?:set|serie)?\s*[x×]\s*\(?\s*(\d{1,3})(?:\s*[-–\/]\s*(\d{1,3}))?/gi)];
      let sets=srs.reduce((a,x)=>a+(+x[1]),0),reps=srs.length?+srs[0][2]:0;
      if(!srs.length){const dm=body.match(/^(\d{1,2})(?:\s*-\s*(\d{1,2})){1,9}\b/);if(dm){const ns=dm[0].split("-").map(Number);sets=ns.length;reps=ns[0]}}
      if(!sets){const em=body.match(/E\d*["″'’′]?MOM\s*:?\s*(\d{1,2})\s*['’′]/i);if(em){sets=+em[1];const r=body.match(/[x×]\s*(\d{1,3})\s*rep/i)||body.match(/(\d{1,3})\s*rep/i);reps=r?+r[1]:0}}
      if(!sets){const g=body.match(/[x×]\s*(\d{1,2})(?:\s*[\/\-–]\s*(\d{1,2}))?\s*giri/i);if(g){sets=+(g[2]||g[1]);const cl=body.match(/\(\s*(\d{1,2}(?:\s*\+\s*\d{1,2})+)\s*\)/);reps=cl?cl[1].split("+").reduce((a,x)=>a+(+x),0):0}}
      const kg=kgOf(body);
      if(!sets&&kg==null)return;
      found.push({pi,w1:wm?+wm[1]:null,w2:wm?+(wm[2]||wm[1]):null,sets,reps,kg});
    });
    if(parts.length>1&&found.length&&found.every(e=>e.w1==null)){found.forEach(e=>{e.w1=e.w2=autoW+e.pi+1});autoW+=parts.length}
    entries.push(...found);
  });
  // carico scritto una sola volta (es. "+80 kg" e sotto "Sett. 1: 4 x 6"): vale per le righe senza kg
  const base=[...new Set(entries.filter(e=>!e.sets&&e.kg!=null).map(e=>e.kg))];
  if(base.length===1)entries.forEach(e=>{if(e.sets&&e.kg==null)e.kg=base[0]});
  return{entries};
}
function planUnits(sec,it){
  const scs=sec.cols.filter(c=>c.key==="schema"),exs=sec.cols.find(c=>c.key==="exs");
  if(scs.length){
    const texts=scs.map(c=>String(it.cells[c.c]||"")).filter(t=>t.trim());const out=[];
    texts.forEach(t=>{const parts=splitExercises(t),named=parts.filter(p=>p.name);
      if(named.length&&(texts.length>1||named.length>1||parts.length===1))named.forEach(p=>out.push({label:p.name,text:p.plan.join("\n")}));
      else{const f=t.split("\n").map(x=>x.trim()).find(Boolean)||"";out.push({label:texts.length>1&&f&&f.length<=48&&!parsePlan(f).entries.length?f:exLabel(sec,it),text:t})}});
    if(exs&&!out.length)return planUnits({cols:sec.cols.filter(c=>c.key!=="schema")},it);
    return out.length?out:[{label:exLabel(sec,it),text:""}];
  }
  const se=sec.cols.find(c=>c.key==="serie");
  if(se&&!exs){const ri=sec.cols.find(c=>c.key==="rip");const n=String(it.cells[se.c]||"").trim();return n?[{label:exLabel(sec,it),text:n+" x "+(ri?String(it.cells[ri.c]||"").trim():"")}]:[]}
  if(exs){const parts=splitExercises(it.cells[exs.c]);const named=parts.filter(p=>p.name);
    if(!named.length)return[{label:exLabel(sec,it),text:it.cells[exs.c]}];
    return named.map(p=>({label:p.name,text:p.plan.join("\n")}))}
  return[];
}
function planFor(P,D){
  const ex=[],skipped=[],weekly=Array.from({length:D},(_,i)=>({w:i+1,sets:0,ton:0}));
  P.sections.forEach(sec=>sec.items.forEach(it=>{if(it.empty)return;
    planUnits(sec,it).forEach(u=>{
      const pl=parsePlan(u.text);
      if(!pl.entries.length){skipped.push(u.label+" ("+sec.title+")");return}
      const perW=[];
      for(let w=1;w<=D;w++){
        const es=pl.entries.filter(e=>e.w1==null||(w>=e.w1&&w<=e.w2));
        if(!es.length){perW.push(null);continue}
        const sets=es.reduce((a,e)=>a+e.sets,0),ton=es.reduce((a,e)=>a+e.sets*e.reps*(e.kg||0),0),kgs=es.filter(e=>e.kg!=null).map(e=>e.kg);
        perW.push({sets,ton,kg:kgs.length?Math.max(...kgs):null});weekly[w-1].sets+=sets;weekly[w-1].ton+=ton;
      }
      ex.push({label:u.label,where:sec.title,perW,hasKg:!BLOCK.test(String(u.label).trim())&&perW.some(p=>p&&p.kg!=null)});
    })}));
  return{ex,weekly,skipped};
}
function maxWeek(P){let m=0;P.sections.forEach(s=>s.items.forEach(it=>{if(!it.empty)planUnits(s,it).forEach(u=>parsePlan(u.text).entries.forEach(e=>{if(e.w2)m=Math.max(m,e.w2)}))}));return m}
function hasPlan(P){return P.sections.some(s=>s.kind==="scheda"&&s.cols.some(c=>c.key==="schema"||c.key==="exs"||c.key==="serie"))}
// stesso esercizio con nomi diversi tra le schede: "Squat fermo 1\" in buca", "SQUAT BILANCIERE", "Squat tecnico" → squat
function exKey(label){
  let t=norm(String(label||"").split("\n")[0]).replace(/\(.*?\)/g," ");
  t=t.split(/\b(?:fermo|pausa|iso|discesa|salita|tempo|deadstop|con|per|da)\b|[0-9"'″′:@+]/)[0];
  return t.replace(/\b(bilanciere|manubri|manubrio|kb|kettlebell|tecnico|tecnica|alla|al|fronte|parallele|mono|in|loop|gialla|azzurra|arancione|rossa|verde|nera|viola|elastico|cubo|bw)\b/g," ").replace(/[^a-z0-9]+/g," ").trim();
}

function monthOfTab(n){n=norm(n);for(let i=0;i<12;i++)if(new RegExp("(^|[^a-z])"+MESI[i].slice(0,3)).test(n))return i;return /estate/.test(n)?6:null}
function numOfTab(n){const m=String(n).match(/#\s*0*(\d{1,2})|\b(?:scheda|programmazione|programma)\s*[-–]?\s*0*(\d{1,2})\b/i);return m?+(m[1]||m[2]):null}
// Date delle schede in un file: corregge anni sbagliati e stima quelle mancanti (mese nel nome del foglio, ordine dei fogli, date del file)
function inferDates(fm,items){
  const DAY=864e5,now=Date.now(),cr=fm.created?+new Date(fm.created):null,up=fm.updated?+new Date(fm.updated):null;
  const lo=cr?cr-150*DAY:now-6*365*DAY,hi=Math.max(up||0,now)+60*DAY;
  items.forEach(t=>{if(!t.when)return;const y=t.when.getFullYear();
    for(const k of[0,1,2,-1,-10,-100,-900]){const c=new Date(t.when);c.setFullYear(y+k);if(+c>=lo&&+c<=hi){if(k)t.fixed=true;t.when=c;return}}});
  if(up)items.forEach(t=>{if(t.when&&+t.when>up+45*DAY){t.when=null;t.fixed=true}});
  items.forEach(t=>{if(t.when)return;const mo=monthOfTab(t.name);if(mo==null)return;
    const ref=new Date(Math.min(up||now,now));for(let y=ref.getFullYear();y>=ref.getFullYear()-3;y--){const c=new Date(y,mo,1);if(+c<=hi&&+c>=lo){t.when=c;t.approx=true;return}}});
  const known=items.filter(t=>t.when).sort((x,y)=>x.idx-y.idx);let asc=true;
  if(known.length>=2&&+known[0].when!==+known[known.length-1].when)asc=+known[known.length-1].when>+known[0].when;
  else{const nb=items.filter(t=>t.num!=null).sort((x,y)=>x.idx-y.idx);if(nb.length>=2)asc=nb[nb.length-1].num>nb[0].num}
  const seq=items.slice().sort((x,y)=>asc?x.idx-y.idx:y.idx-x.idx),STEP=42*DAY;
  seq.forEach((t,i)=>{if(t.when)return;
    let p=-1,n=-1;for(let j=i-1;j>=0;j--)if(seq[j].when&&!seq[j].est){p=j;break}for(let j=i+1;j<seq.length;j++)if(seq[j].when){n=j;break}
    let v;
    if(p>=0&&n>=0)v=+seq[p].when+(+seq[n].when-+seq[p].when)*(i-p)/(n-p);
    else if(p>=0)v=Math.min(+seq[p].when+STEP*(i-p),Math.max(+seq[p].when+DAY*(i-p),up||now));
    else if(n>=0)v=Math.max(+seq[n].when-STEP*(n-i),cr||-Infinity);
    else if(cr&&up&&seq.length>1)v=cr+(up-cr)*i/(seq.length-1);
    else v=cr?cr+STEP*i:(up||now)-STEP*(seq.length-1-i);
    t.when=new Date(v);t.approx=true;t.est=true});
  return items;
}
/* ================= segnale ================= */
function coachSignal(id){const n=S.notes.find(x=>x.athleteId===id&&x.kind==="segnale");return n&&n.signal&&n.signal!=="auto"?n:null}
function shOf(a){return S.sheets[a.id]}
function autoSignal(a){
  if(!a.active)return{level:"none",reasons:["Collaborazione finita"]};
  if(!a.sheetId)return{level:"none",reasons:["Nessuna scheda collegata in Notion"]};
  const sh=shOf(a);
  if(!sh||sh.status==="loading"||sh.status==="queued")return{level:"none",reasons:["Leggo la scheda…"]};
  if(sh.status==="error")return{level:"none",reasons:["Non riesco a leggere la scheda"]};
  if(!sh.P.hasFeedback)return{level:"none",reasons:["La scheda non ha una colonna feedback"]};
  const an=sh.an,wk=a.wk?a.wk.week:0,done=Math.min(wk-1,a.dur||wk-1),reasons=[];let level="ok";
  const reds=an.flags.filter(f=>f.tone==="bad"),recent=reds.filter(f=>f.week==null||f.week>=Math.max(1,an.lastFb-1));
  if(recent.length){level="bad";reasons.push("Dolore o fastidio nel feedback: "+recent[0].ex+(recent[0].week?" (S"+recent[0].week+")":""))}
  else if(reds.length){level="warn";reasons.push("Fastidio citato in passato: "+reds[0].ex+(reds[0].week?" (S"+reds[0].week+")":""))}
  const hard=an.flags.filter(f=>f.tone==="warn"&&f.week&&f.week===an.lastFb);
  if(hard.length>=2){if(level==="ok")level="warn";reasons.push(hard.length+" esercizi faticosi in S"+an.lastFb+": "+hard.slice(0,3).map(f=>f.ex).join(", "))}
  if(done>=1){
    if(!an.lastFb){if(level==="ok")level="warn";reasons.push("Nessun feedback scritto in scheda")}
    else if(done-an.lastFb>=2){if(level==="ok")level="warn";reasons.push("Feedback fermo alla S"+an.lastFb+" (siamo alla S"+wk+")")}
    else if(done-an.lastFb===1)reasons.push("Manca ancora il feedback della S"+done);
  }
  if(!reasons.length)reasons.push(an.lastFb?"Feedback regolare fino alla S"+an.lastFb:"Scheda appena iniziata");
  return{level,reasons};
}
function signalOf(a){const c=coachSignal(a.id);if(c)return{level:c.signal,reasons:[c.text||"Segnale impostato da te"],manual:true,date:c.createdAt};return autoSignal(a)}
const LV={ok:"Va bene",warn:"Da guardare",bad:"Attenzione",none:"Senza dati"};
const isTest=a=>a.status==="Mandare test/testare";
const isTodo=a=>a.status==="Da fare"||a.status==="In coda";
function urgency(a){
  if(!a.active)return 20;let u=9;const sc=a.wk&&a.wk.scad,sg=signalOf(a).level;
  if(sc)u=Math.min(u,sc.rank);if(sg==="bad")u=Math.min(u,1.5);if(isTest(a))u=Math.min(u,3);if(sg==="warn")u=Math.min(u,3.5);if(isTodo(a))u=Math.min(u,4);return u;
}
function visible(){
  const f=S.filter,q=norm(f.q);
  const L=S.athletes.filter(a=>{
    if(f.sede!=="all"&&a.sede!==f.sede)return false;
    const st=f.stato;
    if(!f.focus){
      if(st==="attivi"&&!a.active)return false;if(st==="in-corso"&&a.status!=="In corso")return false;
      if(st==="da-fare"&&!isTodo(a))return false;if(st==="test"&&!isTest(a))return false;if(st==="finiti"&&a.active)return false;
    }else{
      if(!a.active)return false;
      if(f.focus==="schede"&&!(a.wk&&a.wk.scad))return false;
      if(f.focus==="test"&&!(isTest(a)||isTodo(a)))return false;
      if(f.focus==="guardare"&&!["warn","bad"].includes(signalOf(a).level))return false;
      if(f.focus==="kineva"&&a.sede!=="kineva")return false;
    }
    if(q&&!norm([a.name,SEDE[a.sede],a.tag,a.status].join(" ")).includes(q))return false;
    return true;
  });
  L.sort((x,y)=>{
    if(S.sort==="urgenza"){const d=urgency(x)-urgency(y);if(d)return d}
    if(S.sort==="fine"){const ex=x.wk&&x.wk.end?x.wk.end.getTime():Infinity,ey=y.wk&&y.wk.end?y.wk.end.getTime():Infinity;if(ex!==ey)return ex-ey}
    return x.name.localeCompare(y.name,"it");
  });
  return L;
}

/* ================= collegamento dati ================= */
function payloadOf(res){let p=res&&res.payload;if(typeof p==="string"){try{p=JSON.parse(p)}catch(e){}}return p}
function colL(c){let s="";c++;while(c>0){const m=(c-1)%26;s=String.fromCharCode(65+m)+s;c=Math.floor((c-1)/26)}return s}
function safeVal(v){v=String(v==null?"":v);if(/^[=+\-@]/.test(v)||/^[\d\s.,:\/\-]+$/.test(v.trim())&&v.trim())return"'"+v;return v}
function A1tab(t){return t?"'"+String(t).replace(/'/g,"''")+"'!":""}
const same=(a,b)=>String(a||"").replace(/\r/g,"").trim()===String(b||"").replace(/\r/g,"").trim();
function classifyTpl(t){
  if(/ANTEPRIMA|BOZZA|ARCHIVIO|EDITORIAL/i.test(t))return null;
  if(/TEST TEMPLATE.*ONLINE/i.test(t))return"test-online";
  if(/TEST TEMPLATE.*PRESENZA/i.test(t))return"test-presenza";
  if(/VALUTAZIONE/i.test(t))return"vf";
  if(/TRAINING TEMPLATE/i.test(t))return"scheda";
  return null;
}
function noteRow(n){return[n.id,n.createdAt,n.athleteId,n.athleteName,n.kind,n.week==null?"":String(n.week),n.signal||"",n.text||""]}
function rowNote(r,idx){const n={id:r[0],createdAt:r[1],athleteId:r[2],athleteName:r[3],kind:r[4],week:r[5]?parseInt(r[5],10)||null:null,signal:r[6]||null,text:(r[7]||"").replace(/^ (?=[=+\-@])/,""),row:idx+1};return n}

function scriptAdapter(cfg){
  async function call(action,payload,timeout){
    const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),timeout||60000);let res;
    try{res=await fetch(cfg.url,{method:"POST",body:JSON.stringify(Object.assign({key:cfg.key,action},payload||{})),headers:{"Content-Type":"text/plain;charset=utf-8"},redirect:"follow",signal:ctl.signal})}
    catch(e){throw{code:e&&e.name==="AbortError"?"timeout":"network",message:String(e&&e.message||e)}}
    finally{clearTimeout(t)}
    let j;try{j=await res.json()}catch(e){throw{code:"bad_response",message:"Il backend ha risposto in modo inatteso ("+res.status+")."}}
    if(j&&j.error)throw{code:j.code||"backend",message:j.error};
    return j;
  }
  return{
    kind:"script",batch:6,caps:{ai:false,notionWrite:true},
    ping:()=>call("ping",{},20000),
    athletes:async fresh=>(await call("athletes",{fresh})).athletes,
    sheets:async(ids,fresh,gids)=>(await call("sheets",{ids,fresh,gids:gids||{}})).sheets,
    sheet:async(id,tab,fresh,gid)=>{const g={};if(gid&&!tab)g[id]=gid;const r=(await call("sheets",{ids:[id],tab,fresh,gids:g})).sheets[id];if(!r||r.error)throw{code:"sheet",message:r?r.error:"File non trovato"};return r},
    tabs:async id=>{const r=(await call("sheets",{ids:[id]})).sheets[id];if(!r||r.error)throw{code:"sheet",message:r?r.error:"File non trovato"};return(r.tabs||[]).map((n,i)=>({name:n,gid:r.gids?String(r.gids[i]):null}))},
    files:async a=>(await call("files",{name:a.name,ids:linkIds(a)})).files,
    bundle:async(ids,o)=>(await call("bundle",Object.assign({ids},o||{}),120000)).files,
    page:async a=>(await call("page",{id:a.id})).text,
    update:(sheetId,tab,cells)=>call("update",{sheetId,tab,cells}),
    templates:async()=>(await call("templates")).templates,
    create:req=>call("create",req,120000),
    notes:async()=>(await call("notes")).notes,
    noteAdd:async n=>(await call("noteAdd",{note:n})).note,
    noteDel:n=>call("noteDel",{id:n.id})
  };
}
function claudeAdapter(mcp,sample){
  async function rd(srv,tool,input,fresh,stale){
    const cache=fresh?{refresh:true,staleTime:0,gcTime:86400000}:{staleTime:stale==null?120000:stale,gcTime:86400000};
    try{return payloadOf(await mcp.callTool(srv,tool,input,{cache}))}
    catch(e){if(e&&e.retryable){await sleep(Math.min(e.retryAfterMs||1500,8000)+Math.random()*600);return payloadOf(await mcp.callTool(srv,tool,input,{cache}))}throw e}
  }
  const wr=async(srv,tool,input)=>payloadOf(await mcp.callTool(srv,tool,input,{cache:false}));
  async function tabs(id){const m=await rd("Google Sheets","get_spreadsheet",{spreadsheetId:id,fields:["sheets.properties.title","sheets.properties.sheetId"]},false,600000);return((m&&m.sheets)||[]).map(s=>({name:s.properties.title,gid:String(s.properties.sheetId)}))}
  async function sheet(id,tab,fresh,gid){
    if(!tab&&gid){try{const t=(await tabs(id)).find(x=>x.gid===String(gid));if(t)tab=t.name}catch(e){}}
    const v=await rd("Google Sheets","get_values",{spreadsheetId:id,range:A1tab(tab)+"A1:L220"},fresh,60000);
    let t=String((v&&v.range)||"").split("!")[0];t=t.replace(/^'|'$/g,"").replace(/''/g,"'");
    return{id,tab:t||tab||"",values:(v&&v.values)||[],url:"https://docs.google.com/spreadsheets/d/"+id+"/edit"};
  }
  async function notesRead(){const v=await rd("Google Sheets","get_values",{spreadsheetId:NOTES_ID,range:"A1:H5000"},true);return((v&&v.values)||[]).map((r,i)=>i&&r&&r[0]?rowNote(r,i):null).filter(Boolean)}
  return{
    kind:"claude",batch:1,caps:{ai:!!sample,notionWrite:false},sample,
    athletes:async fresh=>{
      const c=await rd("Notion","notion-query-data-sources",{data:{mode:"rows",data_source_url:DS_COACH,limit:100}},fresh);
      let v=null;try{v=await rd("Notion","notion-query-data-sources",{data:{mode:"rows",data_source_url:DS_VF,limit:100}},fresh)}catch(e){}
      const list=((c&&c.results)||[]).map(fromCoachRow).concat(((v&&v.results)||[]).map(fromVFRow));
      await Promise.all(list.filter(a=>a.sheetLinks&&a.sheetLinks.length>1).map(async a=>{
        let best=null,bt=-1;
        for(const l of a.sheetLinks){try{const f=await rd("Google Drive","get_file_metadata",{fileId:l.id,excludeContentSnippets:true},false,86400000);const t=Date.parse(f&&f.createdTime)||0;if(t>bt){bt=t;best=l}}catch(e){}}
        if(best){a.sheetId=best.id;a.sheetGid=best.gid}
      }));
      return list;
    },
    sheets:async(ids,fresh,gids)=>{const out={};await Promise.all(ids.map(async id=>{try{out[id]=await sheet(id,null,fresh,gids&&gids[id])}catch(e){out[id]={error:errText(e,"Google Sheets"),code:e&&e.code}}}));return out},
    sheet,tabs,
    files:async a=>{
      const q="title contains '"+surname(a.name).replace(/'/g,"\\'")+"' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false";
      const p=await rd("Google Drive","search_files",{query:q,pageSize:40,excludeContentSnippets:true},false,300000);
      const out=((p&&p.files)||[]).map(f=>({id:f.id,title:f.title,url:f.viewUrl,updated:f.modifiedTime,created:f.createdTime,owner:f.owner}));
      for(const id of linkIds(a)){const ex=out.find(f=>f.id===id);if(ex){ex.linked=true;continue}
        try{const f=await rd("Google Drive","get_file_metadata",{fileId:id,excludeContentSnippets:true},false,86400000);if(f&&f.id&&!f.trashed&&/spreadsheet/.test(f.mimeType||""))out.push({id:f.id,title:f.title,url:f.viewUrl,updated:f.modifiedTime,created:f.createdTime,owner:f.owner,linked:true})}catch(e){}}
      return out;
    },
    bundle:async(ids,o)=>{
      const out=[],mt=(o&&o.maxTabs)||6,rg=o&&o.maxRows?"A1:L"+o.maxRows:"A1:J90";
      for(const id of ids){
        try{
          const meta=await rd("Google Sheets","get_spreadsheet",{spreadsheetId:id,fields:["properties.title","sheets.properties.title"]},false,300000);
          const tabs=((meta&&meta.sheets)||[]).map(s=>s.properties.title).slice(0,mt);
          const T=[];for(const t of tabs){const v=await rd("Google Sheets","get_values",{spreadsheetId:id,range:A1tab(t)+rg},false,120000);T.push({name:t,values:(v&&v.values)||[]})}
          out.push({id,title:(meta&&meta.properties&&meta.properties.title)||"",url:"https://docs.google.com/spreadsheets/d/"+id+"/edit",tabs:T});
        }catch(e){out.push({id,error:errText(e,"Google Sheets")})}
      }
      return out;
    },
    page:async a=>{const p=await rd("Notion","notion-fetch",{id:a.notionUrl},false,600000);return notionToText(p&&p.text?p.text:typeof p==="string"?p:"")},
    update:async(sheetId,tab,cells)=>{
      const pre=A1tab(tab),rows=[...new Set(cells.map(c=>c.r))],conflict=[];
      for(const r of rows){
        const v=await rd("Google Sheets","get_values",{spreadsheetId:sheetId,range:pre+"A"+r+":L"+r},true);
        const cur=((v&&v.values)||[[]])[0]||[];
        cells.filter(c=>c.r===r).forEach(c=>{if(!same(cur[c.c],c.old))conflict.push({r,c:c.c,cur:cur[c.c]||""})});
      }
      if(conflict.length)return{conflict};
      for(const c of cells)await wr("Google Sheets","update_values",{spreadsheetId:sheetId,range:pre+colL(c.c)+c.r,values:[[safeVal(c.value)]]});
      return{ok:true};
    },
    templates:async()=>{
      const p=await rd("Google Drive","search_files",{query:"title contains 'template' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",pageSize:40,excludeContentSnippets:true},false,600000);
      return((p&&p.files)||[]).map(f=>({id:f.id,title:f.title,kind:classifyTpl(f.title)})).filter(t=>t.kind);
    },
    create:async req=>{
      const f=await wr("Google Drive","copy_file",{fileId:req.templateId,title:req.title});
      const id=f&&f.id;if(!id)throw{code:"tool_error",message:"Copia non riuscita"};
      try{
        const v=await rd("Google Sheets","get_values",{spreadsheetId:id,range:"A1:H8"},true);
        const vals=(v&&v.values)||[];const sets=fillPlan(vals,req);
        for(const s of sets)await wr("Google Sheets","update_values",{spreadsheetId:id,range:colL(s.c)+s.r,values:[[safeVal(s.value)]]});
      }catch(e){}
      return{id,url:"https://docs.google.com/spreadsheets/d/"+id+"/edit",notion:{skipped:true}};
    },
    notes:notesRead,
    noteAdd:async n=>{await wr("Google Sheets","append_values",{spreadsheetId:NOTES_ID,range:"A1",values:[noteRow(n).map((x,i)=>i===7&&/^[=+\-@]/.test(x)?" "+x:x)]});return n},
    noteDel:async n=>{const all=await notesRead();const f=all.find(x=>x.id===n.id);if(f)await wr("Google Sheets","batch_clear_values",{spreadsheetId:NOTES_ID,ranges:["A"+f.row+":H"+f.row]});return{ok:true}}
  };
}
function fillPlan(vals,req){
  const out=[],d=fdy(pd(req.startDate));
  for(let r=0;r<vals.length;r++)(vals[r]||[]).forEach((c,ci)=>{
    const u=String(c||"").trim().toUpperCase();
    if(u==="NOME")out.push({r:r+1,c:ci+1,value:req.name});
    if(u==="PERIODO"&&req.kind==="scheda")out.push({r:r+1,c:ci+1,value:(req.weeks||6)+" settimane - "+d});
    if(u==="DATA"&&req.kind!=="scheda")out.push({r:r+1,c:ci+1,value:d});
  });
  return out;
}
function notionToText(t){
  let s=String(t||"");const m=s.match(/<content>([\s\S]*?)<\/content>/);if(m)s=m[1];
  s=s.replace(/<page url="[^"]*">\s*([\s\S]*?)\s*<\/page>/g,"↳ $1").replace(/<li>\s*/g,"• ").replace(/<\/li>/g,"\n").replace(/<br\s*\/?>/g,"\n").replace(/<p\s*\/>/g,"\n").replace(/<[^>]+>/g,"");
  s=s.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g,"$1");
  return s.split("\n").map(x=>x.replace(/\s+$/,"")).join("\n").replace(/\n{3,}/g,"\n\n").trim();
}
function errText(e,srv){
  const c=e&&e.code;srv=(e&&e.server)||srv||"Il servizio";
  switch(c){
    case"needs_reauth":return srv+" va ricollegato: claude.ai → Impostazioni → Connettori.";
    case"server_not_connected":return srv+" non è collegato: aggiungilo da claude.ai → Impostazioni → Connettori.";
    case"selection_required":return"Hai più connettori "+srv+": scegli quale usare quando claude.ai te lo chiede.";
    case"not_in_manifest":return"L'accesso a "+srv+" per questa pagina è spento. Riattivalo dai permessi della pagina.";
    case"approval_required":return"Serve il tuo consenso per usare "+srv+".";
    case"server_unavailable":return srv+" non risponde in questo momento. Riprova tra poco.";
    case"network":return"Nessuna connessione con il backend. Controlla la rete e riprova.";
    case"timeout":return"Il backend ci sta mettendo troppo. Riprova tra poco.";
    case"auth":return"Chiave non valida: ricollega il dispositivo da Impostazioni.";
    case"tool_error":case"backend":case"sheet":return String(e.message||"Errore").slice(0,220);
    default:return(e&&e.message?String(e.message).slice(0,200):"Operazione non riuscita")+(c?" ("+c+")":"");
  }
}

/* ================= caricamento ================= */
let raf=0,pendingMain=false;
function renderSoon(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;render()})}
function cacheSave(){
  const sh={};Object.keys(S.sheets).forEach(k=>{const v=S.sheets[k];if(v&&v.status==="ok")sh[k]={id:v.id,tab:v.tab,values:v.values,url:v.url}});
  store.set("cache",{at:Date.now(),athletes:S.athletes.map(a=>({src:a.src,id:a.id,name:a.name,tag:a.tag,status:a.status,start:a.start,dur:a.dur,subStart:a.subStart,firstEval:a.firstEval,sheetId:a.sheetId,sheetGid:a.sheetGid,sheetLinks:a.sheetLinks,valId:a.valId,notionUrl:a.notionUrl,analisiUrl:a.analisiUrl,videoUrl:a.videoUrl})),sheets:sh,notes:S.notes});
}
function cacheLoad(){
  const c=store.get("cache",null);if(!c||!c.athletes)return;
  S.athletes=finalize(c.athletes);S.notes=c.notes||[];S.notesState=S.notes.length?"cached":"idle";
  Object.keys(c.sheets||{}).forEach(k=>setSheet(k,c.sheets[k]));
  S.load={state:"cached",err:null,at:new Date(c.at)};
}
function setSheet(aid,r){const P=parseSheet(r.values);const old=S.sheets[aid];S.sheets[aid]={status:"ok",id:r.id,tab:r.tab,tabs:r.tabs||(old&&old.id===r.id?old.tabs:null),values:r.values,url:r.url,P,an:analyze(P),picked:r.picked||null}}
// File con più schede su fogli diversi: la scheda attuale è il foglio più recente (data nel foglio, stimata se manca)
const resolving={};let resolveQ=Promise.resolve();
function resolveTab(a){
  const sh=S.sheets[a.id];if(!sh||sh.status!=="ok"||resolving[a.id+sh.id])return;resolving[a.id+sh.id]=1;
  resolveQ=resolveQ.then(async()=>{
    try{
      let tabs=sh.tabs;if(!tabs&&S.adapter.tabs){try{tabs=(await S.adapter.tabs(sh.id)).map(t=>t.name)}catch(e){}}
      if(!tabs||tabs.length<2)return;
      const B=await S.adapter.bundle([sh.id],{maxTabs:12,maxRows:220});const b=B&&B.find(x=>x&&x.id===sh.id);if(!b||!b.tabs)return;
      const its=[];b.tabs.forEach((t,idx)=>{try{const P=parseSheet(t.values);if(P.kind!=="scheda"||!hasPlan(P)||!P.sections.some(x=>x.items.some(i=>!i.empty)))return;its.push({idx,name:t.name,num:numOfTab(t.name),when:P.meta.when||null,values:t.values})}catch(e){}});
      if(its.length<2)return;
      const fl=S.files[a.id],fm=(fl&&fl.list&&fl.list.find(f=>f.id===sh.id))||{};
      inferDates({created:fm.created||b.created,updated:fm.updated||b.updated},its);
      const pool=its.filter(t=>!t.est).length?its.filter(t=>!t.est):its;
      const cur=its.find(t=>t.name===sh.tab),best=pool.slice().sort((x,y)=>(+y.when-+x.when)||(y.idx-x.idx))[0];
      if(!best||best.name===sh.tab||(cur&&!cur.est&&+cur.when>=+best.when))return;
      const now=S.sheets[a.id];if(!now||now.id!==sh.id)return;
      S.pickTab[a.id]=best.name;setSheet(a.id,{id:sh.id,tab:best.name,tabs,values:best.values,url:sh.url,picked:sh.tab});renderSoon();
    }catch(e){}
  });
}
async function loadAll(fresh){
  S.load.state="loading";renderSoon();for(const k in resolving)delete resolving[k];
  try{
    const list=await S.adapter.athletes(fresh);
    S.athletes=finalize(list);S.load={state:"ok",err:null,at:new Date()};
    route(true);renderSoon();
    loadNotes();
    await scanSheets(fresh);
    cacheSave();
  }catch(e){S.load={state:"error",err:e,at:S.load.at};renderSoon()}
}
async function loadNotes(){
  if(!S.notes.length)S.notesState="loading";renderSoon();
  try{S.notes=(await S.adapter.notes()).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));S.notesState="ok";cacheSave()}
  catch(e){S.notesState="error";S.notesErr=e}
  renderSoon();
}
let scanning=false;
async function scanSheets(fresh){
  if(scanning&&!fresh)return;scanning=true;
  const sel=byId(S.sel);
  const list=S.athletes.filter(a=>a.sheetId&&a.active).sort((x,y)=>(y===sel)-(x===sel));
  const q=list.filter(a=>fresh||!S.sheets[a.id]||S.sheets[a.id].status!=="ok"||S.load.state!=="cached");
  q.forEach(a=>{if(!S.sheets[a.id]||S.sheets[a.id].status!=="ok")S.sheets[a.id]={status:"queued"}});
  const B=S.adapter.batch,chunks=[];for(let i=0;i<q.length;i+=B)chunks.push(q.slice(i,i+B));
  const worker=async()=>{while(chunks.length){const ch=chunks.shift();
    try{const g={};ch.forEach(a=>{if(a.sheetGid)g[a.sheetId]=a.sheetGid});const m=await S.adapter.sheets(ch.map(a=>a.sheetId),fresh,g);
      ch.forEach(a=>{const r=m[a.sheetId];if(r&&!r.error)setSheet(a.id,r);else if(!S.sheets[a.id]||S.sheets[a.id].status!=="ok")S.sheets[a.id]={status:"error",err:{code:r&&r.code||"sheet",message:r?r.error:"File non trovato"}}})}
    catch(e){ch.forEach(a=>{if(!S.sheets[a.id]||S.sheets[a.id].status!=="ok")S.sheets[a.id]={status:"error",err:e}})}
    renderSoon()}};
  await Promise.all([worker(),worker(),worker()]);
  scanning=false;renderSoon();
  S.athletes.forEach(a=>{const sh=S.sheets[a.id];if(sh&&sh.status==="ok"&&(sh.tabs?sh.tabs.length>1:S.adapter.kind==="claude"))resolveTab(a)});
}
// link in Notion a un file che non esiste più: mostra la scheda più recente trovata su Drive
function missingFallback(a,e){
  if(S.alt[a.id]||!/mancante|not found|non trovat|404|eliminat|given id|requested entity|unable to open|impossibile aprire/i.test(String(e&&(e.message||e))))return;
  ensureFiles(a).then(fl=>{const f=fl&&fl.list&&fl.list.find(x=>x.kind==="scheda"&&x.id!==a.sheetId);if(f&&!S.alt[a.id]){S.alt[a.id]={id:f.id,title:f.title,auto:true,why:"missing"};renderSoon()}});
}
async function loadOneSheet(a,fresh){
  if(!a.sheetId)return;if(!S.sheets[a.id]||S.sheets[a.id].status!=="ok")S.sheets[a.id]={status:"loading"};renderSoon();
  try{setSheet(a.id,await S.adapter.sheet(a.sheetId,S.pickTab[a.id]||null,fresh,S.pickTab[a.id]?null:a.sheetGid));resolveTab(a)}catch(e){if(!S.sheets[a.id]||S.sheets[a.id].status!=="ok")S.sheets[a.id]={status:"error",err:e};
    missingFallback(a,e)}
  renderSoon();
}
async function ensureFiles(a,fresh){
  if(S.files[a.id]&&!fresh&&S.files[a.id].status!=="error")return S.files[a.id];
  S.files[a.id]={status:"loading"};renderSoon();
  try{
    const raw=await S.adapter.files(a);
    const re=new RegExp("(^|[^a-z])"+norm(surname(a.name)).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"([^a-z]|$)");
    const linked=S.notes.filter(n=>n.athleteId===a.id&&n.kind==="file").map(n=>({id:sheetIdOf(n.text),title:n.athleteName&&n.signal?("File collegato · "+n.signal):"File collegato",url:n.text,updated:n.createdAt,linked:true,lk:n.signal})).filter(f=>f.id);
    const seen=new Set();let list=[];
    (S.extra[a.id]||[]).concat(linked).concat(raw.filter(f=>f.linked||(re.test(norm(f.title))&&!classifyTpl(f.title)))).forEach(f=>{if(seen.has(f.id))return;seen.add(f.id);list.push(f)});
    list.forEach(f=>{f.kind=f.lk||( /\btest\b/i.test(f.title)?"test":/\bscheda\b/i.test(f.title)?"scheda":/valutazione|\bvf\b/i.test(f.title)?"vf":"scheda");f.current=f.id===a.sheetId||f.id===a.valId});
    list.sort((x,y)=>String(y.updated).localeCompare(String(x.updated)));
    S.files[a.id]={status:"ok",list};
  }catch(e){S.files[a.id]={status:"error",err:e}}
  renderSoon();return S.files[a.id];
}
async function ensureTests(a,fresh){
  if(S.tests[a.id]&&!fresh&&S.tests[a.id].status!=="error")return;
  S.tests[a.id]={status:"loading"};renderSoon();
  try{
    const fl=await ensureFiles(a,fresh);
    const ids=[];if(a.valId)ids.push(a.valId);
    if(fl.status==="ok")fl.list.filter(f=>f.kind==="test"||f.kind==="vf").slice(0,4).forEach(f=>{if(!ids.includes(f.id))ids.push(f.id)});
    if(!ids.length){S.tests[a.id]={status:"ok",sessions:[]};renderSoon();return}
    const files=await S.adapter.bundle(ids.slice(0,4));
    const meta={};if(fl.list)fl.list.forEach(f=>meta[f.id]=f);
    const sessions=[];
    files.forEach(f=>{if(f.error)return;(f.tabs||[]).forEach(t=>{
      const P=parseSheet(t.values);if(!P.sections.length)return;
      const date=parseIt(t.name)||parseIt(P.meta.data)||anyDate(f.updated||(meta[f.id]&&meta[f.id].updated));
      const dl=parseIt(t.name)?fdy(parseIt(t.name)):parseIt(P.meta.data)?fdy(parseIt(P.meta.data)):String(t.name).slice(0,24);
      sessions.push({dlabel:dl,key:f.id+"|"+t.name,fileId:f.id,title:f.title||(meta[f.id]&&meta[f.id].title)||"Test",url:f.url,tab:t.name,values:t.values,P,date,vf:f.id===a.valId||/valutazione|\bvf\b/i.test(f.title||"")});
    })});
    sessions.sort((x,y)=>(y.date?y.date.getTime():0)-(x.date?x.date.getTime():0));
    S.tests[a.id]={status:"ok",sessions,errors:files.filter(f=>f.error).length};
  }catch(e){S.tests[a.id]={status:"error",err:e}}
  renderSoon();
}
async function ensurePage(a,fresh){
  if(S.bodies[a.id]&&!fresh&&S.bodies[a.id].status!=="error")return;
  S.bodies[a.id]={status:"loading"};renderSoon();
  try{S.bodies[a.id]={status:"ok",text:await S.adapter.page(a)}}catch(e){S.bodies[a.id]={status:"error",err:e}}
  renderSoon();
}
async function ensureAlt(a){
  const alt=S.alt[a.id];if(!alt||alt.sh)return;
  alt.loading=true;renderSoon();
  try{const r=await S.adapter.sheet(alt.id,null,false);const P=parseSheet(r.values);alt.sh={status:"ok",id:r.id,tab:r.tab,values:r.values,url:r.url,P,an:analyze(P)}}
  catch(e){alt.sh={status:"error",err:e}}
  alt.loading=false;renderSoon();
}
async function loadHistory(a){
  const fl=await ensureFiles(a);if(fl.status!=="ok")return;
  const files=fl.list.filter(f=>f.kind==="scheda"&&(f.linked||!NOT_SCHEDA.test(norm(f.title)))).slice(0,8);
  const H=S.hist[a.id]={status:"loading",done:0,total:files.length,items:[]};renderSoon();
  const sigs=new Set();
  for(let k=0;k<files.length;k+=4){
    const chunk=files.slice(k,k+4);let B=[];
    try{B=await S.adapter.bundle(chunk.map(f=>f.id),{maxTabs:12,maxRows:220})}catch(e){}
    for(const f of chunk){
      const b=B.find(x=>x&&x.id===f.id);H.done++;
      if(!b||!b.tabs)continue;
      const its=[];
      b.tabs.forEach((t,idx)=>{
        try{const P=parseSheet(t.values);if(P.kind!=="scheda"||!hasPlan(P))return;
          const D=maxWeek(P)||6,pl=planFor(P,D);if(!pl.ex.length)return;
          its.push({idx,name:t.name,num:numOfTab(t.name),when:P.meta.when||null,pl,P})}catch(e){}
      });
      inferDates({created:f.created||b.created,updated:f.updated||b.updated},its);
      its.forEach(t=>{
        const sig=t.pl.ex.map(e=>e.label+":"+e.perW.map(p=>p?p.kg+"x"+p.sets:"-").join(",")).join("|");if(sigs.has(sig))return;sigs.add(sig);
        const nm=String(t.name||"").replace(/\|/g,"").trim();
        H.items.push({title:b.tabs.length>1&&nm?f.title+" · "+nm:f.title,date:t.when,approx:!!t.approx,fixed:!!t.fixed,pl:t.pl,url:f.url});
      });
      renderSoon();
    }
  }
  H.status="ok";renderSoon();
}

/* ================= azioni ================= */
async function saveEdit(){
  const e=S.edit;if(!e||S.saving)return;
  const cells=[];
  Object.keys(e.vals).forEach(c=>{const ci=+c;if(!same(e.vals[c],e.orig[c]))cells.push({r:e.r,c:ci,old:e.orig[c]||"",value:e.vals[c]})});
  if(!cells.length){S.edit=null;render();return}
  S.saving=true;S.editErr=null;render();
  try{
    const res=await S.adapter.update(e.sheetId,e.tab,cells);
    if(res&&res.conflict){S.editErr="Nel frattempo il file è cambiato (forse l'atleta ha scritto il feedback). Ho ricaricato la riga: ricontrolla e salva di nuovo.";
      res.conflict.forEach(k=>{e.orig[k.c]=k.cur});patchValues(e,res.conflict.map(k=>({r:k.r,c:k.c,value:k.cur})));}
    else{patchValues(e,cells);S.edit=null;toast("Salvato su Google Sheets")}
  }catch(err){S.editErr="Non salvato: "+errText(err,"Google Sheets")}
  S.saving=false;render();
}
function patchValues(e,cells){
  const apply=obj=>{if(!obj||!obj.values)return;cells.forEach(c=>{while(obj.values.length<c.r)obj.values.push([]);const row=obj.values[c.r-1];while(row.length<=c.c)row.push("");row[c.c]=c.value});obj.P=parseSheet(obj.values);if(obj.an!==undefined)obj.an=analyze(obj.P)};
  if(e.where==="current"){const sh=S.sheets[e.aid];apply(sh);cacheSave()}
  else if(e.where==="alt"){const al=S.alt[e.aid];if(al&&al.sh)apply(al.sh)}
  else if(e.where==="test"){const t=S.tests[e.aid];if(t&&t.sessions){const s=t.sessions.find(x=>x.key===e.skey);if(s)apply(s)}}
}
async function addNote(a,data){
  const n=Object.assign({id:"n"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),createdAt:new Date().toISOString(),athleteId:a.id,athleteName:a.name,kind:"nota",week:null,signal:"",text:""},data);
  S.notes.unshift(n);renderSoon();
  try{await S.adapter.noteAdd(n);cacheSave();return true}
  catch(e){S.notes=S.notes.filter(x=>x!==n);toast("Nota non salvata: "+errText(e,"Google Sheets"));renderSoon();return false}
}
async function delNote(id){
  const n=S.notes.find(x=>x.id===id);if(!n)return;S.notes=S.notes.filter(x=>x!==n);renderSoon();
  try{await S.adapter.noteDel(n);cacheSave()}catch(e){S.notes.unshift(n);toast("Non eliminata: "+errText(e,"Google Sheets"));renderSoon()}
}
async function ensureTemplates(){
  if(S.templates||S.tplLoading)return;S.tplLoading=true;renderSoon();
  try{S.templates=await S.adapter.templates();S.tplErr=null}catch(e){S.tplErr=e}
  S.tplLoading=false;renderSoon();
}
function nextMonday(){const d=today(),w=d.getDay();return w===1?d:addDays(d,(8-w)%7||7)}
function defaultTitle(n){
  const a=byId(n.aid);if(!a)return"";const d=fdy(pd(n.date));
  if(n.kind==="scheda")return a.src==="vf"?"SCHEDA VF – "+a.name:a.name+" — Scheda "+d;
  if(n.kind==="test-online")return a.name+" — Test online | Serkis";
  if(n.kind==="test-presenza")return a.name+" — Test in presenza | Serkis";
  return"VF – "+a.name;
}
function notionDefault(a,kind){if(!a)return false;if(kind==="vf")return!a.valId;if(kind!=="scheda")return false;return!a.sheetId||!!(a.wk&&a.wk.scad&&a.wk.scad.rank<=1)}
function initNuovo(kind,aid){
  const a=byId(aid);
  S.nuovo={kind:kind||"scheda",aid:aid||"",tpl:"",date:iso(kind&&kind!=="scheda"?today():nextMonday()),weeks:(a&&a.dur)||6,title:"",titleEdited:false,notion:notionDefault(a,kind||"scheda")};
  S.created=null;S.createErr=null;
}
async function doCreate(){
  const n=S.nuovo,a=byId(n.aid);if(!a||S.creating)return;
  const tpls=(S.templates||[]).filter(t=>t.kind===n.kind);const tpl=tpls.find(t=>t.id===n.tpl)||pickTpl(tpls);
  if(!tpl){S.createErr="Nessun template trovato per questo tipo.";render();return}
  const title=(n.titleEdited?n.title:defaultTitle(n)).trim();if(!title){S.createErr="Scrivi un titolo.";render();return}
  S.creating=true;S.createErr=null;render();
  const kind=n.kind==="scheda"?"scheda":n.kind==="vf"?"vf":"test";
  try{
    const res=await S.adapter.create({templateId:tpl.id,kind,title,name:a.name,startDate:n.date,weeks:+n.weeks||6,
      athleteId:a.id,src:a.src,setNotion:S.adapter.caps.notionWrite&&n.notion&&(kind==="scheda"||kind==="vf")});
    S.created={id:res.id,url:res.url,title,kind,aid:a.id,notion:res.notion||{}};
    (S.extra[a.id]=S.extra[a.id]||[]).unshift({id:res.id,title,url:res.url,updated:new Date().toISOString(),lk:kind==="test"?"test":kind});
    delete S.files[a.id];delete S.tests[a.id];
    if(res.notion&&res.notion.ok){loadAll(true)}
  }catch(e){S.createErr="Non creato: "+errText(e,"Google Drive")}
  S.creating=false;render();
}
function pickTpl(tpls){return tpls.find(t=>/^Serkis Training Template$/i.test(t.title.trim()))||tpls[0]}

/* ================= rendering ================= */
function render(){
  document.body.dataset.view=S.view;
  renderBar();renderSide();
  const ae=document.activeElement;
  if(ae&&$("#main").contains(ae)&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)&&S.view===S.lastView&&S.sel===S.lastSel){pendingMain=true;return}
  pendingMain=false;S.lastView=S.view;S.lastSel=S.sel;renderMain();
}
function renderBar(){
  const s=S.load,el=$("#sync");let t="";
  if(!S.adapter)t="";else if(s.state==="loading")t=S.athletes.length?"Aggiorno…":"Carico…";
  else if(s.state==="error")t=s.at?"Offline · dati delle "+p2(s.at.getHours())+":"+p2(s.at.getMinutes()):"Non collegato";
  else{const tot=S.athletes.filter(a=>a.sheetId&&a.active).length,ok=S.athletes.filter(a=>a.sheetId&&a.active&&S.sheets[a.id]&&["ok","error"].includes(S.sheets[a.id].status)).length;
    t=(ok<tot?"Schede "+ok+"/"+tot+" · ":"")+(s.at?"Agg. "+p2(s.at.getHours())+":"+p2(s.at.getMinutes()):"")}
  el.textContent=t;
  const rb=$("#refresh");rb.classList.toggle("spin",s.state==="loading"||scanning);rb.disabled=!S.adapter;
  ["oggi","atleti","nuovo"].forEach(k=>{const b=$("#tb-"+k);if(b)b.setAttribute("aria-current",S.view===k||(k==="atleti"&&S.view==="atleta"&&S.prev==="atleti")?"page":"false")});
  $("#backlbl").textContent=S.view==="atleta"?(S.prev==="oggi"?"Oggi":"Atleti"):"Indietro";
}
function avatar(a){const sg=signalOf(a).level;return`<span class="av" aria-hidden="true">${esc(a.ini)}<i class="${sg}"></i></span>`}
function rowSub(a){
  const b=[SEDE[a.sede]];
  if(a.wk){if(a.wk.future)b.push("inizia il "+fd(a.startD));else if(a.dur)b.push("Sett. "+a.wk.week+"/"+a.dur+" · fino "+fd(a.wk.end));else b.push("Sett. "+a.wk.week+(a.src==="vf"?" protocollo":""))}
  else b.push("data inizio mancante");return b.join(" · ");
}
function statusPill(a){
  if(a.status==="In corso")return"";if(isTest(a))return`<span class="pill ink">Test</span>`;
  if(a.status==="Da fare")return`<span class="pill warn">Da fare</span>`;if(a.status==="In coda")return`<span class="pill">In coda</span>`;
  if(a.status==="Fine collaborazione")return`<span class="pill dim">Finita</span>`;return`<span class="pill">${esc(a.status)}</span>`;
}
const FOCUS={schede:"Schede da preparare",test:"Test e partenze",guardare:"Da guardare",kineva:"Kineva"};
function renderSide(){
  const opts=[["all","Tutti"],["stenika","Stenika"],["online","Online"],["kineva","Kineva"]];
  if(S.athletes.some(a=>a.sede==="altro"))opts.push(["altro","Da classificare"]);
  $("#sede").innerHTML=opts.map(([v,l])=>`<button class="chip" type="button" data-sede="${v}" aria-pressed="${S.filter.sede===v}">${l}</button>`).join("");
  $("#stato").value=S.filter.stato;$("#sort").value=S.sort;$("#stato").disabled=!!S.filter.focus;
  $("#focusbar").innerHTML=S.filter.focus?`<div class="focusbar"><span class="dot bad"></span>Filtro: ${FOCUS[S.filter.focus]}<button type="button" data-act="clear-focus">Togli</button></div>`:"";
  const el=$("#list"),foot=$("#listfoot");
  if(!S.adapter){el.innerHTML="";foot.textContent="";return}
  if(!S.athletes.length){
    el.innerHTML=S.load.state==="error"?`<div class="notice err">${esc(errText(S.load.err,S.mode==="claude"?"Notion":"Il backend"))}<br><button class="btn sm" type="button" data-act="reload">Riprova</button></div>`:`<p class="loading">Leggo gli atleti da Notion…</p>`;
    foot.textContent="";return;
  }
  const L=visible();
  el.innerHTML=L.length?L.map(a=>{
    const sc=a.active&&a.wk&&a.wk.scad,sh=S.sheets[a.id];
    const flags=[sc?`<span class="pill ${sc.level}">${esc(sc.label)}</span>`:"",statusPill(a),sh&&sh.status==="error"?`<span class="pill dim">Scheda?</span>`:""].join("");
    return`<button class="row" type="button" data-id="${a.id}" aria-current="${S.sel===a.id&&S.view==="atleta"}">${avatar(a)}<span><span class="r-name">${esc(a.name)}</span><span class="r-sub">${esc(rowSub(a))}</span></span><span class="r-flags">${flags}</span></button>`;
  }).join(""):`<div class="empty">Nessun atleta con questi filtri.</div>`;
  foot.textContent=L.length+" su "+S.athletes.length+" atleti"+(S.load.state==="error"?" · ultimo aggiornamento non riuscito":"");
}
function renderMain(){
  const m=$("#main");
  if(!S.adapter){m.innerHTML=S.mode==="app"?viewSetup():`<p class="loading">Collego i connettori…</p>`;return}
  if(S.view==="atleta"){const a=byId(S.sel);m.innerHTML=a?viewAtleta(a):(S.athletes.length?`<div class="empty">Atleta non trovato.</div>`:`<p class="loading">Carico…</p>`);afterAtleta(a);return}
  if(S.view==="nuovo"){m.innerHTML=viewNuovo();return}
  if(S.view==="impostazioni"){m.innerHTML=viewImpostazioni();return}
  m.innerHTML=viewOggi();
}

/* ---- oggi ---- */
function viewOggi(){
  const d=today(),act=S.athletes.filter(a=>a.active);
  const head=`<div class="today-h"><span class="eyebrow">${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}</span><h1 class="disp">Oggi</h1></div>`;
  if(!S.athletes.length)return head+(S.load.state==="error"?`<div class="notice err">${esc(errText(S.load.err,S.mode==="claude"?"Notion":"Il backend"))}<br><button class="btn sm" type="button" data-act="reload">Riprova</button></div>`:`<p class="loading">Leggo atleti e schede…</p>`);
  const sch=act.filter(a=>a.wk&&a.wk.scad).sort((x,y)=>x.wk.scad.rank-y.wk.scad.rank);
  const tst=act.filter(a=>isTest(a)||isTodo(a));
  const look=act.map(a=>({a,s:signalOf(a)})).filter(x=>x.s.level==="bad"||x.s.level==="warn").sort((x,y)=>(x.s.level==="bad"?0:1)-(y.s.level==="bad"?0:1));
  const kin=act.filter(a=>a.sede==="kineva");
  const scanned=S.athletes.filter(a=>a.sheetId&&a.active).every(a=>S.sheets[a.id]&&["ok","error"].includes(S.sheets[a.id].status));
  const tile=(f,n,l,s,cls)=>`<button class="tile ${cls}" type="button" data-focus="${f}"><span class="n num">${n}</span><span class="l">${l}</span><span class="s">${esc(s)}</span></button>`;
  const ult=sch.filter(a=>a.wk.scad.rank<=1).length;
  let h=head+`<div class="tiles">
    ${tile("schede",sch.length,"Schede",ult?ult+" da fare subito":sch.length?"in arrivo":"nessuna in scadenza",ult?"hot":sch.length?"mid":"")}
    ${tile("test",tst.length,"Test e partenze",act.filter(isTest).length+" test · "+act.filter(isTodo).length+" da fare","")}
    ${tile("guardare",scanned?look.length:"…","Da guardare",scanned?look.filter(x=>x.s.level==="bad").length+" attenzione":"leggo le schede",look.some(x=>x.s.level==="bad")?"hot":look.length?"mid":"")}
    ${tile("kineva",kin.length,"Kineva","valutazione funzionale","")}
  </div>`;
  const tr=(a,why,btn)=>`<div class="trow"><button class="go" type="button" data-id="${a.id}">${avatar(a)}<span style="min-width:0"><span class="r-name">${esc(a.name)}</span><span class="why">${esc(why)}</span></span></button>${btn||"<span></span>"}</div>`;
  h+=`<section class="block"><div class="block-h"><h2>Schede da preparare</h2><span class="c">${sch.length}</span></div>`+
    (sch.length?sch.map(a=>tr(a,a.wk.scad.label+" · "+SEDE[a.sede]+(a.wk.end?" · fine "+fd(a.wk.end):""),`<button class="btn sm" type="button" data-new="scheda" data-aid="${a.id}">${ICON.plus}Scheda</button>`)).join(""):`<p class="hint">Nessuna scheda in scadenza nelle prossime due settimane.</p>`)+`</section>`;
  h+=`<section class="block"><div class="block-h"><h2>Test e partenze</h2><span class="c">${tst.length}</span></div>`+
    (tst.length?tst.map(a=>tr(a,a.status+" · "+SEDE[a.sede],isTest(a)?`<button class="btn sm" type="button" data-new="${a.sede==="stenika"?"test-presenza":"test-online"}" data-aid="${a.id}">${ICON.plus}Test</button>`:"")).join(""):`<p class="hint">Nessun test o partenza in sospeso.</p>`)+`</section>`;
  h+=`<section class="block"><div class="block-h"><h2>Da guardare</h2><span class="c">${scanned?look.length:"…"}</span></div>`+
    (look.length?look.map(x=>tr(x.a,x.s.reasons[0])).join(""):`<p class="hint">${scanned?"Nessun segnale dai feedback.":"Leggo i feedback nelle schede…"}</p>`)+`</section>`;
  return h;
}

/* ---- atleta ---- */
function viewAtleta(a){
  const w=a.wk;let plates="";
  if(w&&a.dur&&!w.future)plates=`<div><div class="plates" style="--n:${a.dur}" aria-label="Settimana ${w.week} di ${a.dur}">${Array.from({length:a.dur},(_,i)=>`<span class="${i+1<w.week?"done":i+1===w.week?"now":""}"></span>`).join("")}</div><div class="plates-l" style="--n:${a.dur}"><span>S1</span><span>S${a.dur}</span></div></div>`;
  const facts=[];
  if(a.src==="coach"){facts.push(["Settimana",w?(w.future?"inizia "+fd(a.startD):w.week+(a.dur?" di "+a.dur:"")):"—"]);facts.push(["Scheda",a.startD?fd(a.startD)+" → "+(w&&w.end?fdy(w.end):"?"):"—"]);if(a.subD)facts.push(["Abbonamento dal",fdy(a.subD)])}
  else{facts.push(["Settimana protocollo",w?(w.future?"inizia "+fd(a.startD):String(w.week)):"—"]);facts.push(["Inizio programma",fdy(a.startD)]);facts.push(["Prima valutazione",fdy(a.evalD)])}
  const sh=shOf(a);if(sh&&sh.status==="ok"&&sh.P.meta.periodo)facts.push(["In scheda",sh.P.meta.periodo]);
  const sUrl=a.sheetId?"https://docs.google.com/spreadsheets/d/"+a.sheetId+"/edit":null;
  const chips=[`<span class="pill ink">${SEDE[a.sede]}</span>`,a.tag&&a.src==="coach"?`<span class="pill">${esc(a.tag)}</span>`:"",`<span class="pill ${a.status==="In corso"?"ok":isTest(a)?"ink":a.status==="Da fare"?"warn":""}">${esc(a.status)}</span>`,a.active&&w&&w.scad?`<span class="pill ${w.scad.level}">${esc(w.scad.label)}</span>`:""].join("");
  const acts=[sUrl?`<a class="btn pri" href="${esc(sUrl)}" target="_blank" rel="noopener">${ICON.ext}Apri scheda</a>`:"",
    `<button class="btn" type="button" data-new="${a.src==="vf"?"scheda":"scheda"}" data-aid="${a.id}">${ICON.plus}Nuova scheda</button>`,
    `<button class="btn" type="button" data-new="${a.src==="vf"?"vf":a.sede==="stenika"?"test-presenza":"test-online"}" data-aid="${a.id}">${ICON.plus}${a.src==="vf"?"Nuova valutazione":"Nuovo test"}</button>`,
    a.notionUrl?`<a class="btn ghost" href="${esc(a.notionUrl)}" target="_blank" rel="noopener">${ICON.ext}Notion</a>`:"",
    !S.adapter.caps.ai?`<button class="btn ghost" type="button" data-act="copy-ai">${ICON.copy}Copia per Claude</button>`:""].join("");
  const tabs=[["scheda","Scheda"],["test",a.src==="vf"?"Valutazione":"Test"],["carichi","Carichi"],["note","Note"],["file","File"],["notion","Notion"]];
  if(S.adapter.caps.ai)tabs.push(["ai","Analisi AI"]);
  if(!tabs.some(t=>t[0]===S.tab))S.tab="scheda";
  return`<div class="a-top"><h1 class="disp a-name">${esc(a.name)}</h1><div class="chips">${chips}</div>${plates}
    <dl class="facts">${facts.map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
    <div class="actions">${acts}</div></div>
    ${sigHtml(a)}
    <div class="tabs" role="tablist">${tabs.map(([k,l])=>`<button class="tab" role="tab" type="button" data-tab="${k}" aria-selected="${S.tab===k}">${l}</button>`).join("")}</div>
    <div id="tabbody">${tabBody(a)}</div>`;
}
function afterAtleta(a){
  if(!a)return;
  if(!a.sheetId&&!S.alt[a.id]&&(S.tab==="scheda"||S.tab==="carichi")&&!S.files[a.id])ensureFiles(a).then(fl=>{const f=fl&&fl.list&&fl.list.find(x=>x.kind==="scheda");if(f&&!S.alt[a.id]&&!a.sheetId){S.alt[a.id]={id:f.id,title:f.title,auto:true};renderSoon()}});
  if((S.tab==="scheda"||S.tab==="carichi")&&S.alt[a.id])ensureAlt(a);
  if(S.tab==="scheda"&&!S.alt[a.id]&&a.sheetId&&!shOf(a))loadOneSheet(a,false);
  if(S.tab==="scheda"&&a.sheetId&&!S.files[a.id])ensureFiles(a);
  if((S.tab==="scheda"||S.tab==="carichi")&&shOf(a)&&shOf(a).status==="error")missingFallback(a,shOf(a).err);
  if(S.tab==="test"&&!S.tests[a.id])ensureTests(a);
  if(S.tab==="file"&&!S.files[a.id])ensureFiles(a);
  if(S.tab==="notion"&&!S.bodies[a.id])ensurePage(a);
}
function sigHtml(a){
  const s=signalOf(a),cs=coachSignal(a.id);
  const b=(v,l)=>`<button type="button" data-sig="${v}" class="${(cs&&cs.signal===v)||(!cs&&v==="auto")?"on":""}">${l}</button>`;
  return`<section class="sig ${s.level}" aria-label="Andamento"><div class="sig-h"><span class="dot ${s.level}"></span><strong>${LV[s.level]}</strong><span class="src">${s.manual?"segnale tuo · "+fd(anyDate(s.date)):"automatico dal feedback in scheda"}</span></div>
    <ul>${s.reasons.map(r=>`<li>${esc(r)}</li>`).join("")}</ul>
    <div class="sig-set">Imposta tu: ${b("ok","Va bene")}${b("warn","Da guardare")}${b("bad","Attenzione")}${b("auto","Automatico")}</div></section>`;
}
function tabBody(a){
  switch(S.tab){
    case"scheda":return tabScheda(a);case"test":return tabTest(a);case"carichi":return tabCarichi(a);
    case"note":return tabNote(a);case"file":return tabFile(a);case"notion":return tabNotion(a);case"ai":return tabAI(a);
  }return"";
}
function errBox(e,srv,act,data){return`<div class="notice err">${esc(errText(e,srv))}<br><button class="btn sm" type="button" data-act="${act}"${data?` data-v="${esc(data)}"`:""}>Riprova</button></div>`}
function curSheet(a){
  let alt=S.alt[a.id];
  if(alt&&alt.id===a.sheetId){delete S.alt[a.id];alt=null}
  if(alt)return{where:"alt",sh:alt.sh,loading:alt.loading||!alt.sh,alt};
  return{where:"current",sh:shOf(a),loading:!shOf(a)||["loading","queued"].includes(shOf(a).status)};
}
function tabScheda(a){
  const c=curSheet(a);let top="";
  if(c.alt)top=c.alt.auto?`<div class="banner">${c.alt.why==="missing"?"Il link in Notion punta a un file che non esiste più":"In Notion non c'è il link alla scheda"}: ti mostro <b>${esc(c.alt.title)}</b>, la più recente trovata su Drive.</div>`:`<div class="banner">Stai guardando <b>${esc(c.alt.title)}</b><button class="btn sm" type="button" data-act="alt-off">Torna alla scheda attuale</button></div>`;
  if(!c.alt&&a.sheetId){const fl=S.files[a.id];const cur=fl&&fl.status==="ok"&&fl.list.find(f=>f.id===a.sheetId);const cc=cur&&cur.created?+new Date(cur.created):0;
    const nw=cc&&fl.list.filter(f=>f.kind==="scheda"&&f.id!==a.sheetId&&f.created&&+new Date(f.created)>cc+14*864e5&&!/vecchi|archivio|layout|\bprove?\b|copia|copy/.test(norm(f.title))).sort((x,y)=>String(y.created).localeCompare(String(x.created)))[0];
    if(nw)top+=`<div class="banner">Su Drive c'è una scheda più recente: <b>${esc(nw.title)}</b>, creata il ${fdy(anyDate(nw.created))}. In Notion il link punta ancora a quella vecchia.<button class="btn sm" type="button" data-alt="${esc(nw.id)}" data-title="${esc(nw.title)}">Mostra la più recente</button></div>`}
  if(!c.alt&&!a.sheetId&&(!S.files[a.id]||S.files[a.id].status==="loading"))return`<p class="loading">In Notion non c'è il link alla scheda: la cerco su Drive…</p>`;
  if(!c.alt&&!a.sheetId)return`<div class="empty">Nessuna scheda collegata a ${esc(a.name)} in Notion (${a.src==="vf"?"campo Scheda":"campo Training Program"}).<br><br><button class="btn pri" type="button" data-new="scheda" data-aid="${a.id}">${ICON.plus}Crea la scheda dal template</button></div>`;
  if(c.loading)return top+`<p class="loading">Leggo la scheda da Google Sheets…</p>`;
  if(c.sh.status==="error"){
    const fl=S.files[a.id];if(c.where==="current"&&fl&&fl.status==="ok"&&!fl.list.some(x=>x.kind==="scheda"&&x.id!==a.sheetId)&&/mancante|not found|non trovat|404|eliminat|given id|requested entity/i.test(String(c.sh.err&&(c.sh.err.message||c.sh.err))))
      return top+`<div class="empty">Il link in Notion (${a.src==="vf"?"campo Scheda":"campo Training Program"}) punta a un file che non esiste più, e su Drive non trovo altre schede con "${esc(surname(a.name))}" nel nome.<br><br>Aggiorna il link in Notion oppure collega il file dalla scheda <b>File</b>.</div>`;
    return top+errBox(c.sh.err,"Google Sheets","reload-sheet");
  }
  const sh=c.sh,P=sh.P;
  if(c.where==="current"&&sh.picked)top+=`<div class="banner">Nel file ci sono più schede: ti mostro il foglio più recente, <b>${esc(String(sh.tab).replace(/\|/g,"").trim())}</b>. Il link in Notion indicava il foglio ${esc(String(sh.picked).replace(/\|/g,"").trim())}.</div>`;
  if(c.where==="current"&&P.sections.length&&!P.sections.some(x=>x.items.some(i=>!i.empty))){const fl=S.files[a.id];const o=fl&&fl.status==="ok"&&fl.list.filter(f=>f.kind==="scheda"&&f.id!==sh.id&&!/vecchi|archivio|layout|\bprove?\b|copia|copy/.test(norm(f.title))).sort((x,y)=>String(y.updated).localeCompare(String(x.updated)))[0];
    if(o)top+=`<div class="banner">La scheda collegata in Notion è ancora vuota. Su Drive c'è <b>${esc(o.title)}</b>, modificata il ${fdy(anyDate(o.updated))}.<button class="btn sm" type="button" data-alt="${esc(o.id)}" data-title="${esc(o.title)}">Mostra questa</button></div>`}
  if(!P.sections.length)return top+`<div class="empty">Ho aperto il file (foglio "${esc(sh.tab)}") ma non trovo la tabella con la colonna ESERCIZIO.</div>`;
  const per=(P.meta.periodo&&P.meta.when?P.meta.periodo.replace(/\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/,fdy(P.meta.when)):P.meta.periodo)||(P.meta.numero?"Scheda "+P.meta.numero+(P.meta.when?" · "+fdy(P.meta.when):""):P.meta.when?"Scheda del "+fdy(P.meta.when):"");
  top+=`<div class="srcbar"><span>${per?"<b>"+esc(per)+"</b> · ":""}${sh.tab?"foglio "+esc(sh.tab.replace(/\|/g,"").trim())+" · ":""}Le modifiche vanno direttamente nel file</span><a href="${esc(sh.url)}" target="_blank" rel="noopener">Apri in Google Sheets ↗</a></div>`;
  return top+sectionsHtml(P,{where:c.where,aid:a.id,sheetId:sh.id,tab:sh.tab});
}
function sectionsHtml(P,ctx){
  return P.sections.map(sec=>{
    const filled=sec.items.filter(it=>!it.empty),free=sec.items.filter(it=>it.empty);
    const editingFree=S.edit&&S.edit.sheetId===ctx.sheetId&&free.some(it=>it.r===S.edit.r);
    let h=`<section class="sec"><div class="sec-h"><h3>${esc(sec.title)}</h3><small>${filled.length} ${sec.kind==="test"?"prove":"esercizi"}</small></div>`;
    h+=filled.map(it=>itemHtml(sec,it,ctx)).join("");
    if(editingFree)h+=editorHtml(sec,sec.items.find(it=>it.r===S.edit.r),ctx);
    else if(free.length&&sec.cols.length)h+=`<button class="addslot" type="button" data-slot="${free[0].r}" data-sheet="${ctx.sheetId}">+ Aggiungi ${sec.kind==="test"?"una prova":"un esercizio"} · ${free.length} ${free.length===1?"riga libera":"righe libere"}</button>`;
    if(!filled.length&&!free.length)h+=`<p class="hint">Sezione vuota.</p>`;
    return h+`</section>`;
  }).join("");
}
function itemHtml(sec,it,ctx){
  if(S.edit&&S.edit.sheetId===ctx.sheetId&&S.edit.r===it.r)return editorHtml(sec,it,ctx);
  const get=k=>cellOf(sec,it,k);let body="";
  if(sec.kind==="test"){
    const ris=get("ris");
    body=`<div class="res ${ris?"":"none"}">${esc(ris||"—")}</div>${get("prot")?`<div class="ex-no">${esc(get("prot"))}</div>`:""}${get("note")?`<div class="ex-no">${esc(get("note"))}</div>`:""}`;
  }else{
    const schema=sec.cols.filter(c=>c.key==="schema").map(c=>(it.cells[c.c]||"").trim()).filter(Boolean).join("\n\n")||get("exs")||[get("serie")&&get("serie")+" serie",get("rip"),get("rec")&&"rec. "+get("rec")].filter(Boolean).join(" · ");
    body=`${schema?`<div class="ex-s">${esc(schema)}</div>`:""}${get("note")?`<div class="ex-no">${esc(get("note"))}</div>`:""}`;
    sec.cols.filter(c=>c.key==="x"||(c.key==="ris"&&sec.kind!=="test")).forEach(c=>{const v=(it.cells[c.c]||"").trim();if(v)body+=`<div class="ex-no"><b>${esc(c.label)}:</b> ${esc(v)}</div>`});
    if(sec.cols.some(c=>c.key==="fb")){const f=it.fb.filter(x=>x.text);body+=f.length?`<div class="fb">${f.map(x=>`<div class="fb-i"><span class="fb-w ${x.tone}">${x.week?"S"+x.week:"—"}</span><span>${esc(x.text)}</span></div>`).join("")}</div>`:`<div class="fb-none">Nessun feedback</div>`}
  }
  const tipo=get("tipo");
  return`<div class="ex"><div class="ex-n">${tipo?`<span class="ex-t">${esc(tipo)}</span>`:""}${esc(sec.cols.some(c=>c.key==="exs")?exLabel(sec,it):it.ex)}</div><div>${body}</div><div class="ex-ed"><button class="edbtn" type="button" data-edit="${it.r}" data-sheet="${ctx.sheetId}">${ICON.edit}Modifica</button></div></div>`;
}
let editCtx=null;
function editorHtml(sec,it,ctx){
  editCtx={sec,ctx};const e=S.edit;
  return`<form class="editor" id="editor" autocomplete="off">
    ${sec.cols.map(c=>`<label>${esc(c.label)}<textarea class="${MONO[c.key]?"m":""}" data-col="${c.c}" rows="${Math.min(12,Math.max(c.key==="fb"?6:2,String(e.vals[c.c]||"").split("\n").reduce((n,l)=>n+1+Math.floor(l.length/38),0)))}">${esc(e.vals[c.c]||"")}</textarea></label>`).join("")}
    <div class="ed-row"><button class="btn pri" type="submit" ${S.saving?"disabled":""}>${S.saving?"Salvo…":"Salva nel file"}</button><button class="btn ghost" type="button" data-act="edit-cancel">Annulla</button>${S.editErr?`<span class="err-t">${esc(S.editErr)}</span>`:""}</div>
  </form>`;
}
function startEdit(r,sheetId){
  const a=byId(S.sel);if(!a)return;
  let where="current",obj=null,skey=null;
  const c=curSheet(a);
  if(c.sh&&c.sh.id===sheetId&&S.tab==="scheda"){obj=c.sh;where=c.where}
  else{const ss=curSession(a);if(ss&&ss.fileId===sheetId){obj=ss;where="test";skey=ss.key}}
  if(!obj)return;
  const sec=obj.P.sections.find(s=>s.items.some(it=>it.r===r));if(!sec)return;const it=sec.items.find(x=>x.r===r);
  const vals={},orig={};sec.cols.forEach(col=>{vals[col.c]=it.cells[col.c]||"";orig[col.c]=it.cells[col.c]||""});
  S.edit={aid:a.id,sheetId,tab:obj.tab,r,vals,orig,where,skey};S.editErr=null;render();
  setTimeout(()=>{const t=document.querySelector("#editor textarea");if(t)t.focus()},30);
}
function curSession(a){const t=S.tests[a.id];if(!t||!t.sessions||!t.sessions.length)return null;const sk=S.sessSel[a.id]||"";return t.sessions.find(s=>s.key===sk)||(sk.endsWith("|")&&t.sessions.find(s=>s.key.startsWith(sk)))||t.sessions[0]}
function tabTest(a){
  const t=S.tests[a.id];
  const actions=`<div class="actions" style="margin-bottom:14px"><button class="btn" type="button" data-new="${a.src==="vf"?"vf":a.sede==="stenika"?"test-presenza":"test-online"}" data-aid="${a.id}">${ICON.plus}${a.src==="vf"?"Nuova valutazione":"Nuovo test"}</button><button class="btn ghost" type="button" data-tab="file">Collega un file</button></div>`;
  if(!t||t.status==="loading")return actions+`<p class="loading">Cerco i test di ${esc(a.name)} su Drive…</p>`;
  if(t.status==="error")return actions+errBox(t.err,"Google Drive","reload-tests");
  if(!t.sessions.length)return actions+`<div class="empty">Non trovo file di test con "${esc(surname(a.name))}" nel titolo. Creane uno dal template o collega il file dalla tab File.</div>`;
  const cur=curSession(a);
  let h=actions;
  if(t.sessions.length>1)h+=`<div class="seg" style="margin-bottom:14px">${t.sessions.slice(0,8).map(s=>`<button class="chip" type="button" data-sess="${esc(s.key)}" aria-pressed="${s===cur}">${esc(s.dlabel)}</button>`).join("")}</div>`;
  h+=`<div class="srcbar"><span><b>${esc(cur.title)}</b>${parseIt(cur.tab)?"":" · "+esc(cur.tab)}${cur.date?" · "+fdy(cur.date):""}</span><a href="${esc(cur.url)}" target="_blank" rel="noopener">Apri in Google Sheets ↗</a></div>`;
  h+=sectionsHtml(cur.P,{where:"test",aid:a.id,sheetId:cur.fileId,tab:cur.tab});
  const ts=t.sessions.filter(s=>s.P.sections.some(x=>x.kind==="test")).slice(0,4);
  if(ts.length>1){
    const names=[],map={};
    ts.forEach((s,si)=>s.P.sections.forEach(sec=>{if(sec.kind!=="test")return;sec.items.forEach(it=>{if(it.empty)return;const k=norm(it.ex);if(!map[k]){map[k]={name:it.ex.split("\n")[0],v:[]};names.push(k)}map[k].v[si]=cellOf(sec,it,"ris")})}));
    const rows=names.filter(k=>map[k].v.filter(Boolean).length>=2);
    if(rows.length)h+=`<section class="sec"><div class="sec-h"><h3>Confronto test</h3><small>stessa prova in date diverse</small></div><div class="tw"><table><thead><tr><th>Prova</th>${ts.map(s=>`<th>${s.date?fd(s.date)+"/"+String(s.date.getFullYear()).slice(2):esc(s.tab)}</th>`).join("")}</tr></thead><tbody>${rows.map(k=>`<tr><td>${esc(map[k].name)}</td>${ts.map((s,i)=>`<td>${esc(map[k].v[i]||"—")}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section>`;
  }
  return h;
}
function niceMax(v){if(v<=0)return 1;const e=Math.pow(10,Math.floor(Math.log10(v))),f=v/e;return(f<=1?1:f<=2?2:f<=5?5:10)*e}
function barChart(vals,cur){
  const W=320,H=150,pl=28,pr=6,pt=18,pb=20,n=vals.length,max=niceMax(Math.max(1,...vals)),iw=W-pl-pr,ih=H-pt-pb,bw=iw/n,y=v=>pt+ih-(v/max)*ih;
  let s=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Serie programmate per settimana">`;
  [0,max/2,max].forEach(t=>{s+=`<line class="${t?"grid":"base"}" x1="${pl}" x2="${W-pr}" y1="${y(t)}" y2="${y(t)}"/><text x="${pl-5}" y="${y(t)+3}" text-anchor="end">${Math.round(t)}</text>`});
  vals.forEach((v,i)=>{const x=pl+i*bw+bw*.2,w=bw*.6,yy=y(v),h=pt+ih-yy;
    if(v>0)s+=`<path class="bar${i+1===cur?" cur":""}" d="M${x},${pt+ih}V${yy+Math.min(3,h)}q0,-3 3,-3h${w-6}q3,0 3,3V${pt+ih}Z"><title>S${i+1}: ${v} serie</title></path>`;
    s+=`<text x="${x+w/2}" y="${H-5}" text-anchor="middle"${i+1===cur?' class="lbl"':""}>S${i+1}</text>`;
    if(v>0&&i+1===cur)s+=`<text class="lbl" x="${x+w/2}" y="${yy-5}" text-anchor="middle">${v}</text>`});
  return s+`</svg>`;
}
function lineChart(pts,labels,cur){
  const n=pts.length,W=300,H=124,pl=30,pr=14,pt=18,pb=20,iw=W-pl-pr,ih=H-pt-pb;
  const vs=pts.filter(v=>v!=null);let lo=Math.min(...vs),hi=Math.max(...vs);lo=Math.max(0,Math.floor((lo-5)/5)*5);hi=Math.ceil((hi+5)/5)*5;if(hi===lo)hi=lo+5;
  const x=i=>pl+(n===1?iw/2:i*iw/(n-1)),y=v=>pt+ih-((v-lo)/(hi-lo))*ih;
  let s=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Carico nel tempo">`;
  [lo,hi].forEach(t=>{s+=`<line class="grid" x1="${pl}" x2="${W-pr}" y1="${y(t)}" y2="${y(t)}"/><text x="${pl-5}" y="${y(t)+3}" text-anchor="end">${t}</text>`});
  if(cur&&cur<=n)s+=`<line class="now" x1="${x(cur-1)}" x2="${x(cur-1)}" y1="${pt-8}" y2="${pt+ih}"/>`;
  let d="",pen=false;pts.forEach((v,i)=>{if(v==null){pen=false;return}d+=(pen?"L":"M")+x(i).toFixed(1)+","+y(v).toFixed(1);pen=true});
  s+=`<path class="ln" d="${d}"/>`;
  const step=Math.ceil(n/7);
  pts.forEach((v,i)=>{if(i%step===0||i===n-1)s+=`<text x="${x(i)}" y="${H-5}" text-anchor="${n>1&&i===n-1?"end":n>1&&i===0?"start":"middle"}"${i+1===cur?' class="lbl"':""}>${esc(labels[i])}</text>`;if(v!=null)s+=`<circle class="pt${i+1===cur?" cur":""}" cx="${x(i)}" cy="${y(v)}" r="4"><title>${esc(labels[i])}: ${v} kg</title></circle>`});
  const fi=pts.findIndex(v=>v!=null),li=n-1-[...pts].reverse().findIndex(v=>v!=null);
  const nb=(i,d)=>{for(let j=i+d;j>=0&&j<n;j+=d)if(pts[j]!=null)return pts[j];return null};
  [...new Set([fi,li])].forEach(i=>{const o=i===fi?nb(i,1):nb(i,-1),below=o!=null&&o>pts[i];s+=`<text class="lbl" x="${x(i)}" y="${below?y(pts[i])+16:y(pts[i])-8}" text-anchor="${i===0?"start":i===n-1?"end":"middle"}">${pts[i]} kg</text>`});
  return s+`</svg>`;
}
function tabCarichi(a){
  const c=curSheet(a);
  if(!c.alt&&!a.sheetId&&(!S.files[a.id]||S.files[a.id].status==="loading"))return`<p class="loading">Cerco la scheda su Drive…</p>`;
  if(!c.alt&&!a.sheetId)return`<div class="empty">Nessuna scheda collegata.</div>`;
  if(c.loading)return`<p class="loading">Leggo la scheda…</p>`;
  if(c.sh.status==="error")return errBox(c.sh.err,"Google Sheets","reload-sheet");
  const P=c.sh.P;let h="";
  if(!hasPlan(P))h+=`<div class="empty">In questa scheda non trovo serie e carichi da leggere (colonna SCHEMA o ESERCIZIO - SERIE x REP).</div>`;
  else{
    const isCur=!c.alt||c.alt.auto,D=(isCur&&a.dur)||maxWeek(P)||a.dur||1,cur=isCur&&a.wk&&!a.wk.future?Math.min(a.wk.week,D):null,pl=planFor(P,D);
    h+=`<section class="sec"><div class="sec-h"><h3>Serie programmate</h3><small>per settimana, tutti i giorni</small></div>${barChart(pl.weekly.map(w=>w.sets),cur)}
      <div class="tw"><table><thead><tr><th>Settimana</th><th>Serie</th><th>Tonnellaggio</th></tr></thead><tbody>${pl.weekly.map(w=>`<tr class="${w.w===cur?"cur":""}"><td>S${w.w}${w.w===cur?" · ora":""}</td><td>${w.sets}</td><td>${w.ton?Math.round(w.ton).toLocaleString("it-IT")+" kg":"—"}</td></tr>`).join("")}</tbody></table></div></section>`;
    const kg=pl.ex.filter(e=>e.hasKg);
    h+=`<section class="sec"><div class="sec-h"><h3>Carico per esercizio</h3><small>kg programmati, settimana per settimana</small></div>`;
    h+=kg.length?`<div class="cards">${kg.map(e=>{const k=e.perW.map(p=>p&&p.kg!=null?p.kg:null),vs=k.filter(v=>v!=null),f=vs[0],l=vs[vs.length-1];
      return`<div class="card"><h4>${esc(e.label)}</h4><p>${esc(e.where)} · ${f} → ${l} kg${f&&l&&l!==f?` · ${l>f?"+":""}${Math.round((l-f)/f*100)}%`:""}</p>${lineChart(k,k.map((_,i)=>"S"+(i+1)),cur)}</div>`}).join("")}</div>`:`<div class="empty">Nessun esercizio con carico in kg nella colonna SCHEMA.</div>`;
    h+=`</section>`;
    if(pl.skipped.length)h+=`<p class="foot">Non letti in automatico: ${esc(pl.skipped.join("; "))}.</p>`;
  }
  const hs=S.hist[a.id];
  h+=`<section class="sec"><div class="sec-h"><h3>Storico tra le schede</h3><small>carico massimo programmato in ogni scheda</small></div>`;
  if(!hs)h+=`<p class="hint" style="margin-bottom:10px">Legge le schede passate di ${esc(a.name)} trovate su Drive e mette in fila i carichi.</p><button class="btn" type="button" data-act="history">Carica lo storico</button>`;
  else if(hs.status==="loading")h+=`<p class="loading">Leggo le schede ${hs.done}/${hs.total}…</p>`;
  else{
    const items=hs.items.filter(i=>i.date).sort((x,y)=>x.date-y.date),map={},order=[];
    items.forEach((it,ii)=>{const best={};it.pl.ex.forEach(e=>{if(!e.hasKg)return;const k=exKey(e.label)||norm(e.label);
      const kg=Math.max(...e.perW.filter(p=>p&&p.kg!=null).map(p=>p.kg)),sets=Math.max(0,...e.perW.filter(Boolean).map(p=>p.kg?Math.round(p.ton/p.kg):p.sets));
      if(!best[k]||sets>best[k].sets||(sets===best[k].sets&&kg>best[k].kg))best[k]={kg,sets,label:e.label}});
      Object.keys(best).forEach(k=>{if(!map[k]){map[k]={label:best[k].label,v:[]};order.push(k)}map[k].v[ii]=best[k].kg})});
    const good=order.filter(k=>map[k].v.filter(v=>v!=null).length>=2);
    const labels=items.map(i=>(i.approx?"~":"")+fd(i.date)+"/"+String(i.date.getFullYear()).slice(2));
    h+=good.length?`<div class="cards">${good.map(k=>{const ix=items.map((_,i)=>i).filter(i=>map[k].v[i]!=null),vs=ix.map(i=>map[k].v[i]);return`<div class="card"><h4>${esc(map[k].label)}</h4><p>${vs.length} schede · ${vs[0]} → ${vs[vs.length-1]} kg</p>${lineChart(vs,ix.map(i=>labels[i]),null)}</div>`}).join("")}</div>`
      :`<div class="empty">Ho letto ${hs.items.length} schede ma nessun esercizio con carico in kg compare in almeno due.</div>`;
    const nod=hs.items.filter(i=>!i.date).map(i=>i.title),apx=items.some(i=>i.approx);
    h+=`<p class="foot">Schede lette (${hs.items.length}): ${esc(items.map(i=>i.title+(i.date?" ("+(i.approx?"~":"")+fdy(i.date)+")":"")).join(" · ")||"nessuna")}.${nod.length?" Senza data, escluse dal grafico: "+esc(nod.join(", "))+".":""}${apx?" ~ = data stimata (nel foglio manca la data: uso il mese nel nome del foglio, l'ordine dei fogli e le date del file).":""} Carico massimo programmato in ogni scheda, non l'eseguito.</p><button class="btn sm ghost" type="button" data-act="history">Ricarica lo storico</button>`;
  }
  return h+`</section>`;
}
const KIND={nota:"Nota",whatsapp:"WhatsApp",segnale:"Segnale",ai:"Analisi AI",file:"File"};
function tabNote(a){
  const N=S.notes.filter(n=>n.athleteId===a.id&&n.kind!=="file");
  const wk=a.wk&&!a.wk.future?a.wk.week:"";
  let h=`<form class="form" id="noteform" autocomplete="off"><textarea id="note-text" placeholder="Scrivi una nota o incolla il feedback ricevuto su WhatsApp" aria-label="Testo della nota">${esc(S.drafts[a.id]||"")}</textarea>
    <div class="f-row"><select id="note-kind" aria-label="Tipo"><option value="nota">Nota coach</option><option value="whatsapp">Feedback WhatsApp</option></select><label for="note-week">Settimana</label><input class="inp" id="note-week" type="number" min="1" max="52" value="${wk}"><button class="btn pri" type="submit">Salva nota</button></div></form>`;
  if(S.notesState==="loading"&&!S.notes.length)return h+`<p class="loading">Carico le note…</p>`;
  if(S.notesState==="error")h+=`<div class="notice err">Non riesco a leggere il foglio delle note: ${esc(errText(S.notesErr,"Google Sheets"))}</div>`;
  if(!N.length)return h+`<div class="empty">Ancora nessuna nota per ${esc(a.name)}. Note, feedback WhatsApp e segnali finiscono qui e nel foglio <a href="${NOTES_URL}" target="_blank" rel="noopener">SERKIS APP — Note</a>.</div>`;
  return h+N.map(n=>{const sig=n.kind==="segnale"?`<span class="dot ${n.signal==="auto"?"":n.signal}"></span>${n.signal==="auto"?"Tornato automatico":LV[n.signal]||""}`:"";
    const d=anyDate(n.createdAt);const t=new Date(n.createdAt);
    return`<div class="note"><div class="note-h"><span class="pill ${n.kind==="whatsapp"?"ok":n.kind==="ai"?"ink":""}">${KIND[n.kind]||esc(n.kind)}</span>${n.week?`<span class="mono">S${n.week}</span>`:""}<span class="mono">${d?fdy(d):""}${isNaN(t)?"":" "+p2(t.getHours())+":"+p2(t.getMinutes())}</span>${sig}<button class="note-del ${S.delArm===n.id?"arm":""}" type="button" data-del="${esc(n.id)}">${S.delArm===n.id?"Conferma eliminazione":"Elimina"}</button></div>${n.text&&n.kind!=="segnale"?`<div class="note-t">${esc(n.text)}</div>`:""}</div>`}).join("");
}
const FK={scheda:"Scheda",test:"Test",vf:"Valutazione"};
function tabFile(a){
  const f=S.files[a.id];
  let h=`<form class="form" id="linkform" autocomplete="off"><div class="f-row" style="flex-wrap:wrap"><input class="inp" id="link-url" style="flex:1;min-width:220px" placeholder="Incolla il link di un Google Sheets" aria-label="Link del file"><select id="link-kind" aria-label="Tipo di file"><option value="test">Test</option><option value="scheda">Scheda</option><option value="vf">Valutazione</option></select><button class="btn" type="submit">Collega</button></div><span class="hint">Per i file che non hanno "${esc(surname(a.name))}" nel titolo.</span></form>`;
  if(!f||f.status==="loading")return h+`<p class="loading">Cerco i file su Drive…</p>`;
  if(f.status==="error")return h+errBox(f.err,"Google Drive","reload-files");
  if(!f.list.length)return h+`<div class="empty">Nessun file su Drive con "${esc(surname(a.name))}" nel titolo.</div>`;
  return h+["scheda","test","vf"].map(k=>{const L=f.list.filter(x=>x.kind===k);if(!L.length)return"";
    return`<section class="sec"><div class="sec-h"><h3>${FK[k]==="Scheda"?"Schede":FK[k]==="Test"?"Test":"Valutazioni"}</h3><small>${L.length}</small></div><div class="files">${L.map(x=>{const d=anyDate(x.updated);
      return`<div class="file"><div style="min-width:0"><b>${esc(x.title)}</b><span>${x.current?"attuale · ":""}${x.linked?"collegato a mano · ":""}modificato ${d?fdy(d):"—"}</span></div><div class="acts">${k==="scheda"&&!x.current?`<button class="btn sm" type="button" data-alt="${esc(x.id)}" data-title="${esc(x.title)}">Vedi qui</button>`:""}<a class="btn sm ghost" href="${esc(x.url)}" target="_blank" rel="noopener">Apri ↗</a></div></div>`}).join("")}</div></section>`}).join("");
}
function tabNotion(a){
  const b=S.bodies[a.id];
  if(!b||b.status==="loading")return`<p class="loading">Leggo la pagina Notion…</p>`;
  if(b.status==="error")return errBox(b.err,"Notion","reload-page");
  if(!b.text)return`<div class="empty">La pagina Notion di ${esc(a.name)} è vuota.</div>`;
  const html=esc(b.text).split("\n").map(l=>/^#{1,4}\s/.test(l)?`<strong>${l.replace(/^#{1,4}\s*/,"")}</strong>`:l).join("\n");
  return`<div class="prose">${html}</div><p class="foot">Testo della pagina Notion: test, note e anagrafica. Per modificarlo <a href="${esc(a.notionUrl)}" target="_blank" rel="noopener">apri Notion ↗</a>.</p>`;
}
function aiPrompt(a){
  const L=[],sh=shOf(a);
  L.push("Atleta: "+a.name+" · sede: "+SEDE[a.sede]+" · stato: "+a.status);
  if(a.wk)L.push("Settimana attuale: "+a.wk.week+(a.dur?" di "+a.dur:"")+" · inizio "+fdy(a.startD));
  if(sh&&sh.status==="ok"){L.push("","SCHEDA ATTUALE:");sh.P.sections.forEach(s=>{L.push("["+s.title+"]");s.items.filter(it=>!it.empty).forEach(it=>L.push("- "+s.cols.map(c=>c.label+": "+String(it.cells[c.c]||"—").replace(/\n/g," / ")).join(" | ")))})}
  const N=S.notes.filter(n=>n.athleteId===a.id&&n.kind!=="ai"&&n.kind!=="file").slice(0,15);
  if(N.length){L.push("","NOTE DEL COACH E FEEDBACK WHATSAPP (più recenti prima):");N.forEach(n=>L.push("- "+String(n.createdAt).slice(0,10)+(n.week?" S"+n.week:"")+" ["+(KIND[n.kind]||n.kind)+"] "+(n.kind==="segnale"?(LV[n.signal]||"automatico"):n.text)))}
  const b=S.bodies[a.id];if(b&&b.status==="ok"&&b.text)L.push("","PAGINA NOTION (test e note):",b.text.slice(0,3500));
  return`Sei l'assistente del coach Serkis (calisthenics, forza, preparazione atletica). Leggi i dati di un suo atleta e scrivi una lettura breve dell'andamento.
Regole: usa solo i dati qui sotto; distingui ciò che è scritto da ciò che deduci; nessuna diagnosi medica, se compare dolore suggerisci di approfondire con l'atleta; feedback reale, aderenza, recupero e contesto contano più della progressione teorica; stallo = oltre tre settimane senza progresso nello stesso esercizio; i dati mancanti non sono zero; le proposte sono idee che il coach deve validare.
Rispondi in italiano, massimo 170 parole, testo semplice senza markdown. Usa queste intestazioni, ognuna su una riga a sé:
ANDAMENTO: VERDE, GIALLO o ROSSO e il motivo in una frase
COSA VA BENE
DA TENERE D'OCCHIO
DA CHIEDERE ALL'ATLETA
IDEE PER LA PROSSIMA SCHEDA (DA VALIDARE)

DATI:
${L.join("\n")}`;
}
function tabAI(a){
  const r=S.ai[a.id]||{status:"idle"};
  let h=`<p class="hint" style="margin-top:0">Claude legge scheda, feedback, note e pagina Notion di ${esc(a.name)} e propone una lettura dell'andamento. Spunti da validare, non decisioni.</p>
    <button class="btn pri" type="button" data-act="ai" ${r.status==="running"?"disabled":""}>${r.status==="running"?"Analisi in corso…":r.text?"Rifai l'analisi":"Analizza andamento"}</button>`;
  if(r.text)h+=`<div class="prose" style="margin-top:14px">${esc(r.text).split("\n").map(l=>/^(ANDAMENTO|COSA VA BENE|DA TENERE|DA CHIEDERE|IDEE PER)/.test(l.trim())?`<strong>${l}</strong>`:l).join("\n")}</div>`;
  if(r.status==="error")h+=`<p class="err-t">${esc(r.msg)}</p>`;
  if(r.status==="done"&&r.text&&!r.saved)h+=`<button class="btn" type="button" data-act="ai-save" style="margin-top:10px">Salva come nota</button>`;
  if(r.saved)h+=`<p class="hint">Salvata nelle note.</p>`;
  return h;
}

/* ---- nuovo ---- */
const NK=[["scheda","Scheda"],["test-online","Test online"],["test-presenza","Test in presenza"],["vf","Valutazione VF"]];
function viewNuovo(){
  if(!S.nuovo)initNuovo();
  const n=S.nuovo,act=S.athletes.filter(a=>a.active).sort((x,y)=>x.name.localeCompare(y.name,"it"));
  ensureTemplates();
  let h=`<div class="page-h"><span class="eyebrow">Dai tuoi template su Drive</span><h1 class="disp">Nuovo</h1></div>`;
  if(S.created){const c=S.created,a=byId(c.aid);
    const nt=c.notion&&c.notion.ok?"Notion aggiornato: è la scheda attuale di "+esc(a?a.name:"")+".":c.notion&&c.notion.error?"Notion non aggiornato: "+esc(c.notion.error):"";
    h+=`<div class="result" role="status"><strong>Creato: ${esc(c.title)}</strong>${nt?`<span class="hint" style="color:var(--ink-2)">${nt}</span>`:""}<div class="actions"><button class="btn pri" type="button" data-act="open-created">Compila nell'app</button><a class="btn" href="${esc(c.url)}" target="_blank" rel="noopener">${ICON.ext}Apri in Google Sheets</a><button class="btn ghost" type="button" data-act="new-again">Crea un altro</button></div></div>`;
    return h;
  }
  const tpls=(S.templates||[]).filter(t=>t.kind===n.kind),def=pickTpl(tpls);
  const a=byId(n.aid),title=n.titleEdited?n.title:defaultTitle(n);
  const notionOk=S.adapter.caps.notionWrite&&(n.kind==="scheda"||n.kind==="vf");
  h+=`<form class="fgrid" id="newform" autocomplete="off">
    <div class="fld"><span>Cosa crei</span><div class="seg">${NK.map(([k,l])=>`<button class="chip" type="button" data-nk="${k}" aria-pressed="${n.kind===k}">${l}</button>`).join("")}</div></div>
    <label class="fld"><span>Atleta</span><select id="nf-aid"><option value="">Scegli l'atleta</option>${act.map(x=>`<option value="${x.id}" ${x.id===n.aid?"selected":""}>${esc(x.name)} · ${SEDE[x.sede]}</option>`).join("")}</select></label>
    <label class="fld"><span>Template</span>${S.tplLoading?`<span class="loading">Cerco i template su Drive…</span>`:S.tplErr?`<span class="err-t">${esc(errText(S.tplErr,"Google Drive"))}</span>`:tpls.length?`<select id="nf-tpl">${tpls.map(t=>`<option value="${t.id}" ${(n.tpl?n.tpl===t.id:def&&def.id===t.id)?"selected":""}>${esc(t.title)}</option>`).join("")}</select>`:`<span class="err-t">Nessun template di questo tipo su Drive.</span>`}</label>
    <label class="fld"><span>${n.kind==="scheda"?"Inizio scheda":"Data"}</span><input class="inp" id="nf-date" type="date" value="${n.date}"></label>
    ${n.kind==="scheda"?`<label class="fld"><span>Settimane</span><select id="nf-weeks">${[4,5,6,8].map(w=>`<option ${+n.weeks===w?"selected":""}>${w}</option>`).join("")}</select></label>`:""}
    <label class="fld"><span>Nome del file</span><input class="inp" id="nf-title" value="${esc(title)}"></label>
    ${notionOk?`<label class="check"><input type="checkbox" id="nf-notion" ${n.notion?"checked":""}><span>Imposta in Notion come ${n.kind==="vf"?"valutazione":"scheda attuale"}${a?" di "+esc(a.name):""}${n.kind==="scheda"&&a?(a.src==="coach"?": link, data inizio e durata. Il link della scheda precedente resta nel campo.":": link e inizio programma."):"."}</span></label>`:n.kind==="scheda"||n.kind==="vf"?`<p class="hint">Il collegamento in Notion lo fa l'app installata; qui il file viene solo creato.</p>`:""}
    <div class="ed-row"><button class="btn red" type="submit" ${!a||!tpls.length||S.creating?"disabled":""}>${S.creating?"Creo il file…":"Crea"}</button>${S.createErr?`<span class="err-t">${esc(S.createErr)}</span>`:""}</div>
    <p class="hint">Copia il template nella stessa cartella e compila nome${n.kind==="scheda"?" e periodo":" e data"}. Poi lo compili da qui, riga per riga.</p>
  </form>`;
  return h;
}

/* ---- impostazioni ---- */
function linkCode(){return S.cfg?"SERKIS1."+btoa(unescape(encodeURIComponent(JSON.stringify({u:S.cfg.url,k:S.cfg.key})))).replace(/=+$/,""):""}
function viewImpostazioni(){
  let h=`<div class="page-h"><span class="eyebrow">Serkis Coach ${VERSION}</span><h1 class="disp">Impostazioni</h1></div><div class="fgrid">`;
  if(S.mode==="app"){
    let host="";try{host=new URL(S.cfg.url).host}catch(e){}
    h+=`<section class="sec"><div class="sec-h"><h3>Collegamento</h3></div><dl class="kv"><dt>Backend</dt><dd class="mono">${esc(host)} · Google Apps Script</dd><dt>Stato</dt><dd>${S.load.state==="error"?`<span class="err-t">${esc(errText(S.load.err))}</span>`:"Collegato"}</dd></dl></section>
    <section class="sec"><div class="sec-h"><h3>Collega un altro dispositivo</h3></div><p class="hint">Copia il codice, mandalo a te stesso e incollalo al primo avvio dell'app sull'altro dispositivo. Contiene la chiave: non condividerlo.</p><div class="ed-row" style="margin-top:8px"><button class="btn" type="button" data-act="copy-code">${ICON.copy}Copia codice di collegamento</button></div></section>
    <section class="sec"><div class="sec-h"><h3>Installa l'icona</h3></div><ul class="steps"><li><b>iPhone</b>: apri questa pagina in Safari → Condividi → Aggiungi alla schermata Home.</li><li><b>Android</b>: Chrome → menu ⋮ → Installa app.</li><li><b>PC</b>: Chrome o Edge → icona Installa nella barra dell'indirizzo, oppure menu → Installa Serkis Coach.</li></ul></section>
    <section class="sec"><div class="sec-h"><h3>Analisi AI</h3></div><p class="hint">L'analisi con Claude resta nel <a href="${CRUSCOTTO_URL}" target="_blank" rel="noopener">cruscotto su claude.ai ↗</a>, che legge gli stessi dati e le stesse note. Da un atleta puoi anche copiare i dati pronti da incollare in Claude.</p></section>`;
  }else{
    h+=`<section class="sec"><div class="sec-h"><h3>Collegamento</h3></div><p class="hint">Questa è la versione su claude.ai: legge Notion, Google Sheets e Drive con i tuoi connettori. L'app installabile con il logo usa gli stessi dati e le stesse note.</p></section>`;
  }
  h+=`<section class="sec"><div class="sec-h"><h3>Dati</h3></div><dl class="kv"><dt>Atleti</dt><dd>Notion · Coaching e Valutazione funzionale</dd><dt>Schede e test</dt><dd>Google Sheets su Drive</dd><dt>Note e segnali</dt><dd><a href="${NOTES_URL}" target="_blank" rel="noopener">SERKIS APP — Note ↗</a></dd></dl><div class="ed-row" style="margin-top:10px"><button class="btn" type="button" data-act="reload">Aggiorna tutti i dati</button></div></section>`;
  if(S.mode==="app")h+=`<section class="sec"><div class="sec-h"><h3>Questo dispositivo</h3></div><button class="btn ghost" type="button" data-act="unlink">${S.unlinkArm?"Conferma: scollega":"Scollega questo dispositivo"}</button></section>`;
  return h+`</div>`;
}
function viewSetup(){
  return`<div class="setup"><svg class="logo" viewBox="118 100 276 312" aria-hidden="true">${MARK}</svg>
    <div><span class="eyebrow">Primo avvio</span><h1 class="disp" style="font-size:56px">Collega Serkis Coach</h1></div>
    <p class="hint" style="font-size:14px">Incolla la chiave che trovi nel registro di Apps Script, alla riga "CHIAVE APP". Su un altro dispositivo puoi incollare invece il codice di collegamento copiato dalle Impostazioni dell'app.</p>
    <form class="fgrid" id="setupform" autocomplete="off">
      <label class="fld"><span>Chiave</span><input class="inp" id="su-key" autocapitalize="off" spellcheck="false" placeholder="incolla la CHIAVE APP"></label>
      <p class="hint">oppure</p>
      <label class="fld"><span>Codice di collegamento</span><textarea class="inp" id="su-code" placeholder="SERKIS1.…"></textarea></label>
      <label class="fld"><span>Indirizzo backend</span><input class="inp" id="su-url" value="${esc(DEFAULT_BACKEND)}"></label>
      <div class="ed-row"><button class="btn red" type="submit" ${S.setupBusy?"disabled":""}>${S.setupBusy?"Provo il collegamento…":"Collega"}</button>${S.setupErr?`<span class="err-t">${esc(S.setupErr)}</span>`:""}</div>
    </form></div>`;
}

/* ================= routing ================= */
function route(silent){
  const h=decodeURIComponent(location.hash.slice(1));
  const prevSel=S.sel;
  if(h.startsWith("a-")){const a=S.athletes.find(x=>x.slug===h.slice(2));S.view="atleta";S.sel=a?a.id:(S.athletes.length?null:S.sel);
    if(a&&prevSel!==a.id){S.edit=null;S.delArm=null;if(a.sheetId&&!S.sheets[a.id])loadOneSheet(a,false);if(!silent)window.scrollTo(0,0)}}
  else if(["oggi","atleti","nuovo","impostazioni"].includes(h)){if(h!=="nuovo"&&h!=="impostazioni"&&h!=="atleta")S.prev=h;S.view=h;if(h==="atleti")S.sel=null}
  else S.view="oggi";
  if(!silent)render();
}
function go(r){if(location.hash.slice(1)===r)route(false);else{S.nav=(S.nav||0)+1;location.hash=r}}
window.addEventListener("hashchange",()=>{route(false);window.scrollTo(0,0)});

/* ================= eventi ================= */
document.addEventListener("click",async ev=>{
  const t=ev.target.closest("button,[data-id]");if(!t)return;
  const a=byId(S.sel);
  if(t.dataset.id){const x=byId(t.dataset.id);if(x){if(S.view!=="atleta")S.prev=S.view==="oggi"?"oggi":"atleti";go("a-"+x.slug)}return}
  if(t.dataset.go){if(t.dataset.go==="nuovo"){initNuovo("scheda",S.view==="atleta"&&a?a.id:"")}go(t.dataset.go);return}
  if(t.dataset.focus){S.filter.focus=t.dataset.focus;go("atleti");render();return}
  if(t.dataset.sede){S.filter.sede=t.dataset.sede;savePrefs();render();return}
  if(t.dataset.new){initNuovo(t.dataset.new,t.dataset.aid||"");go("nuovo");return}
  if(t.dataset.nk){S.nuovo.kind=t.dataset.nk;S.nuovo.tpl="";S.nuovo.titleEdited=false;S.nuovo.notion=notionDefault(byId(S.nuovo.aid),t.dataset.nk);S.nuovo.date=iso(t.dataset.nk==="scheda"?nextMonday():today());render();return}
  if(t.dataset.tab&&a){S.tab=t.dataset.tab;S.edit=null;savePrefs();render();return}
  if(t.dataset.sess&&a){S.sessSel[a.id]=t.dataset.sess;S.edit=null;render();return}
  if(t.dataset.edit){startEdit(+t.dataset.edit,t.dataset.sheet);return}
  if(t.dataset.slot){startEdit(+t.dataset.slot,t.dataset.sheet);return}
  if(t.dataset.alt&&a){S.alt[a.id]={id:t.dataset.alt,title:t.dataset.title};S.tab="scheda";S.edit=null;render();return}
  if(t.dataset.sig&&a){t.disabled=true;await addNote(a,{kind:"segnale",signal:t.dataset.sig,text:t.dataset.sig==="auto"?"":"Segnale impostato da te: "+LV[t.dataset.sig],week:a.wk&&!a.wk.future?a.wk.week:null});return}
  if(t.dataset.del){if(S.delArm!==t.dataset.del){S.delArm=t.dataset.del;render();return}const id=S.delArm;S.delArm=null;delNote(id);return}
  const act=t.dataset.act;if(!act)return;
  if(act==="back"){if(S.nav>0){S.nav--;history.back()}else go(S.view==="atleta"?(S.prev||"atleti"):"oggi");return}
  if(act==="clear-focus"){S.filter.focus=null;render();return}
  if(act==="reload"){S.bodies={};S.files={};S.tests={};loadAll(true);return}
  if(act==="reload-sheet"&&a){if(S.alt[a.id]){S.alt[a.id].sh=null;ensureAlt(a)}else loadOneSheet(a,true);return}
  if(act==="reload-tests"&&a){ensureTests(a,true);return}
  if(act==="reload-files"&&a){ensureFiles(a,true);return}
  if(act==="reload-page"&&a){ensurePage(a,true);return}
  if(act==="alt-off"&&a){delete S.alt[a.id];S.edit=null;render();return}
  if(act==="edit-cancel"){S.edit=null;S.editErr=null;render();return}
  if(act==="history"&&a){loadHistory(a);return}
  if(act==="ai"&&a){runAI(a);return}
  if(act==="ai-save"&&a){const r=S.ai[a.id];if(!r||!r.text)return;if(await addNote(a,{kind:"ai",text:r.text,week:a.wk&&!a.wk.future?a.wk.week:null}))r.saved=true;render();return}
  if(act==="copy-ai"&&a){copyText(aiPrompt(a),"Dati copiati: incollali in Claude");return}
  if(act==="copy-code"){copyText(linkCode(),"Codice copiato");return}
  if(act==="unlink"){if(!S.unlinkArm){S.unlinkArm=true;render();return}store.del("cfg");store.del("cache");location.hash="";location.reload();return}
  if(act==="new-again"){initNuovo(S.nuovo?S.nuovo.kind:"scheda",S.nuovo?S.nuovo.aid:"");render();return}
  if(act==="open-created"){const c=S.created;const x=byId(c.aid);if(!x)return;
    if(c.kind==="scheda"&&x.sheetId!==c.id)S.alt[x.id]={id:c.id,title:c.title};
    S.tab=c.kind==="scheda"?"scheda":"test";if(c.kind!=="scheda"){delete S.tests[x.id];S.sessSel[x.id]=c.id+"|"}
    S.prev="atleti";go("a-"+x.slug);return}
});
document.addEventListener("input",ev=>{
  const t=ev.target;
  if(t.closest("#editor")&&t.dataset.col!=null&&S.edit){S.edit.vals[t.dataset.col]=t.value;return}
  if(t.id==="note-text"&&S.sel){S.drafts[S.sel]=t.value;return}
  if(t.id==="q"){S.filter.q=t.value;renderSide();return}
  if(t.id==="nf-title"){S.nuovo.title=t.value;S.nuovo.titleEdited=true;return}
  if(t.id==="nf-date"){S.nuovo.date=t.value;return}
});
document.addEventListener("change",ev=>{
  const t=ev.target;
  if(t.id==="stato"){S.filter.stato=t.value;savePrefs();render();return}
  if(t.id==="sort"){S.sort=t.value;savePrefs();render();return}
  if(t.id==="nf-aid"){S.nuovo.aid=t.value;const a=byId(t.value);if(a&&a.dur)S.nuovo.weeks=a.dur;S.nuovo.titleEdited=false;S.nuovo.notion=notionDefault(a,S.nuovo.kind);render();return}
  if(t.id==="nf-tpl"){S.nuovo.tpl=t.value;return}
  if(t.id==="nf-weeks"){S.nuovo.weeks=+t.value;return}
  if(t.id==="nf-date"){S.nuovo.date=t.value;if(!S.nuovo.titleEdited)render();return}
  if(t.id==="nf-notion"){S.nuovo.notion=t.checked;return}
});
document.addEventListener("focusout",()=>{setTimeout(()=>{if(pendingMain){const ae=document.activeElement;if(!(ae&&$("#main").contains(ae)&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)))render()}},0)});
document.addEventListener("submit",async ev=>{
  const f=ev.target;ev.preventDefault();
  const a=byId(S.sel);
  if(f.id==="editor"){saveEdit();return}
  if(f.id==="noteform"&&a){const txt=$("#note-text").value.trim();if(!txt){toast("Scrivi qualcosa prima di salvare");return}
    const ok=await addNote(a,{kind:$("#note-kind").value,text:txt,week:parseInt($("#note-week").value,10)||null});if(ok){S.drafts[a.id]="";toast("Nota salvata");render()}return}
  if(f.id==="linkform"&&a){const url=$("#link-url").value.trim();if(!sheetIdOf(url)){toast("Incolla un link di Google Sheets");return}
    if(await addNote(a,{kind:"file",text:url,signal:$("#link-kind").value})){delete S.files[a.id];delete S.tests[a.id];toast("File collegato");ensureFiles(a,true)}return}
  if(f.id==="newform"){const s=$("#nf-tpl");if(s)S.nuovo.tpl=s.value;const ti=$("#nf-title");if(ti&&ti.value.trim()!==defaultTitle(S.nuovo)){S.nuovo.title=ti.value;S.nuovo.titleEdited=true}doCreate();return}
  if(f.id==="setupform"){doSetup();return}
});
$("#refresh").addEventListener("click",()=>{if(S.adapter){S.bodies={};S.files={};S.tests={};loadAll(true)}});
let toastT=0;
function toast(m){const el=$("#toast");el.textContent=m;el.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{el.hidden=true},2600)}
async function copyText(txt,msg){try{await navigator.clipboard.writeText(txt);toast(msg)}catch(e){const ta=document.createElement("textarea");ta.value=txt;ta.style.cssText="position:fixed;opacity:0";document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand("copy")}catch(x){}ta.remove();toast(ok?msg:"Copia non riuscita")}}
async function runAI(a){
  const st=S.ai[a.id]={status:"running",text:""};renderSoon();
  try{if(!S.bodies[a.id])await ensurePage(a);
    const r=await S.adapter.sample(aiPrompt(a),{cache:false,onText:({text})=>{st.text=text;renderSoon()}});st.text=r.text||st.text;st.status="done"}
  catch(e){st.status="error";st.msg=e&&e.code==="not_granted"?"Serve il consenso per far usare Claude a questa pagina.":e&&e.code==="rate_limited"?"Troppe richieste ravvicinate: riprova tra qualche minuto.":"Analisi non riuscita"+(e&&e.code?" ("+e.code+")":"")+"."}
  renderSoon();
}
function decodeCode(c){c=String(c||"").trim();const m=c.match(/SERKIS1\.([A-Za-z0-9+/_-]+)/);if(!m)return null;try{const j=JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g,"+").replace(/_/g,"/")))));return j.u&&j.k?{url:j.u,key:j.k}:null}catch(e){return null}}
async function doSetup(){
  const code=$("#su-code").value,cfg=decodeCode(code)||{url:$("#su-url").value.trim(),key:$("#su-key").value.trim()};
  if(!/^https:\/\/script\.google(usercontent)?\.com\//.test(cfg.url)||!cfg.key){S.setupErr="Serve il codice, oppure indirizzo /exec e chiave.";render();return}
  S.setupBusy=true;S.setupErr=null;render();
  const ad=scriptAdapter(cfg);
  try{await ad.ping();store.set("cfg",cfg);S.cfg=cfg;S.adapter=ad;S.setupBusy=false;go("oggi");loadAll(false)}
  catch(e){S.setupBusy=false;S.setupErr=e&&e.code==="auth"?"Chiave non valida.":errText(e);render()}
}

/* ================= avvio ================= */
const MARK=document.querySelector(".brand svg").innerHTML;
async function boot(){
  if(S.mode==="app"){
    const hm=location.hash.match(/collega=([^&]+)/);
    if(hm){const c=decodeCode("SERKIS1."+hm[1].replace(/^SERKIS1\./,""));if(c){store.set("cfg",c)}history.replaceState(null,"",location.pathname+"#oggi")}
    S.cfg=store.get("cfg",null);
    if(!S.cfg){render();return}
    S.adapter=scriptAdapter(S.cfg);
    cacheLoad();route(true);render();
    loadAll(false);
    if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
    return;
  }
  route(true);render();
  const [mcp,sample]=await Promise.all([window.claude.use("mcp"),window.claude.use("sample")]);
  if(!mcp){S.load={state:"error",err:{code:"not_granted"},at:null};S.adapter={caps:{},batch:1};render();return}
  S.adapter=claudeAdapter(mcp,sample);
  cacheLoad();route(true);render();loadAll(false);
}
if(window.SERKIS_MOCK){S.mode="app";S.cfg={url:"https://script.google.com/macros/s/x/exec",key:"x"};S.adapter=window.SERKIS_MOCK;route(true);render();loadAll(false)}
else boot();
})();
