const express = require("express");
const router = express.Router();
const db = require("../db.js");
const { check, validationResult, query } = require('express-validator');

router.use(express.json());

// FUNZIONI DI CONTROLLO
const controllo_anno = (req, res, next) => {
    const yearRegex = /^\d{4}$/;
    const formato_anno_valido = yearRegex.test(req.params.year);

    // Esempio di verifica dell'intervallo di anni accettabile
    const min_anno = 1900;
    const max_anno = 2100;
    const anno = parseInt(req.params.year, 10);
    const range_anno_valido = anno >= min_anno && anno <= max_anno;

    if (!formato_anno_valido || !range_anno_valido) {
        // Anno non valido
        return res.status(400).json({ msg: "Anno richiesto non valido!" });
    }

    next();
};

const controllo_mese = (req, res, next) => {
    const monthRegex = /^(0?[1-9]|1[0-2])$/; // Ammette mesi da 01 a 12
    const formato_mese_valido = monthRegex.test(req.params.month);

    if (!formato_mese_valido) {
        // Mese non valido
        return res.status(400).json({ msg: "Mese non valido!" });
    }

    next();
};

const controllo_id_spesa = (req, res, next) => {
    const idRegex = /^\d+$/;
    const formatoIdValido = idRegex.test(req.params.id);

    if (!formatoIdValido) {
        res.status(400).json({ msg: "ID non valido!" });
        return;
    }

    next();
};

const controllo_query = (req, res, next) => {
    query('q').notEmpty().trim().escape().withMessage('Il parametro "q" non è valido!');

    const errori = validationResult(req);
    if (!errori.isEmpty())
        return res.status(400).json({ errori: errori.array() });
    
    next();
};

// Creazione di un middleware per il controllo dei dati
const controllo_dati = [
    check('descrizione').optional().isString().withMessage('Il campo "descrizione" deve essere una stringa'),
    check('data').optional().isString().withMessage('Il campo "data" deve essere una stringa'),
    check('categoria').isString().withMessage('Il campo "categoria" deve essere una stringa'),
    check('costo_totale').isNumeric().withMessage('Il campo "costo_totale" deve essere un number'),
    check('partecipanti').optional().isArray().withMessage('Il campo "partecipanti" deve essere un array di oggetti').custom((value, { req }) => {
        // Verifica che se presente, l'array non sia vuoto e che ogni elemento sia un oggetto con i campi specifici
        if (req.body.partecipanti && req.body.partecipanti.length === 0) {
          throw new Error('Il campo "partecipanti" deve contenere almeno un partecipante');
        }
        // Verifica che ogni elemento dell'array sia un oggetto con campi specifici
        if (!value.every(partecipante => 
            typeof partecipante === 'object' && 
            Number.isInteger(partecipante.utente) && 
            typeof partecipante.quota === 'number'
          )) {
          throw new Error('Ogni partecipante deve essere un oggetto con i campi "utente" di tipo integer e "quota" di tipo number');
        }
        return true;
      }),
    check('utente_creatore').isObject().withMessage('Il campo "utente_creatore" deve essere un oggetto, con campi "utente" di tipo integer e "quota" di tipo number').custom((value) => {
      return Number.isInteger(value.utente) && typeof value.quota === 'number';
    }),
  ];


// ENDPOINT

//Cercare la spesa che matcha la stringa query
router.get("/search", controllo_query, async (req, res) => {
    try {
        const bilancio_familiare = await db.connectToDatabase();
        const query = req.query.p;

        //Restiuisco tutte le spese che hanno nella descrizione o categoria la query (maiuscole e minuscole non contano)
        const spese = await bilancio_familiare.collection("spese").find({
            $or: [
              { "descrizione": { $regex: new RegExp(query, "i") } }, 
              { "categoria": { $regex: new RegExp(query, "i") } }
            ]
          }).toArray();
        
        res.json(spese);
    } catch (error) {
        res.status(500).json({ msg: "Internal Server Error" });
    }
    
});

