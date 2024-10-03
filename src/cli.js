const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

async function loadChalkAndFiglet() {
    const chalk = (await import('chalk')).default;
    const figlet = (await import('figlet')).default;
    return { chalk, figlet };
}

async function loadApp() {
    return await import('./app.js');
}

async function loadClearAllDataService() {
    return await import('./services/directoryService.js');
}

async function dbModule() {
    return await import('./services/db.js')
}

const defaultMigrationPath = path.join(__dirname, './migrations/default_migration.js');

async function hasMigrationBeenApplied(db, migrationName) {
    const migrationStatus = await db.collection('migration_status').findOne({ name: migrationName });
    return !!migrationStatus;
}

async function markMigrationAsApplied(db, migrationName) {
    await db.collection('migration_status').insertOne({ name: migrationName, applied_at: new Date() });
    console.log(`Marked migration "${migrationName}" as applied.`);
}

async function applyDefaultMigration() {
    const { connectDB, closeDB } = await dbModule();
    const db = await connectDB();
    const migrationName = 'default_migration';

    const isApplied = await hasMigrationBeenApplied(db, migrationName);

    if (!isApplied) {
        console.log(`Applying default migration...`);

        const defaultMigration = require(defaultMigrationPath);
        await defaultMigration.up(db);

        await markMigrationAsApplied(db, migrationName);
    } else {
        console.log('Default migration has already been applied. Skipping...');
    }

    await closeDB();
}


async function displayMenu() {
    const { chalk, figlet } = await loadChalkAndFiglet();

    console.log(chalk.blue.bold(figlet.textSync('CLI Menu', { horizontalLayout: 'full' })));
    console.log(chalk.green("\nChoose an option:"));
    console.log(chalk.cyan("1: ") + chalk.white("Start Scraping"));
    console.log(chalk.cyan("2: ") + chalk.white("Clear Generated Files"));
    console.log(chalk.cyan("3: ") + chalk.white("Clear DB Links and Scripts"));
    console.log(chalk.cyan("4: ") + chalk.white("Run or Create MongoDB Migration"));
    console.log(chalk.cyan("5: ") + chalk.white("Exit"));
    console.log(chalk.gray("\nType the number of your choice and press Enter."));
}

rl.on('line', async (input) => {
    switch (input.trim()) {
        case '1':
            console.log('Starting the scraping process...');
            const appModule = await loadApp();
            await appModule.main();
            rl.close();
            break;
        case '2':
            console.log('Clearing all generated files...');
            const clearDataModule = await loadClearAllDataService();
            await clearDataModule.clearAllData();
            rl.close();
            break;
        case '3':
            console.log('Clearing database links and scripts...');
            const clearDbLinksAndScriptsModule = await dbModule();
            await clearDbLinksAndScriptsModule.clearDbLinksAndScripts();
            rl.close();
            break;
        case '4':
            console.log('Running default migration...');
            await applyDefaultMigration();
            rl.close();
            break;

        case '5':
            console.log('Exiting...');
            rl.close();
            break;
        default:
            console.log('Invalid option. Please select 1, 2, 3, 4, or 5.');
            await displayMenu();
    }
});

displayMenu().catch(err => {
    console.error('Error displaying the menu:', err);
});
