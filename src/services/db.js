const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
let db;
let client;

async function connectDB() {
    if (!client || !client.topology && !client.topology.isConnected()) {
        client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
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

async function closeDB() {
    if (client &&  client.topology && client.topology.isConnected()) {
        try {
            await client.close();
            console.log('MongoDB connection closed.');
        } catch (err) {
            console.error('Failed to close MongoDB connection', err);
            throw err;
        }
    }
}

async function clearDbLinksAndScripts() {
    const db = await connectDB();
    try {
        const linkResult = await db.collection('links').deleteMany({});
        console.log(`Cleared ${linkResult.deletedCount} links from the database.`);

        const scriptResult = await db.collection('scripts').deleteMany({});
        console.log(`Cleared ${scriptResult.deletedCount} scripts from the database.`);
    } catch (err) {
        console.error('Failed to clear links or scripts from the database', err);
        throw err;
    } finally {
        await closeDB();
    }
}

process.on('SIGINT', async () => {
    if (client) {
        await client.close();
        console.log('MongoDB connection closed.');
    }
    process.exit(0);
});

module.exports = { connectDB, closeDB, clearDbLinksAndScripts };
