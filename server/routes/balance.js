const express = require("express");
const db = require("../db.js");
const router = express.Router();

//FUNZIONI
const controllo_id = (req, res, next) => {
    const idRegex = /^\d+$/;
    const id = req.params.id;
    const formatoIdValido = idRegex.test(id);

    if (!formatoIdValido || isNaN(parseInt(id, 10)) || parseInt(id, 10) <= 0) {
        return res.status(400).json({ error: 'Id dell\'utente specificato non valido!' });
    }

    next();
}

function calcolaResoconto(bilancio, somma_quote_utente) {
    const resoconto = {"bilancio": bilancio.toFixed(2)};

    if (bilancio > somma_quote_utente) 
        resoconto['debito'] = parseFloat((bilancio - somma_quote_utente).toFixed(2));        
    else if (bilancio < somma_quote_utente)
        resoconto['credito'] = parseFloat((somma_quote_utente - bilancio).toFixed(2));
    
    return resoconto;
}


//ENDPOINT

// Visualizzazione riassunto dare/avere dell'utente loggato
router.get('/', async (req, res) => {
    try {
        //Recupero tutte le spese in cui l'utente è coinvolto come creatore o partecipante
        const bilancio_familiare = await db.connectToDatabase();
        const utenteId = req.utenteId; 
        
        const spese = await bilancio_familiare.collection("spese").find({
            $or: [{ "utente_creatore.utente": utenteId },
                  { "partecipanti.utente": utenteId } 
                ],
                $and: [
                    {'categoria': {$ne: 'Rimborso'}}
                ]}).toArray();

        //Il debito corrisponderà ai soldi che l'utente deve agli altri mentre il credito i soldi che si aspetta dagli altri
        //Il bilancio corrisponderà a quanti soldi avrà speso l'utente
        let somma_quote_utente = 0, bilancio = 0;
        
        spese.forEach(spesa => {
            //Calcolo la quota attesa che ogni partecipante dovrebbe mettere 
            const quota_attesa = (spesa.costo_totale / (spesa.partecipanti.length+1)).toFixed(2);
            let quota_utente = 0;

            if(spesa.utente_creatore.utente === utenteId) {
                quota_utente = spesa.utente_creatore.quota;
                      
            } else {
                const utente_partecipante = spesa.partecipanti.find(partecipante => partecipante.utente === utenteId);
                quota_utente = utente_partecipante.quota;
            }    
            console.log(somma_quote_utente);
            console.log(bilancio);
            somma_quote_utente += quota_utente;
            bilancio += parseFloat(quota_attesa);

        });
        
        res.json(calcolaResoconto(bilancio, somma_quote_utente));
    } catch (error) {
        res.status(500).json({ message: "Errore durante il recupero del bilancio"});
    }
});

// Visualizzazione del bilancio tra l'utente loggato e l'utente con id
router.get('/:id', controllo_id, async (req, res) => {
    try {
        //Recupero tutte le spese in cui l'utente è coinvolto come creatore o partecipante
        const bilancio_familiare = await db.connectToDatabase();
        const utenteId = req.utenteId;
        const altroUtenteId = parseInt(req.params.id, 10);

        const spese = await bilancio_familiare.collection("spese").find({
            $or: [
                { "utente_creatore.utente": utenteId, "partecipanti.utente": altroUtenteId },
                { "utente_creatore.utente": altroUtenteId, "partecipanti.utente": utenteId },
                { 
                    $and: [
                        { "partecipanti": { $elemMatch: { utente: utenteId } } },
                        { "partecipanti": { $elemMatch: { utente: altroUtenteId } } }
                    ]
                }
            ],
            $and: [
                {'categoria': {$ne: 'Rimborso'}}
            ]}).toArray();
        
        let dareAvere = 0;

        spese.forEach(spesa => {
            //Calcolo la quota attesa che ogni utente dovrebbe mettere per spendere in egual modo
            const quota_attesa = parseFloat((spesa.costo_totale / (spesa.partecipanti.length+1)).toFixed(2));

            //Ricavo la quota dell'utente
            let quota_utente = 0, quota_utente_cercato = 0, crediti_totali = 0;

            if(spesa.utente_creatore.utente === utenteId) {
                quota_utente = spesa.utente_creatore.quota;

                const utente_cercato = spesa.partecipanti.find(partecipante => partecipante.utente === parseInt(req.params.id));    
                quota_utente_cercato = utente_cercato.quota;

                spesa.partecipanti.forEach(p => {
                    if(p.quota > quota_attesa && p.utente !== parseInt(req.params.id))
                    crediti_totali += p.quota-quota_attesa;
                });
            }    
            else {
                quota_utente_cercato = spesa.utente_creatore.quota;
                const utente = spesa.partecipanti.find(partecipante => partecipante.utente === utenteId);
                quota_utente = utente.quota;

                spesa.partecipanti.forEach(p => {
                    if(p.quota > quota_attesa && p.utente !== parseInt(utenteId))
                    crediti_totali += p.quota-quota_attesa;
                });
            } 

            if( (quota_utente > quota_attesa && quota_utente_cercato < quota_attesa) || (quota_utente < quota_attesa && quota_utente_cercato > quota_attesa) )
                if(quota_utente > quota_utente_cercato) {
                    const credito_utente_creatore = quota_utente-quota_attesa;
                    crediti_totali += credito_utente_creatore;
                    dareAvere += (credito_utente_creatore/crediti_totali) * (quota_attesa-quota_utente_cercato);
                }
                else {
                    const credito_utente_cercato = quota_utente_cercato-quota_attesa;
                    crediti_totali += credito_utente_cercato;
                    dareAvere -= (credito_utente_cercato/crediti_totali) * (quota_attesa-quota_utente);
                }    
        });

        const resoconto = {};
        
        //resoconto.speseConUtente = spese;

        if(dareAvere > 0)
            resoconto.debito = parseFloat(dareAvere.toFixed(2));
        else 
            resoconto.credito = parseFloat(dareAvere.toFixed(2))*-1;

        res.json(resoconto);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;