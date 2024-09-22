const fs = require('fs').promises;
const path = require('path');

async function ensureDirectoryExists(directory) {
    try {
        await fs.mkdir(directory, { recursive: true });
    } catch (error) {
        console.error(`Error creating directory ${directory}:`, error.message);
    }
}

async function saveFile(filePath, content) {
    try {
        await fs.writeFile(filePath, content, 'utf-8');
        console.log(`File saved at: ${filePath}`);
    } catch (error) {
        console.error(`Error saving file at ${filePath}:`, error.message);
    }
}

module.exports = {
    ensureDirectoryExists,
    saveFile
};