//Restituire informazioni che riguardano l'utente loggato
router.get('/whoami', async (req, res) => {
    try {
        // Recupero delle informazioni sull'utente
        const bilancio_familiare = await db.connectToDatabase();
        const utente = await bilancio_familiare.collection("utenti").findOne({"id": req.utenteId});

        const info_utente = {
            username: utente.username,
            nome: utente.nome,
            cognome: utente.cognome 
        };

        // Invia le informazioni sull'utente come risposta JSON
        res.json(info_utente);
    } catch (error) {
        // Gestione degli errori interni del server
        console.error(error);
        res.status(500).json({ msg: 'Errore interno del server' });
    }
});

// Spese dell’utente loggato
router.get("/", async (req, res) => {
    try {
        const bilancio_familiare = await db.connectToDatabase();
        
        const spese_utente = await bilancio_familiare.collection("spese").find({
            $or: [
                {"utente_creatore.utente": req.utenteId},
                {"partecipanti.utente": req.utenteId}
            ]
        }).toArray();

        for (let spesa of spese_utente) {
            // Recupera il creatore della spesa
            const creatore = await bilancio_familiare.collection("utenti").findOne({ id: spesa.utente_creatore.utente });
            spesa.nome_creatore = creatore.nome;
            spesa.cognome_creatore = creatore.cognome;

            // Recupera i dettagli dei partecipanti
            if(spesa.partecipanti.length > 0) {
                for (let partecipante of spesa.partecipanti) {
                    const partecipante_info = await bilancio_familiare.collection("utenti").findOne({ id: partecipante.utente });
                    
                    partecipante.nome = partecipante_info.nome;
                    partecipante.cognome = partecipante_info.cognome;
                    partecipante.username = partecipante_info.username;
                }; 
            }
        };

        res.json(spese_utente);
    } catch (error) {
        res.status(500).json({ msg: "Internal Server Error" });
    }
});

// Categorie presenti per le spese
router.get("/categorie", async (req, res) => {
    const categorie = [
        { nome: 'Acquisti', immagine: '../public/icone/acquisti.png' },
        { nome: 'Altro', immagine: '../public/icone/altro.png' },
        { nome: 'Bollette e tasse', immagine: '../public/icone/bollette e tasse.png' },
        { nome: 'Casa', immagine: '../public/icone/casa.png' },
        { nome: 'Famiglia', immagine: '../public/icone/famiglia.png' },
        { nome: 'Lavoro', immagine: '../public/icone/lavoro.png' },
        { nome: 'Mangiare e bere', immagine: '../public/icone/mangiare e bere.png' },
        { nome: 'Regali', immagine: '../public/icone/regali.png' },
        { nome: 'Rimborso', immagine: '../public/icone/rimborso.png' },
        { nome: 'Salute', immagine: '../public/icone/salute.png' },
        { nome: 'Sport e passatempo', immagine: '../public/icone/sport e passatempo.png' },
        { nome: 'Studio', immagine: '../public/icone/studio.png' },
        { nome: 'Svago', immagine: '../public/icone/svago.png' },
        { nome: 'Viaggi', immagine: '../public/icone/viaggi.png' },
        { nome: 'Trasporti', immagine: '../public/icone/trasporti.png' },
      ]

    res.json(categorie);  
});    

// Lista utenti
router.get("/utenti", async (req, res) => {
    try {
        const bilancio_familiare = await db.connectToDatabase();
        
        const utenti = await bilancio_familiare.collection("utenti").find({ id: { $ne: req.utenteId } }).toArray();

        res.json(utenti);
    } catch (error) {
        res.status(500).json({ msg: "Internal Server Error" });
    }
});

// Spese dell’utente loggato relative all’anno year
router.get("/:year", controllo_anno, async (req, res) => {
    try {
        const bilancio_familiare = await db.connectToDatabase();

        const spese_utente_anno = await bilancio_familiare.collection("spese").find({"utente_creatore.utente": req.utenteId, "data": {$regex: `^${req.params.year}`} }).toArray();
        
        res.json(spese_utente_anno);
    } catch (error) {
        res.status(500).json({ msg: "Errore interno del server" });
    }
});

