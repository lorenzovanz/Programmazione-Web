const express = require("express");
const db = require("../db.js");
const { query , validationResult} = require('express-validator');
const router = express.Router();

const controllo_query = (req, res, next) => {
    query('q').notEmpty().trim().escape().withMessage('Il parametro "q" non è valido!');

    const errori = validationResult(req);
    if (!errori.isEmpty())
        return res.status(400).json({ errori: errori.array() });
    
    next();
};

router.get('/search', controllo_query, async (req, res) => {
    try {
        const query = req.query.q; 
        const bilancio_familiare = await db.connectToDatabase();
        
        // Effettua la ricerca degli utenti nel database in base alla query
        const utenti_trovati = await bilancio_familiare.collection("utenti").find({
            $or: [
                { username: { $regex: new RegExp(query, 'i') } }, 
                { nome: { $regex: new RegExp(query, 'i') } }, 
                { cognome: { $regex: new RegExp(query, 'i') } } 
            ]
        }).project({ username: 1, nome: 1, cognome: 1 }).toArray(); // Seleziona solo username, nome e cognome

        res.json(utenti_trovati); 
    } catch (error) {
        console.error('Errore nella ricerca degli utenti:', error);
        
        res.status(500).json({ msg: 'Errore interno del server' });
    }
});


module.exports = router;