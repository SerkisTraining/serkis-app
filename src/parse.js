/* ================= lettura fogli ================= */
// Riconosce: template Serkis (G1 · ESERCIZIO · SCHEMA E REST · NOTE · FEEDBACK S1–S6),
// schede vecchie (GIORNO N · ESERCIZIO - SERIE x REP/TEMPO con esercizio e schema nella stessa cella,
// feedback ➊–➏ anche su colonne senza intestazione, oppure colonne "Sett #N"), schede VF, test e valutazioni.
function isHdrCell(c){const u=String(c||"").trim().toUpperCase();return u==="VOCE"||(u.startsWith("ESERCIZIO")&&u.length<=40)}
function colKey(label){
  const u=label.toUpperCase().trim();
  if(u.startsWith("ESERCIZIO"))return /SERIE|REP|SCHEMA/.test(u)?"exs":"ex";
  if(u==="VOCE")return"ex";
  if(u.startsWith("SCHEMA"))return"schema";if(u.startsWith("NOTE"))return"note";if(u.startsWith("FEEDBACK"))return"fb";
  if(/^SETT(IMANA)?\.?\s*#?\s*\d+$/.test(u))return"fb";
  if(u.startsWith("PROTOCOLLO"))return"prot";if(u.startsWith("RISULTATO"))return"ris";if(u==="SERIE")return"serie";
  if(u.startsWith("RIP"))return"rip";if(u.startsWith("RECUPERO"))return"rec";if(u.startsWith("TIPOLOGIA"))return"tipo";
  return"x";
}
const MONO={schema:1,serie:1,rip:1,rec:1,ris:1,exs:1};
function slotTitle(t){const m=String(t).trim().match(/^(G|D|DAY|GIORNO|SEDUTA)\s*(\w+)$/i);if(!m)return t;const k=m[1].toUpperCase();return(k==="G"||k==="GIORNO"?"Giorno ":k==="SEDUTA"?"Seduta ":"Day ")+m[2]}
const METH=/^(jump ?set|super ?set|superserie|giant ?set|circuito|emom|amrap|ladder|cluster|ramping|tabata|rt\b|rest\b|recuper|poi fai|dopo |riscald|defatic|finisher)/i;
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
  return it.ex.split("\n").map(s=>s.trim()).filter(Boolean)[0]||it.ex;
}
function metaDate(rows){
  for(let r=0;r<Math.min(14,rows.length);r++){
    const row=rows[r];if(!row.some(c=>/training program|periodo|data\b/i.test(c)))continue;
    for(const c of row){const d=parseIt(c);if(d)return d}
  }
  for(let r=0;r<Math.min(14,rows.length);r++)for(const c of rows[r]){if(c.length<=40){const d=parseIt(c);if(d)return d}}
  return null;
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
  out.meta.when=parseIt(out.meta.periodo)||parseIt(out.meta.data)||metaDate(rows);
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
    // colonne di feedback senza intestazione (es. ➍–➏ a destra di FEEDBACK)
    const lastHdr=cols[cols.length-1];
    if(lastHdr&&lastHdr.key==="fb"){
      let maxC=hi;secRows.forEach(r=>{rows[r].forEach((c,ci)=>{if(c.trim()&&ci>maxC&&ci<=hi+4)maxC=ci})});
      for(let c=hi+1;c<=maxC;c++)if(secRows.some(r=>(rows[r][c]||"").trim())&&!(row[c]||"").trim())cols.push({c,label:"FEEDBACK",key:"fb",week:null,extra:true});
    }
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
  const re=/(^|[\s;,(|])((?:week|wk|sett(?:imana)?\.?)\s*#?\s*(\d{1,2})\s*[-–—:.)]?|(?:w|s)\s?(\d{1,2})\s*[-–—:.)])/gi;
  const marks=[];let m;
  while((m=re.exec(txt))){marks.push({i:m.index+m[1].length,end:m.index+m[0].length,w:+(m[3]||m[4])})}
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
  const entries=[];
  String(schema||"").split("\n").forEach(line=>{
    const parts=line.split("//").map(s=>s.trim()).filter(Boolean),found=[];
    parts.forEach((pt,pi)=>{
      if(/^(-?\s*rest|rxt|recupero)\b/i.test(pt))return;
      const wm=pt.match(/sett\.?\s*(\d{1,2})(?:\s*[-–\/]\s*(\d{1,2}))?/i);
      const body=pt.replace(/\(?\s*sett\.?\s*\d{1,2}(?:\s*[-–\/]\s*\d{1,2})?\s*\)?/i,"").trim();
      const srs=[...body.matchAll(/(\d{1,2})\s*[x×]\s*\(?\s*(\d{1,3})(?:\s*[-–\/]\s*(\d{1,3}))?/g)];
      let sets=srs.reduce((a,x)=>a+(+x[1]),0),reps=srs.length?+srs[0][2]:0;
      if(!srs.length){const dm=body.match(/^(\d{1,2})(?:\s*-\s*(\d{1,2})){1,9}\b/);if(dm){const ns=dm[0].split("-").map(Number);sets=ns.length;reps=ns[0]}}
      if(!sets){const em=body.match(/EMOM\s*(\d{1,2})\s*['’′]/i);if(em){sets=+em[1];const r=body.match(/(\d{1,2})\s*rep/i);reps=r?+r[1]:0}}
      const kg=kgOf(body);
      if(!sets&&kg==null)return;
      found.push({pi,w1:wm?+wm[1]:null,w2:wm?+(wm[2]||wm[1]):null,sets,reps,kg});
    });
    if(parts.length>1&&found.length&&found.every(e=>e.w1==null))found.forEach(e=>{e.w1=e.w2=e.pi+1});
    entries.push(...found);
  });
  return{entries};
}
function planUnits(sec,it){
  const sc=sec.cols.find(c=>c.key==="schema"),exs=sec.cols.find(c=>c.key==="exs");
  if(sc)return[{label:exLabel(sec,it),text:it.cells[sc.c]}];
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
      ex.push({label:u.label,where:sec.title,perW,hasKg:perW.some(p=>p&&p.kg!=null)});
    })}));
  return{ex,weekly,skipped};
}
function maxWeek(P){let m=0;P.sections.forEach(s=>s.items.forEach(it=>{if(!it.empty)planUnits(s,it).forEach(u=>parsePlan(u.text).entries.forEach(e=>{if(e.w2)m=Math.max(m,e.w2)}))}));return m}
function hasPlan(P){return P.sections.some(s=>s.cols.some(c=>c.key==="schema"||c.key==="exs"))}
function exKey(label){return norm(label).replace(/\b(bilanciere|manubri|manubrio|kb|kettlebell|tecnico|tecnica|alla|fronte|parallele|mono|con|al|in)\b/g," ").replace(/[^a-z0-9]+/g," ").trim()}

