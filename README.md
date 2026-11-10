# Serkis Coach — installazione

L'app è una pagina web installabile (icona sul telefono e sul PC) che legge i dati da un piccolo backend nel tuo account Google. Tre parti, circa 30 minuti, tutto gratis.

## 1. Notion: crea l'integrazione (5 minuti)

Nelle versioni recenti Notion le chiama **connessioni** (prima "integrazioni"). Serve essere proprietario del workspace.

1. Apri nel browser **app.notion.com/developers/connections** e clicca **Create a new connection**. Dall'app: **Impostazioni** → **Connessioni** → in fondo **Sviluppa o gestisci connessioni**. Sui workspace più vecchi l'indirizzo è **notion.so/profile/integrations**.
2. Nome `Serkis Coach`, il tuo workspace, tipo **Interna** → Salva.
3. In **Capacità** lascia attivi: leggere, aggiornare e inserire contenuti.
4. Nella scheda **Configurazione** copia il token: si chiama "Internal Integration Secret" o "Installation access token" e inizia con `ntn_`.
5. Dai accesso ai due database. Nella scheda **Content access** della connessione, oppure in Notion: apri il database **Coaching** → `•••` in alto a destra → **Connessioni** → `Serkis Coach`. Ripeti per **Valutazione funzionale**.

## 2. Google: il backend (10 minuti)

1. Vai su **script.google.com** → **Nuovo progetto** e chiamalo `Serkis Coach — backend`.
2. Cancella tutto in `Codice.gs` e incolla il contenuto di `backend/Code.gs`.
3. Nella riga `NOTION_TOKEN` incolla il secret di Notion tra le virgolette. Salva.
4. In alto scegli la funzione **setup** → **Esegui** → Rivedi autorizzazioni → il tuo account → **Avanzate** → **Vai a Serkis Coach** → **Consenti**. Google avvisa perché lo script non è verificato: è il tuo, gira solo sul tuo account.
5. Nel registro copia la **CHIAVE APP** e controlla che la riga Notion dica **OK**.
6. **Distribuisci** → **Nuova distribuzione** → ingranaggio → **App web**. Esegui come: **Me**. Chi ha accesso: **Chiunque** → Distribuisci. Copia l'URL che finisce con `/exec`.

Senza la chiave il backend risponde solo "Chiave non valida": l'URL da solo non dà accesso ai dati.

## 3. GitHub Pages: l'indirizzo dell'app (10 minuti)

1. Crea un account su **github.com** se non ce l'hai.
2. **New repository** → nome `serkis-app` → **Public** → Create.
3. Clicca **uploading an existing file** e trascina tutto il contenuto della cartella estratta (cartelle `docs`, `src`, `tools`, `backend` e questo README) → **Commit changes**.
4. **Settings** → **Pages** → Branch **main**, cartella **/docs** → Save.
5. Dopo un paio di minuti l'app è su `https://TUONOME.github.io/serkis-app/`.

Il repository contiene solo il codice: nessun dato degli atleti, nessun token. Non caricare `Code.gs` dopo averci incollato il token di Notion.

## 4. Primo avvio e icona

- **PC**: apri l'indirizzo in Chrome o Edge, incolla l'URL `/exec` e la chiave → **Collega**. Poi clicca **Installa** nella barra dell'indirizzo.
- Nell'app: **Impostazioni** → **Copia codice di collegamento** e mandalo a te stesso.
- **iPhone**: apri l'indirizzo in Safari → **Condividi** → **Aggiungi alla schermata Home**. Apri l'icona e incolla il codice.
- **Android**: Chrome → `⋮` → **Installa app**. Apri l'icona e incolla il codice.

## Aggiornamenti

- **App**: carica i nuovi file in `docs/` su GitHub. L'app si aggiorna da sola al successivo avvio.
- **Backend**: incolla il nuovo `Code.gs` (rimetti il token), poi **Distribuisci** → **Gestisci distribuzioni** → matita → **Nuova versione** → Distribuisci. L'URL resta lo stesso.

## Versione 2.0 · pagina cliente e nuovo stile

**Indirizzi**
- App coach, versione di prova: `https://serkistraining.github.io/serkis-app/beta/`
- Pagina cliente: `https://serkistraining.github.io/serkis-app/c/#t=CODICE` (il link si crea dall'app: atleta → **Link cliente**)

**Aggiornare il backend (una volta)**
1. script.google.com → progetto `Serkis Coach — backend` → incolla il nuovo `backend/Code.gs` e rimetti il token Notion nella riga `NOTION_TOKEN`. Salva.
2. In alto scegli la funzione **provaPaginaCliente** → **Esegui** → autorizza. Google chiede due permessi nuovi: scrivere nelle schede per conto dell'atleta e mandarti l'email quando chiude una giornata.
3. **Distribuisci** → **Gestisci distribuzioni** → matita → **Nuova versione** → Distribuisci. L'URL resta lo stesso.

**Come funziona**
- Ogni atleta ha un codice personale (foglio `Clienti` nel file note). Il link resta uguale per tutte le schede: la pagina mostra sempre la scheda attuale collegata in Notion.
- Il feedback scrive solo la riga della settimana (`Sett. 2:` oppure `S2  │`) nella cella FEEDBACK dell'esercizio. Ogni invio finisce anche nel foglio `Feedback` del file note (data, giornata, RPE…).
- Il backend scrive con il tuo account: le schede di altri coach servono condivise con te come **Editor**.
- Template letti: "Programmazione" (GIORNO A/B/C) e "Serkistraining" (G1/G2/G3). Prova del lettore: `node tools/test_scheda.js`.
- Per pubblicare la 2.0 come app ufficiale: `python3 tools/icons2.py docs && python3 tools/build.py`.

## Dove stanno i dati

| Cosa | Dove |
|---|---|
| Atleti, date, stato | Notion · Coaching e Valutazione funzionale |
| Schede, test, valutazioni | Google Sheets su Drive |
| Note, feedback WhatsApp, segnali | Foglio `SERKIS APP — Note` su Drive |

Per ricostruire `docs/` dai sorgenti: `python3 tools/build.py`.
