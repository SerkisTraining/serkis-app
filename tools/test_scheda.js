// Prova del lettore schede sui due template reali (celle copiate dai fogli di Gianfree Fiore 2.0 e Mattia Minischetti)
// Uso: node tools/test_scheda.js
const SK=require("../src/scheda.js");
const {GF,MM}=require("./fixtures.js");
let err=0;const ok=(c,m)=>{if(!c){err++;console.log("  ✗ "+m)}};
for(const [nome,V,expDays,expWeeks] of [["Gianfree (Programmazione)",GF,["Giorno A","Giorno B","Giorno C"],6],["Mattia (Serkistraining)",MM,["Giorno 1","Giorno 2","Giorno 3"],5]]){
  const P=SK.parse(V);
  console.log(`\n=== ${nome}: ${P.days.map(d=>d.label+" ("+d.items.length+")").join(" · ")} · ${P.weeks} sett. dal ${P.start&&P.start.toLocaleDateString("it")} · NB ${P.nb.length} · metodi ${Object.keys(P.methods).join(", ")||"—"}`);
  ok(JSON.stringify(P.days.map(d=>d.label))===JSON.stringify(expDays),"giornate "+P.days.map(d=>d.label));
  ok(P.weeks===expWeeks,"settimane "+P.weeks);
  P.days.forEach(d=>d.items.forEach(it=>{
    ok(/FEEDBACK/i.test(V[d.row-1][it.col-1]),it.name+": colonna feedback sbagliata");
    ok(V[it.row-1][it.col-1].trim()===it.fb,it.name+": riga/colonna sbagliata");
    for(let w=1;w<=P.weeks;w++){const ds=SK.doseFor(it.dose,w);ok(ds&&!SK.hasWeeks(ds),it.name+" sett."+w+": dose")}
    const v=SK.video(it.note,P.weeks);
    console.log(`  ${d.label} · ${it.name} → S1: ${SK.doseFor(it.dose,1).split("\n")[0]} | S${P.weeks}: ${SK.doseFor(it.dose,P.weeks).split("\n")[0]}${v?" | video sett. "+v.weeks.join(","):""}${SK.methodsIn(it.dose,P.methods).length?" | metodi: "+SK.methodsIn(it.dose,P.methods).join(","):""}`);
  }));
}
// NB e metodi
const PM=SK.parse(MM);
ok(PM.nb.length===6&&PM.nb[0].t==="Schemi:","NB Mattia");
ok(SK.methodsIn("(sett. 1-2) RT 40 rep",PM.methods).includes("RT"),"metodo RT");
ok(SK.methodsIn("(sett. 1-2) EMOM 6′ × 4 rep",PM.methods).includes("EMOM"),"metodo EMOM");
ok(!SK.methodsIn("Retroversione 3″, ritorno 3″",PM.methods).includes("RT"),"RT non deve comparire dentro le parole");
// righe feedback: andata e ritorno
for(const f of[{rpe:8,tec:"Pulita",pain:3,nota:"fatto 3×5 · bene"},{rpe:5,tec:"Così così"},{skip:true,why:"fastidio alla spalla"}]){
  const l=SK.line(f),b=SK.unline(l);ok(SK.line(b)===l,"andata/ritorno "+l)}
// avvisi: 3 settimane di fila
const A=SK.parse([["G1","ESERCIZIO","SCHEMA","NOTE","FEEDBACK"],["1","Pull up","3x5","","S1  │  RPE 10 (duro)\nS2  │  RPE 10 (duro) · tecnica pulita\nS3  │  RPE 10 (duro)\nS4  │  RPE 9"],["2","Dip","3x5","","S1  │  RPE 6 (medio)\nS2  │  RPE 5\nS3  │  RPE 7\nS4  │  RPE 4"],["3","Squat","3x5","","S1  │  RPE 6\nS2  │  RPE 5\nS3  │  RPE 4\nS4  │  SALTATO · ginocchio"]]);
const al=SK.alerts(A,6);console.log("\nAvvisi di prova:\n  "+al.map(a=>a.text).join("\n  "));
ok(al.some(a=>a.kind==="hard"&&a.ex==="Pull up"),"avviso RPE 10");
ok(!al.some(a=>a.ex==="Dip"),"Dip non deve avere avvisi (interrotto dal 7)");
ok(al.some(a=>a.kind==="easy"&&a.ex==="Squat"),"avviso facile Squat");
ok(al.some(a=>a.kind==="skip"&&a.ex==="Squat"),"avviso saltato");
console.log("\n"+(err?err+" ERRORI":"TUTTO OK"));process.exit(err?1:0);
