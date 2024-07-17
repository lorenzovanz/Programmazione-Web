const { MongoClient } = require("mongodb");

const MONGODB_URI = "mongodb://mongohost";
const DB_NAME = "bilancio_familiare";
let copia_db;

module.exports = {
    connectToDatabase: async () => {
        //controllo se essite già una connessione con il db
        if(copia_db) {
            console.log("Trovata connessione esistente!");
            return copia_db;
        }

        //non è stata trovata una connessione con il db, quindi la creo
        try {
            const client = await MongoClient.connect(MONGODB_URI);
            const db = client.db(DB_NAME);

            copia_db = db;

            return db;
        } catch (error) {
            console.log("Errore di connessione al database!");
            throw error;
        }
    }
};