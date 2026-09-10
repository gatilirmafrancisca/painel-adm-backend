import mongoose, { type Connection } from "mongoose";

let rifaConnection: Connection | null = null;


export function getRifaConnection(): Connection {
    if (rifaConnection) return rifaConnection;

    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
        throw new Error("MONGODB_URI não definida.");
    }

    const dbName = process.env.MONGODB_RIFA_NAME;
    if (!dbName) {
        throw new Error("MONGODB_RIFA_NAME não definida.");
    }

    rifaConnection = mongoose.createConnection(MONGODB_URI, {
        dbName,
        autoIndex: false,
    });

    return rifaConnection;
}