// Spese dell’utente loggato relative al mese month dell’anno year
router.get("/:year/:month", controllo_anno, controllo_mese, async (req, res) => {
    try {
        const bilancio_familiare = await db.connectToDatabase();
        
        const spese_utente_anno_mese = await bilancio_familiare.collection("spese").find({
            "utente_creatore.utente": req.utenteId,
            "data": `${req.params.year}-${req.params.month}`
        }).toArray();

        res.json(spese_utente_anno_mese);
    } catch (error) {
        res.status(500).json({ msg: "Internal Server Error" });
    }
});

// Dettaglio della spesa id nel mese month dell’anno year
router.get("/:year/:month/:id", controllo_anno, controllo_mese, controllo_id_spesa, async (req, res) => {
    try {
        const { anno, mese, id } = req.params;
        const bilancio_familiare = await db.connectToDatabase();
        
        const spesa = await bilancio_familiare.collection("spese").findOne({
            "id": parseInt(id, 10),
            "data": `${anno}-${mese}`
        });

        if (spesa) 
            res.json(spesa);
         else 
            res.status(404).json({ msg: 'Spesa non trovata!' });
        
    } catch (error) {
        res.status(500).json({ msg: "Internal Server Error" });
    }
});    

// Aggiunta di una spesa nel mese month dell’anno year
router.post("/:year/:month", controllo_anno, controllo_mese, controllo_dati, async (req, res) => {
    try {
        const bilancio_familiare = await db.connectToDatabase();

        const { descrizione, categoria, costo_totale, partecipanti, quota_creatore } = req.body;
        
        const ultima_spesa = await bilancio_familiare.collection("spese").find().sort({ id: -1 }).limit(1).toArray();
        let id_nuova_spesa = ultima_spesa[0]?.id !== undefined ? ultima_spesa[0].id : -1;
        id_nuova_spesa++;

        const costo_totale_parsato = parseFloat(costo_totale);
        const quota_creatore_parsato = parseFloat(quota_creatore);
        const partecipantiCopia = partecipanti.map(partecipante => ({
            ...partecipante,
            quota: parseFloat(partecipante.quota)
        }));

        const somma_quote = partecipantiCopia.reduce((somma, partecipante) => somma + partecipante.quota, 0);
        const somma_quotaTotale = somma_quote + quota_creatore_parsato;
        
        if (somma_quotaTotale !== costo_totale_parsato) {
            console.log("La somma delle quote non corrisponde al costo totale");
            return res.status(400).json({ msg: 'La somma delle quote non corrisponde al costo totale!' });
        }

        const utenti_partecipanti = partecipantiCopia.map(p => p.utente);
        const utenti_partecipanti_unici = [...new Set(utenti_partecipanti)];

        if (utenti_partecipanti.length !== utenti_partecipanti_unici.length || utenti_partecipanti.includes(req.utenteId)) {
            console.log("Utenti duplicati rilevati nei partecipanti");
            return res.status(400).json({msg: "Per ogni spesa un utente può partecipare al più una volta!"});
        }

        const nuova_spesa = {
            id: id_nuova_spesa,
            data: `${req.params.year}-${req.params.month}`,
            descrizione: descrizione, 
            categoria: categoria,
            costo_totale: costo_totale_parsato, 
            partecipanti: partecipantiCopia,
            utente_creatore: {utente: req.utenteId, quota: quota_creatore_parsato}
        };

        const risultato = await bilancio_familiare.collection("spese").insertOne(nuova_spesa);
        
        if (risultato.insertedId) {
            console.log("Spesa inserita con successo");
            res.json({ msg: 'Spesa inserita con successo!'});
        } else {
            console.log("Errore durante l'inserimento della spesa");
            res.status(500).json({ msg: 'Errore durante l\'inserimento della spesa' });
        }
    } catch (error) {
        console.error("Errore interno del server", error);
        res.status(500).json({ msg: "Internal Server Error" });
    }
});

