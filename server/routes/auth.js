const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../db.js");
const router = express.Router();
const bcrypt = require('bcryptjs');


// Registrazione di un nuovo utente
router.post("/signup", async (req, res) => {
    try {
        const {username, nome, cognome, password} = req.body;
        
        const bilancio_familiare = await db.connectToDatabase();
        const utente = await bilancio_familiare.collection("utenti").findOne({username});

        if(utente) {
            res.status(409).json( { msg: "Utente già esistente" } );
        } else {
            const ultimo_utente = await bilancio_familiare.collection("utenti").findOne({}, { sort: {id: -1} });
            
            let id = ultimo_utente?.id !== undefined ? ultimo_utente.id : -1;
            id++;

            //Cripto la password aggiungendo l'hash
            const salt = await bcrypt.genSalt(10); 
            const password_hash = await bcrypt.hash(password, salt);

            const nuovo_utente = {id, username, nome, cognome, password: password_hash};
            await bilancio_familiare.collection("utenti").insertOne(nuovo_utente);

            res.json( { msg: "Utente creato con successo" });
        }
    } catch (error) {
        console.log(error);
        res.status(500).json( {msg: "Internal Error"});
    }
});

// Login di un utente
router.post("/signin", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const bilancio_familiare = await db.connectToDatabase();
      const utente = await bilancio_familiare.collection("utenti").findOne({ username });
      
      if (utente) {
        // Confronto la password inserita 
        const controllo_password = await bcrypt.compare(password, utente.password);
        
        if (controllo_password) {
          const data = { id: utente.id };
          const token = jwt.sign(data, "Programmazione web 2024", { expiresIn: 86400 });
  
          res.cookie("token", token, { httpOnly: true });
          res.json({ msg: "Autenticazione avvenuta!" });
        } else {
          res.status(401).json({ msg: "Password errata!" });
        }
      } else {
        res.status(401).json({ msg: "Username errato!" });
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ msg: "Internal error" });
    }
  });

module.exports = router;