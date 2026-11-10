// Celle copiate dai fogli reali (Gianfree Fiore 2.0 e Mattia Minischetti), accorciate dove non servono
const S5="S1  │  \nS2  │  \nS3  │  \nS4  │  \nS5  │  ";
const S6=w=>["Sett. 1:"+(w||""),"Sett. 2:","Sett. 3:","Sett. 4:","Sett. 5:","Sett. 6:"].join("\n");
const GF=[
 ["","DA TELEFONO? RUOTALO IN ORIZZONTALE"],[],["","SIMONKEY"],["","SCHEDA DI ALLENAMENTO"],[],
 ["","CLIENTE","PROGRAMMAZIONE","DURATA","INIZIO"],["","Gianfree Fiore","2","6 settimane","09/11/2026"],[],
 ["","COME SI USA","","","SIGLE"],["","1 · Dai un'occhiata alla riga.","","","Rest = recupero tra serie o giri"],[],
 ["","GIORNO A","","SESSIONE FATTA · Sett. 1–6 →","FALSE","FALSE","FALSE","FALSE","FALSE","FALSE"],
 ["","ESERCIZIO","PROTOCOLLO","NOTE","FEEDBACK · una riga per settimana"],
 ["","Squat","(sett. 1) 1×6 + 3×4 +80kg\n(sett. 2) 1×6 + 3×4-5 +85kg\n(sett. 3-4) 1×6 + 3×4-5 +90kg\n(sett. 5-6) 1×6 + 3×4-5 +95kg\n\nRest 2′30″","Non avere fretta. Mandami il video della prima serie a 90kg nella settimana 3, così vediamo come gestisci il carico.",S6("ok")],
 ["","Pull mod MU","(5 x 1 rep @ bw, Rest 30″ tra le rep) x 2 giri\n(5 x 1 rep @ loop gialla, Rest 20″ tra le rep) x 1 giro\nRest 2′ tra giri","Timing della tirata.\n\nManda video dell'ultima rep @ bw e dell'ultima rep @ loop gialla",S6("sono un po' fiacco di mio")],
 ["","Pull up zavorrato","Ramping: 3 rep @ 20kg, 2 rep @ 25kg\n(2 rep, Rest 45″/1′, 2 rep) x 2 giri @ 30kg\nBack off set: \n(Sett. 1/2) 3 x 5 @ 15kg\n(Sett. 3/4) 3 x 5 @ 17,5kg\n(Sett. 5/6) 3 x 5 @ 20kg\nRest 1′45″/2′ tra i gradini","Settati bene.",S6("sentita molta fatica a 30kg")],
 ["","Hanging hollow hold + Tuck raise in hollow + Barchetta + Plank laterale","Circuito x 2 giri, Rest 15″ tra stazioni:\nHanging hollow hold 20″\nRest 1′ tra giri","Appeso in barchetta.",S6("ok")],
 [],
 ["","GIORNO B","","SESSIONE FATTA · Sett. 1–6 →","FALSE","FALSE","FALSE","FALSE","FALSE","FALSE"],
 ["","ESERCIZIO","PROTOCOLLO","NOTE","FEEDBACK · una riga per settimana"],
 ["","Muscle up","Emom: (Sett. 1/2) 6′ x 1 rep: 3′ @ loop arancione, 3′ @ loop gialla\n(Sett. 3/4) 8′ x 1 rep: 4′ @ loop arancione, 4′ @ loop gialla\n(Sett. 5/6) 10′ x 1 rep: 5′ @ loop arancione, 5′ @ loop gialla","Manda video dell'ultima rep @ loop arancione",S6()],
 ["","Dip zavorrato","Ramping: (Sett. 1/4) 3 rep @ 40kg, 2 rep @ 45kg, 1 rep @ 50kg\n(Sett. 5/6) 3 rep @ 40kg, 2 rep @ 45kg, 1 rep @ 52,5kg\nBack off set: (Sett. 1/2) 2 x 6/8 @ 20kg, deadstop 1″\n(Sett. 3/4) 3 x 6/8 @ 20kg, deadstop 1″\n(Sett. 5/6) 3 x 6/8 @ 22,5kg, deadstop 1″","Manda video dell'ultimo gradino",S6()],
 [],
 ["","GIORNO C","","SESSIONE FATTA · Sett. 1–6 →","FALSE"],
 ["","ESERCIZIO","PROTOCOLLO","NOTE","FEEDBACK · una riga per settimana"],
 ["","Pike push up su rialzo mani a terra","4/5 x 4/5 rep @ bw, salita 3″, discesa 3″\nRest 1′30″","Verifica la posizione.\n\nManda video dell'ultimo set nella 2ª e nella 4ª settimana",S6()],
 ["","Curl panca inclinata\nSS\nFrench press","1×8-10 + 2×10-12\nss\n1×8-10 + 2×10-12\n\nRest 1′30″ tra i giri","Il primo giro è più pesante.",S6()],
 [],["","SIMONKEY · SCHEDA MODELLO","","","3 GIORNATE · 6 SETTIMANE"]
];
const MM=[
 ["SERKISTRAINING   ·   PROGRAMMA DI ALLENAMENTO"],["Mattia Minischetti","","","5 settimane   ·   09/11/2026 - 13/12/2026"],[],
 ["NB","•  Schemi: non modificare da solo gli schemi della scheda. Se un lavoro ti sembra troppo facile o troppo difficile, comunicamelo.\n\n•  Feedback: è fondamentale, è quello che mi permette di costruire la scheda successiva.\n\n•  Video: mandami quelli che ti chiedo nelle note.\n\n•  Dubbi: su esecuzioni, metodiche o qualunque altra cosa, chiedimi senza problemi.\n\n•  Fastidi: se qualcosa non va a livello fisico, comunicamelo subito.\n\n•  Comunicazione: tienimi aggiornato anche su quello che succede fuori dall'allenamento (sonno, lavoro, sedute saltate): mi serve per gestire bene il percorso."],[],
 ["G1","ESERCIZIO","SCHEMA E REST","NOTE","FEEDBACK"],
 ["1","Attivazioni bacino PAM","Retroversione 3″, ritorno 3″\n\n(sett. 1-2) 3×6 rep + 8″ iso ultima rep\n(sett. 3-5) 4×6 rep + 8″ iso ultima rep\n\nRest 1′","Petto chiuso.",S5],
 ["2","Switch SAM","10' di lavoro","Lavora sul controllo e non sulla quantità",S5],
 ["3","Squat","(sett. 1) 3×6 60kg\n(sett. 2) 4×6 60kg\n(sett. 3) 4×5 65kg\n(sett. 4) 4×6 65kg\n(sett. 5) 4×4 70kg\n\nRest 2′30″","Non lasciarti cadere in discesa. Mandami il video ultima serie delle settimane 1-3-5",S5],
 ["7","Knee raise parallele\n+\nL-sit","3×10-15 rep + tenuta finale in L-sit a gambe tese a cedimento\n\nRest 1′30″","Dopo l'ultima rep.",S5],
 [],
 ["G2","ESERCIZIO","SCHEMA E REST","NOTE","FEEDBACK"],
 ["3","Stacco da terra","(sett. 1) 4×4 85kg\n(sett. 2) 4×4 90kg\n(sett. 3) 4×3 95kg\n(sett. 4) 4×4 95kg\n(sett. 5) 3×3 100kg\n\nRest 2/3′","Prima di tirare. Mandami il video ultima serie settimana 3-5.",S5],
 [],
 ["G3","ESERCIZIO","SCHEMA E REST","NOTE","FEEDBACK"],
 ["4","Trazioni","(sett. 1-2) EMOM 6′ × 4 rep\n(sett. 3-4) EMOM 8′ × 4 rep\n(sett. 5) EMOM 8′ × 5 rep","Gomiti chiusi.",S5],
 ["7","Knee raise parallele","(sett. 1-2) RT 40 rep\n(sett. 3-4) RT 50 rep\n(sett. 5) RT 60 rep\n\nRecupera 2' poi fai:\n1×max tenuta in L-sit a gambe tese","Puoi dividere le rep come preferisci.",S5],
 [],["METODI PRESENTI NELLA SCHEDA"],
 ["EMOM: imposta un timer che suona ogni minuto, all'interno del minuto dovrai eseguire il numero di ripetizioni indicato.\n\nAMRAP: esegui più giri possibili di un certo circuito nel tempo indicato\n\nRT: ti verrà indicato un certo numero di ripetizioni da fare, devi chiudere tutte le ripetizioni nel minor tempo possibile\n\nRAMPING: mantieni fisse le ripetizioni indicate e di serie in serie aumenta il carico\n\nJUMP SET: alterna gli esercizi indicati rispettando le pause previste.\n\nREST-PAUSE: dopo il primo blocco di ripetizioni fai le brevi pause indicate."]
];
module.exports={GF,MM};
