/* Lettore delle schede per la pagina cliente e per l'app del coach.
   Template supportati: "Programmazione" (GIORNO A/B/C, PROTOCOLLO, FEEDBACK con righe "Sett. N:")
   e "Serkistraining" (G1/G2/G3, SCHEMA E REST, FEEDBACK con righe "SN  │"). */
const SK=(()=>{
  const MARK=/\((?:sett\.?|settimane?|s)\s*(\d+)(?:\s*[-\/]\s*(\d+))?\)\s*/i;
  const DAY=/^(GIORNO|G|DAY|SEDUTA)\s*([A-Z0-9]{1,3})$/i;
  const clean=v=>String(v==null?"":v).replace(/\r/g,"").trim();

  // Settimana a inizio riga: "sett. 1  4×2", "Sett. 2-3: …", "sett. 1 — 2 giri", oppure "sett. 1" da solo come titolo di un blocco
  const LEAD=/^\s*(?:settimane?|settimana|sett\.?|s(?=\s*\d))\s*(\d{1,2})(?:\s*[-–\/]\s*(\d{1,2}))?(?=\s|$|[:—–\-).])[\s:—–\-).]*/i;
  const TRAIL=/^\s*(rest|recupero|riposo|rec\.)\b/i;
  // Dose della settimana w. Due modi di scrivere le settimane:
  // 1) "(sett. X)" dentro la riga: le righe senza marcatore valgono sempre; il testo prima del marcatore ("Emom:") passa alle righe sorelle.
  // 2) "sett. X" a inizio riga: la riga (e quelle subito sotto, fino a una riga vuota) vale solo per quelle settimane;
  //    le righe dopo una riga vuota, e "Rest …" in coda, valgono per tutte.
  // 3) "(Sett. 1/2)" da solo in fondo a un blocco (es. onde): vale per il blocco sopra, lungo quanto i blocchi che seguono.
  const ONLY=new RegExp("^\\s*"+MARK.source.replace(/\\s\*$/,"")+"\\s*$","i");
  function closeBlocks(lines,w){
    if(!lines.some(l=>ONLY.test(l)))return lines;
    const paras=[];let cur=[];
    lines.forEach(l=>{if(!l.trim()){if(cur.length)paras.push(cur);cur=[];paras.push(null)}else cur.push(l)});if(cur.length)paras.push(cur);
    const P=paras.filter(Boolean),ends=[];
    P.forEach((p,i)=>{if(ONLY.test(p[p.length-1]))ends.push(i)});
    const size=ends.length>1?ends[1]-ends[0]:1,wk={};
    ends.forEach((e,k)=>{const m=P[e][P[e].length-1].match(MARK),a=+m[1],b=m[2]?+m[2]:a;const from=k?ends[k-1]+1:Math.max(0,e-size+1);for(let i=from;i<=e;i++)wk[i]={a,b}});
    const out=[];let pi=0;
    paras.forEach(p=>{if(!p){out.push("");return}const r=wk[pi++];
      if(!r){out.push(...p);return}
      if(w>=r.a&&w<=r.b)out.push(...p.filter(l=>!ONLY.test(l)))});
    return out;
  }
  function doseFor(text,w){
    // più settimane sulla stessa riga separate da "//": una riga per settimana
    let lines=[];
    String(text||"").replace(/\r/g,"").split("\n").forEach(l=>{
      if((l.match(new RegExp(MARK.source,"gi"))||[]).length>1)l.split("//").map(x=>x.trim()).filter(Boolean).forEach(x=>lines.push(x));
      else lines.push(l.replace(/\s*\/\/\s*$/,""));
    });
    lines=closeBlocks(lines,w);
    if(lines.some(l=>LEAD.test(l))){
      const keep=[];let blk=null;
      for(const raw of lines){
        const m=raw.match(LEAD);
        if(m){const a=+m[1],b=m[2]?+m[2]:a;blk={a,b};const rest=raw.slice(m[0].length).trim();if(rest&&w>=a&&w<=b)keep.push(rest);continue}
        if(!raw.trim()){blk=null;keep.push("");continue}
        if(blk&&!TRAIL.test(raw)){if(w>=blk.a&&w<=blk.b)keep.push(raw);continue}
        blk=null;keep.push(raw);
      }
      lines=keep;
    }
    const out=[];let prefix="";
    for(const raw of lines){
      const m=raw.match(MARK);
      if(!m){prefix="";out.push(raw);continue}
      const before=raw.slice(0,m.index).trim();if(before)prefix=before;
      const a=+m[1],b=m[2]?+m[2]:a;
      if(w>=a&&w<=b)out.push(((prefix?prefix+" ":"")+raw.slice(m.index+m[0].length)).trim());
    }
    return out.join("\n").replace(/\n{3,}/g,"\n\n").trim();
  }
  function leadWeeks(text){let m=0;String(text||"").split("\n").forEach(l=>{const k=l.match(LEAD);if(k)m=Math.max(m,+(k[2]||k[1]))});return m}
  function hasWeeks(text){return MARK.test(String(text||""))||leadWeeks(text)>0}

  // Settimane in cui la nota chiede un video. Nessuna settimana indicata = tutte.
  function video(note,n){
    const s=String(note||"").split(/(?<=[.!?])\s+|\n+/).find(x=>/video/i.test(x));
    if(!s)return null;
    const tail=s.slice(s.search(/video/i));
    const nums=/settiman|sett\./i.test(s)?[...tail.matchAll(/(\d+(?:[.,]\d+)?)(?!\s*(?:kg|rep|x|×|″|"|'|′|%|[.,]?\d))/gi)].map(m=>+m[1].replace(",",".")).filter(x=>Number.isInteger(x)&&x>=1&&x<=n):[];
    return{weeks:nums.length?[...new Set(nums)]:Array.from({length:n},(_,i)=>i+1),text:s.trim()};
  }

  // Riga della settimana w nella cella FEEDBACK
  function readFb(cell,w){
    const re=new RegExp("^\\s*(?:Sett\\.?\\s*|S)"+w+"\\s*(?::|│)\\s*(.*)$");
    const l=String(cell||"").split("\n").find(x=>re.test(x));
    return l?l.match(re)[1].trim():"";
  }
  function fbWeeks(cell){return(String(cell||"").match(/^\s*(?:Sett\.?\s*|S)(\d+)\s*(?::|│)/gm)||[]).length}

  // Testo che va nel foglio, e lettura al contrario per riprendere un feedback già inviato
  const PART_WHY=["Carico troppo alto","Stanchezza","Fastidio","Tecnica che cedeva","Poco tempo","Altro"];
  // Maschile o femminile: scelto dal coach, altrimenti indovinato dal nome
  const MALE_A=/^(andrea|luca|nicola|mattia|elia|tobia|enea|gianluca|gianmattia|zaccaria|isaia|geremia|giosia|joshua|battista|evangelista|nicolò|nicolo)$/i;
  function genderOf(name,set){if(set==="f"||set==="m")return set;const n=String(name||"").trim().split(/\s+/)[0]||"";if(MALE_A.test(n))return"m";return /a$/i.test(n)?"f":"m"}
  function word(n){return n<=4?"facile":n<=7?"medio":"duro"}
  function line(f){
    if(f.skip)return"SALTATO · "+clean(f.why);
    const part=f.part?"non chiuso: "+([f.partWhy?f.partWhy.toLowerCase():null,clean(f.partDone)?"fatto "+clean(f.partDone).replace(/\s+·\s+/g,", "):null].filter(Boolean).join(", ")||"—"):null;
    return[`RPE ${f.rpe} (${word(f.rpe)})`,`tecnica ${f.tec.toLowerCase()}`,part,f.pain!=null?`fastidio ${f.pain}/10`:null,clean(f.nota)||null].filter(Boolean).join(" · ");
  }
  function unline(s){
    s=clean(s);if(!s)return null;
    const sk=s.match(/^SALTATO\s*·?\s*(.*)$/i);if(sk)return{skip:true,why:sk[1]};
    const f={},parts=s.split(" · ");const rest=[];
    parts.forEach(p=>{let m;
      if((m=p.match(/^RPE\s*(\d{1,2})/i)))f.rpe=+m[1];
      else if((m=p.match(/^tecnica\s+(pulita|così così|da rivedere)$/i)))f.tec=m[1][0].toUpperCase()+m[1].slice(1);
      else if((m=p.match(/^fastidio\s*(\d{1,2})\s*\/\s*10$/i)))f.pain=+m[1];
      else if((m=p.match(/^non chiuso:?\s*(.*)$/i))){f.part=true;const x=m[1],k=PART_WHY.find(r=>x.toLowerCase().startsWith(r.toLowerCase()));if(k)f.partWhy=k;const d=x.match(/fatto\s+(.*)$/i);if(d)f.partDone=d[1]}
      else rest.push(p)});
    if(!f.rpe&&!f.tec)return{free:s};
    f.nota=rest.join(" · ");return f;
  }
  function rpeOf(s){const m=String(s||"").match(/\bRPE\s*(\d{1,2})\b/i);return m?+m[1]:null}

  function dayName(m){const k=m[1].toUpperCase();return(k==="SEDUTA"?"Seduta ":k==="DAY"?"Day ":"Giorno ")+m[2].toUpperCase()}

  function parse(values){
    const rows=(values||[]).map(r=>(r||[]).map(clean));
    const out={days:[],nb:[],methods:{},weeks:null,start:null};
    // intestazione: durata e data di inizio nelle prime righe
    for(let r=0;r<Math.min(12,rows.length);r++)for(const c of rows[r]){
      if(out.weeks==null){const m=c.match(/(\d{1,2})\s*settimane/i);if(m)out.weeks=+m[1]}
      if(!out.start){const m=c.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(m)out.start=new Date(+m[3],+m[2]-1,+m[1])}
    }
    let pendingDay=null,cur=null;
    for(let r=0;r<rows.length;r++){
      const row=rows[r],first=row.findIndex(c=>c);
      if(first<0){cur=null;continue}
      const u=row[first].toUpperCase();
      if(u==="NB"){
        const txt=row.slice(first+1).find(c=>c)||"";
        out.nb=txt.split("\n").map(l=>l.replace(/^[•·\-\s]+/,"").trim()).filter(Boolean).map(l=>{const m=l.match(/^([^:]{2,40}):\s*(.+)$/);return m?{t:m[1].trim()+":",d:m[2].trim()}:{t:"",d:l}});
        continue;
      }
      if(/^METODI PRESENTI/i.test(row[first])){
        const nx=(rows[r+1]||[]).find(c=>c)||"";
        nx.split(/\n\s*\n/).forEach(b=>{const m=b.trim().match(/^([A-ZÀ-Ü][A-ZÀ-Ü0-9 \-]{1,24}):\s*([\s\S]+)$/);if(m)out.methods[m[1].trim().toUpperCase()]=m[2].trim()});
        r++;cur=null;continue;
      }
      const iName=row.findIndex(c=>/^ESERCIZIO/i.test(c)),iFb=row.findIndex(c=>/FEEDBACK/i.test(c));
      const dm=row.map(c=>c.match(DAY)).find(Boolean);
      if(iName>=0&&iFb>=0){
        const label=dm?dayName(dm):pendingDay||("Giorno "+(out.days.length+1));
        cur={label,row:r+1,cols:{name:iName,fb:iFb,dose:row.findIndex(c=>/PROTOCOLLO|SCHEMA|SET\b|SERIE/i.test(c)),note:row.findIndex(c=>/^NOTE/i.test(c))},items:[]};
        out.days.push(cur);pendingDay=null;continue;
      }
      if(dm&&row.filter(c=>c).length<=3+12){pendingDay=dayName(dm);cur=null;continue}
      if(!cur)continue;
      let name=row[cur.cols.name]||"",dose=cur.cols.dose>=0?row[cur.cols.dose]||"":"";
      if(!name)continue;
      // "ESERCIZIO - SET x REPS": nome e schema nella stessa cella → nome = primo paragrafo, schema = il resto
      if(cur.cols.dose===cur.cols.name){const k=name.search(/\n\s*\n/);if(k>0){dose=name.slice(k).trim();name=name.slice(0,k).trim()}else{const L=name.split("\n");name=L[0];dose=L.slice(1).join("\n").trim()}}
      cur.items.push({
        name:name.replace(/\n\s*(?:SS|\+)\s*\n/gi," + ").replace(/\n+/g," "),
        dose:dose,
        note:cur.cols.note>=0?row[cur.cols.note]||"":"",
        fb:row[cur.cols.fb]||"",row:r+1,col:cur.cols.fb+1
      });
    }
    out.days=out.days.filter(d=>d.items.length);
    if(out.weeks==null){let m=0;out.days.forEach(d=>d.items.forEach(it=>{m=Math.max(m,fbWeeks(it.fb),leadWeeks(it.dose));(it.dose.match(new RegExp(MARK.source,"gi"))||[]).forEach(x=>{const k=x.match(MARK);m=Math.max(m,+(k[2]||k[1]))})}));out.weeks=m||null}
    return out;
  }

  // Termini spiegati nella sezione METODI presenti nella dose
  function methodsIn(text,methods){
    const t=String(text||"");
    return Object.keys(methods).filter(k=>new RegExp("(^|[^A-Za-zÀ-ü])"+k.replace(/[-\s]+/g,"[\\s-]*")+"(?![A-Za-zÀ-ü])","i").test(t));
  }

  // Avvisi: stesso esercizio a RPE 10 (o a RPE ≤6) per 3 settimane di fila, ed esercizi saltati
  function alerts(P,upto){
    const out=[];
    P.days.forEach(d=>d.items.forEach(it=>{
      let run10=0,runLow=0,best10=0,bestLow=0,end10=0,endLow=0,runPart=0,partWarned=false;
      for(let w=1;w<=(upto||12);w++){
        const s=readFb(it.fb,w),r=rpeOf(s);
        if(r===10){run10++;if(run10>=best10){best10=run10;end10=w}}else run10=0;
        if(r!=null&&r<=6){runLow++;if(runLow>=bestLow){bestLow=runLow;endLow=w}}else runLow=0;
        if(/(^|·\s*)non chiuso/i.test(s)){runPart++;if(runPart>=2&&!partWarned){partWarned=true;out.push({kind:"part",level:"warn",day:d.label,ex:it.name,week:w,text:it.name+": schema non completato per 2 settimane di fila (fino alla sett. "+w+")"})}}else runPart=0;
        if(/^SALTATO/i.test(s))out.push({kind:"skip",level:"warn",day:d.label,ex:it.name,week:w,text:it.name+": saltato in sett. "+w+(s.replace(/^SALTATO\s*·?\s*/i,"")?" ("+s.replace(/^SALTATO\s*·?\s*/i,"")+")":"")});
      }
      if(best10>=3)out.push({kind:"hard",level:"bad",day:d.label,ex:it.name,week:end10,text:it.name+": RPE 10 per "+best10+" settimane di fila (fino alla sett. "+end10+")"});
      if(bestLow>=3)out.push({kind:"easy",level:"warn",day:d.label,ex:it.name,week:endLow,text:it.name+": RPE 6 o meno per "+bestLow+" settimane di fila (fino alla sett. "+endLow+")"});
    }));
    return out;
  }

  return{PART_WHY,genderOf,doseFor,hasWeeks,video,readFb,fbWeeks,line,unline,rpeOf,word,parse,methodsIn,alerts};
})();
if(typeof module!=="undefined")module.exports=SK;
