const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const balance = require("./balance.js");
const budget = require("./budget.js");
const users = require("./users.js");


const verificaToken = (req, res, next) => {
    const token = req.cookies["token"];

    if(!token) {
        res.status(403).json({"msg": "Autenticazione fallita!"});
        return;
    };

    try {
        const decodifica = jwt.verify(token, "Programmazione web 2024");
        req.utenteId = decodifica.id;

        next();
    } catch (error) {
        res.status(401).json({"msg": "Non autorizzizzato"});
    }
};

//Chiamate a balance
router.use("/balance", verificaToken, balance);

//Chiamate a budget 
router.use("/budget", verificaToken, budget);

//Chiamata a users
router.use("/users", verificaToken, users);


module.exports = router;