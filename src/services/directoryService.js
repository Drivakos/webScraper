const { clearDirectory } = require('../utils/directoryUtils');
const path = require('path');

async function clearAllData() {
    const directories = [
        path.join(__dirname, '..', '..', 'extractedData'),
        path.join(__dirname, '..', '..', 'scripts'),
        path.join(__dirname, '..', '..', 'html')
    ];

    for (const dir of directories) {
        console.log(`Clearing directory: ${dir}`);
        await clearDirectory(dir);
    }

    console.log('All specified directories cleared.');
}

module.exports = {
    clearAllData
};
