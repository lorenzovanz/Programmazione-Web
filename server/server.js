const express = require("express");

const cookieParser = require("cookie-parser");
const server = express();
const auth = require("./routes/auth.js");
const route = require("./routes/route.js");
const path = require('path');


server.use(express.static(path.join(__dirname, '/public')));
server.use(express.json());
server.use(cookieParser());

server.use("/api/auth", auth);
server.use("/api", route);

server.listen(3000, () => {
    console.log("Avvio del web server!");
});