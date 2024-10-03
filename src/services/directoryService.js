const { clearDirectory } = require('../utils/directoryUtils');
const path = require('path');

async function clearAllData() {
    const directories = [
        path.join(__dirname, '..', 'generated', 'extractedData'),
        path.join(__dirname, '..', 'generated', 'scripts'),
        path.join(__dirname, '..', 'generated', 'html')
    ];

    await Promise.all(directories.map(async dir => {
        console.log(`Clearing directory: ${dir}`);
        await clearDirectory(dir);
    }));

    console.log('All specified directories cleared.');
}

module.exports = {
    clearAllData
};