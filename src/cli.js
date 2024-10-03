const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

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

async function ClearDbLinks() {
    return await import('./services/db.js')
}

async function displayMenu() {
    const { chalk, figlet } = await loadChalkAndFiglet();

    console.log(chalk.blue.bold(figlet.textSync('CLI Menu', { horizontalLayout: 'full' })));
    console.log(chalk.green("\nChoose an option:"));
    console.log(chalk.cyan("1: ") + chalk.white("Start Scraping"));
    console.log(chalk.cyan("2: ") + chalk.white("Clear Generated Files"));
    console.log(chalk.cyan("3: ") + chalk.white("Clear Database"));
    console.log(chalk.cyan("4: ") + chalk.white("Exit"));
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
            const clearDbLinksModule = await ClearDbLinks();
            await clearDbLinksModule.clearDbLinksAndScripts();
            rl.close();
            break;
        case '4':
            console.log('Exiting...');
            rl.close();
            break;
        default:
            console.log('Invalid option. Please select 1, 2, 3 or 4.');
            await displayMenu();
    }
});

displayMenu().catch(err => {
    console.error('Error displaying the menu:', err);
});
