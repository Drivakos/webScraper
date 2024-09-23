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

async function saveFullHtml(url, cleanedHtml) {
    const htmlDir = path.join(__dirname, '..', 'html'); // Adjusted path if refactored
    await ensureDirectoryExists(htmlDir);
    const filename = `body.html`;
    const filePath = path.join(htmlDir, filename);
    await fs.writeFile(filePath, cleanedHtml, 'utf-8');
    return filePath;
}

// Function to save data as JSON
async function saveAsJson(data, url, contentType) {
    const dataDir = path.join(__dirname, 'extractedData');
    await ensureDirectoryExists(dataDir);

    try {
        const { hostname } = new URL(url);
        const sanitizedContentType = contentType.replace(/\s+/g, '_');
        const filename = `${hostname}_${sanitizedContentType}_${Date.now()}.json`;
        const filePath = path.join(dataDir, filename);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`Data saved to ${filePath}`);
    } catch (error) {
        console.error(`Error saving JSON to ${filePath}:`, error.message);
    }
}

async function saveScriptToFile(scriptContent, filename) {
    const scriptsDir = path.join(__dirname, 'scripts');
    await ensureDirectoryExists(scriptsDir);

    const filePath = path.join(scriptsDir, filename);
    const cleanedScript = scriptContent
        .replace(/```javascript/g, '')
        .replace(/```/g, '')
        .replace(/This Puppeteer script[\s\S]*$/, '');

    await fs.writeFile(filePath, cleanedScript.trim(), 'utf8');
    console.log(`Script saved to: ${filePath}`);

    return filePath; // Return the script path
}

module.exports = {
    ensureDirectoryExists,
    saveFile,
    saveFullHtml,
    saveAsJson,
    saveScriptToFile
};