// Modifica della spesa id nel mese month dell’anno year
router.put("/:year/:month/:id", controllo_anno, controllo_mese, controllo_id_spesa, controllo_dati, async (req, res) => {
    try {
        const proprietà_modificabili = ["descrizione", "data", "categoria", "costo_totale", "partecipanti", "utente_creatore"];        
        const proprietà_da_aggiornare = {};
        const bilancio_familiare = await db.connectToDatabase();

        //Creazione oggetto contenente le proprietà da aggiornare presenti in req.body
        proprietà_modificabili.forEach(proprietà => {
            if (req.body[proprietà] !== undefined) 
                    proprietà_da_aggiornare[proprietà] = req.body[proprietà];
        });
        
        //Controllo errori di validazione
        const errori = validationResult(req);
        if (!errori.isEmpty()) 
          return res.status(400).json({ errori: errori.array() });
        
        
        //Controllo che la somma delle quote sia ancora uguale al costo totale nel caso in cui dei campi con delle quote o il costo_totale stesso siano cambiati
        const modifiche_rilevanti = ["utente_creatore", "partecipanti", "costo_totale"].some(proprietà => proprietà_da_aggiornare.hasOwnProperty(proprietà));

        if (modifiche_rilevanti) {
            //Se il costo_totale non è presente nella richiesta lo recupero 
            let costo_totale = parseFloat(req.body.costo_totale);

            if (costo_totale === undefined) {
                const spesaCorrente = await bilancio_familiare.collection("spese").findOne({ id: parseInt(req.params.id, 10), data: `${req.params.year}-${req.params.month}` });
                
                if (spesaCorrente) 
                    costo_totale = spesaCorrente.costo_totale;
                else 
                    return res.status(404).json({ msg: 'Spesa non trovata!' });
                
            }

            //Verifico la presenza dei partecipanti e dell'utente creatore e ne calcolo la somma delle quote 
            const partecipanti = req.body.partecipanti || [];
            const quote_partecipanti = partecipanti.reduce((somma, partecipante) => somma + parseFloat(partecipante.quota), 0);
            const somma_quotaTotale = quote_partecipanti + (req.body.utente_creatore.quota ? parseFloat(req.body.utente_creatore.quota) : 0);
            

            if (somma_quotaTotale !== costo_totale) 
                return res.status(400).json({ msg: 'La somma delle quote non corrisponde al costo totale!' });
        }

        //Aggiornamento della spesa
        const risultato = await bilancio_familiare.collection("spese").updateOne(
            { id: parseInt(req.params.id, 10), data: `${req.params.year}-${req.params.month}` },
            { $set: proprietà_da_aggiornare}
        );

        if (risultato.modifiedCount > 0) 
            res.json({ msg: "Spesa aggiornata con successo!" });
        else 
            res.status(404).json({ msg: "Spesa non trovata o nessuna modifica effettuata!" });
        
    } catch (error) {
        res.status(500).json({ msg: "Internal Server Error" });
    }
});

// Rimozione di una spesa specifica
router.delete("/:year/:month/:id", controllo_anno, controllo_mese, controllo_id_spesa, async (req, res) => {
    try {
        const bilancio_familiare = await db.connectToDatabase();

        const spesaDaEliminare = await bilancio_familiare.collection("spese").findOne({
            "id": parseInt(req.params.id, 10),
            "data": `${req.params.year}-${req.params.month}`
        });

        if (!spesaDaEliminare) {
            return res.status(404).json({ msg: "Spesa non trovata", eliminata: false });
        }

        const risultato = await bilancio_familiare.collection("spese").deleteOne({ id: parseInt(req.params.id, 10) });
        
        if (risultato.deletedCount > 0) 
            res.json({ msg: "Spesa eliminata con successo!", eliminata: true});
        else 
            res.status(404).json({ msg: "Spesa non trovata", eliminata: false});
        
    } catch (error) {
        res.status(500).json({ msg: "Internal Server Error" });
    }
});

module.exports = router;