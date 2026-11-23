# Spark Return for Claude

**Italiano** · [English](#english)

> Progetto non ufficiale, non affiliato né approvato da Anthropic.

Estensione gratuita per Chrome che riporta su **claude.ai** una stellina animata, come nella vecchia interfaccia.

## Cosa fa

- **Appena invii un messaggio** al posto dei puntini compare una stellina che pulsa mentre Claude ragiona.
- **Durante una ricerca web o l'uso di uno strumento** la stellina si apre in un anello di puntini che gira.
- **Mentre Claude scrive** la stellina si muove sotto il testo.
- **A risposta finita** resta una stellina ferma in fondo al messaggio:
  - passandoci sopra col mouse compare un breve messaggio, che cambia se continui a cliccarla;
  - cliccandola, la stellina si contrae e torna com'era.
- **Se nel sistema hai ridotto le animazioni** la stellina resta ferma.

La stellina e le sue animazioni sono quelle originali di claude.ai. Il sito le contiene ancora, in un file che carica quando gli serve, e l'estensione chiede alla pagina di caricare quello stesso file dallo stesso indirizzo da cui lo carica il sito. L'estensione non contiene file, immagini o codice di claude.ai o di Anthropic. Se il file non si trova, usa una stellina di riserva ridisegnata per questo progetto con la stessa forma dell'originale. A risposta finita lascia al suo posto la stellina ferma del sito, con il suo fumetto originale, le sue risposte ai clic e il suo sobbalzo. Se il sito non la mostra, ne disegna una sua, con messaggi scritti da zero.

## Installazione (manuale)

1. Scarica il file `.zip` dall'ultima **Release** di questo repository.
2. Estrai lo `.zip`: otterrai la cartella `spark-return-for-claude`.
3. In Chrome apri `chrome://extensions`.
4. Attiva **Modalità sviluppatore** (interruttore in alto a destra).
5. Clicca **Carica estensione non pacchettizzata** e scegli la cartella `spark-return-for-claude`.
6. Ricarica le schede di claude.ai già aperte.

Per gli aggiornamenti scarica il nuovo `.zip`, sostituisci la cartella e premi la freccia ↻ sull'estensione in `chrome://extensions`.

## Disattivarla

- Da `chrome://extensions` spegni l'interruttore dell'estensione.
- Oppure, solo per claude.ai, scrivi nella console del sito `localStorage.setItem("spark-return.off", "1")` e ricarica. Usa `localStorage.removeItem("spark-return.off")` per riaccenderla.

## Come funziona

- All'apertura della pagina spegne le impostazioni interne di claude.ai il cui nome inizia con `turnStatus`, nel momento in cui il sito le crea. Per farlo avvolge la funzione `Object.freeze` della pagina. Così il sito torna a mostrare in fondo alla risposta il vecchio spazio della stellina.
- Per sapere in che fase è la risposta legge alcune proprietà interne di React della pagina (per esempio quale attività è in corso).
- Cerca negli script che il sito ha già caricato il punto in cui carica le animazioni della stellina (il modulo `cds_spark_sprites`) e carica lo stesso file. Ne ricorda l'indirizzo per le visite successive.
- Nasconde i puntini e al loro posto mostra la stellina animata.

## Privacy

L'estensione funziona solo su `https://claude.ai/*`. Non raccoglie, salva o invia dati. Le uniche richieste di rete che fa vanno ai file del sito stesso (claude.ai e i suoi server di file `*.anthropic.com`), per trovare e caricare le animazioni della stellina. Nel `localStorage` di claude.ai ricorda solo l'indirizzo di quel file. Per scegliere l'animazione guarda solo in che fase è la risposta (ragionamento, strumento, scrittura) e se contiene già del testo.

## Limiti

claude.ai cambia spesso. Se il sito cambia struttura, l'estensione può smettere di funzionare finché non viene aggiornata. Per ora è pensata e provata solo per claude.ai in Chrome.

Claude è un marchio di Anthropic. Qui il nome serve solo a indicare il sito su cui funziona l'estensione.

## Licenza

Creato da **Gio**. Codice rilasciato con licenza MIT: vedi il file `LICENSE`.

---

## English

> Unofficial project, not affiliated with or endorsed by Anthropic.

A free Chrome extension that brings an animated spark back to **claude.ai**, like in the old interface.

### What it does

- **As soon as you send a message**, a spark replaces the dots and pulses while Claude thinks.
- **During a web search or another tool**, the spark opens into a turning ring of dots.
- **While Claude writes**, the spark moves below the text.
- **When the reply is done**, a still spark stays at the end of the message:
  - hovering shows a short message, which changes if you keep clicking it;
  - clicking makes the spark squish and pop back.
- **If your system asks for reduced motion**, the spark stays still.

The spark and its animations are claude.ai's originals. The site still ships them in a file it loads on demand, and the extension asks the page to load that same file from the same address the site uses. The extension itself contains no files, images or code from claude.ai or Anthropic. If the file cannot be found, it falls back to a spare spark redrawn for this project to match the original's shape. When the reply is done it leaves the site's own resting spark in place, with its original hover message, poke replies and wiggle. If the site does not show one, it draws its own, with messages written from scratch.

### Installation (manual)

1. Download the `.zip` file from this repository's latest **Release**.
2. Unzip it: you get the `spark-return-for-claude` folder.
3. In Chrome, open `chrome://extensions`.
4. Turn on **Developer mode** (top right).
5. Click **Load unpacked** and choose the `spark-return-for-claude` folder.
6. Reload any claude.ai tabs that are already open.

To update, download the new `.zip`, replace the folder, and click the ↻ arrow on the extension in `chrome://extensions`.

### Turning it off

- In `chrome://extensions`, switch the extension off.
- Or, for claude.ai only, run `localStorage.setItem("spark-return.off", "1")` in the site's console and reload. Run `localStorage.removeItem("spark-return.off")` to turn it back on.

### How it works

- When the page opens it switches off claude.ai's internal settings whose names start with `turnStatus`, as the site creates them. To do this it wraps the page's `Object.freeze` function. As a result, the site again shows the old spark slot at the end of a reply.
- To know which stage the reply is in, it reads a few of the page's internal React properties (for example which activity is running).
- It looks through the scripts the site has already loaded for the place where it loads its spark animations (the `cds_spark_sprites` module) and loads that same file. It remembers the address for later visits.
- It hides the dots and shows the animated spark in their place.

### Privacy

The extension only runs on `https://claude.ai/*`. It collects, stores or sends no data. Its only network requests go to the site's own files (claude.ai and its `*.anthropic.com` file servers), to find and load the spark animations. In claude.ai's `localStorage` it only remembers that file's address. To pick the animation it only looks at which stage the reply is in (thinking, using a tool, writing) and whether it already has text.

### Limits

claude.ai changes often. If the site changes its structure, the extension may stop working until it is updated. For now it is made and tested for claude.ai in Chrome only.

Claude is a trademark of Anthropic. The name is used here only to say which site the extension works on.

### License

Made by **Gio**. Released under the MIT License: see the `LICENSE` file.
