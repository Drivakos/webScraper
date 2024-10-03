const fs = require('fs');
const path = require('path');
const { connectDB, closeDB } = require('./db');

async function runMigrations(direction = 'up') {
    const db = await connectDB();
    try {
        const migrationsDir = path.join(__dirname, '../migrations');
        const migrationFiles = fs.readdirSync(migrationsDir).sort();

        for (const file of migrationFiles) {
            const migration = require(path.join(migrationsDir, file));

            if (typeof migration[direction] === 'function') {
                console.log(`Running migration ${file} in ${direction} direction.`);
                await migration[direction](db);
            }
        }
    } catch (error) {
        console.error(`Failed to run migrations: ${error.message}`);
    } finally {
        await closeDB();
    }
}

module.exports = {
    runMigrations
};