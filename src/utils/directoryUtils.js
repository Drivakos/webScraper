const fs = require('fs').promises;
const path = require('path');

async function ensureDirectoryExists(directory) {
    try {
        await fs.mkdir(directory, { recursive: true });
    } catch (error) {
        console.error(`Error creating directory ${directory}:`, error.message);
    }
}

async function clearDirectory(directory) {
    try {
        const files = await fs.readdir(directory);
        if (files.length === 0) {
            console.log(`Directory is already empty: ${directory}`);
            return;
        }

        for (const file of files) {
            const filePath = path.join(directory, file);
            const fileStat = await fs.stat(filePath);

            if (fileStat.isDirectory()) {
                await clearDirectory(filePath);
            } else {
                console.log(`Deleting file: ${filePath}`);
                await fs.unlink(filePath);
            }
        }
        console.log(`Clearing directory contents: ${directory}`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`Directory not found: ${directory}`);
        } else {
            console.error(`Error clearing directory ${directory}:`, error.message);
        }
    }
}

module.exports = { ensureDirectoryExists, clearDirectory };
