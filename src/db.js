const { MongoClient } = require('mongodb');

// Replace with your MongoDB connection string (for MongoDB Atlas, use the string provided from the cluster setup)
const uri = "mongodb://localhost:27017";  // For local MongoDB
// const uri = "<Your MongoDB Atlas Connection String>";  // For MongoDB Atlas

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

let db;

async function connectDB() {
    if (!db) {
        try {
            await client.connect();
            db = client.db('webScraper');
            console.log('Connected to MongoDB');
        } catch (err) {
            console.error('Failed to connect to MongoDB', err);
            throw err;
        }
    }
    return db;
}

module.exports = { connectDB };