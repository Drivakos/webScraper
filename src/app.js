const { scrapeWithPuppeteer } = require('./services/puppeteerService');
const { analyzeWithOpenAI } = require('./services/openaiService');
const { saveFile } = require('./utils/fileUtils');
const config = require('./config');

async function processUrl(url, contentType) {
    console.log(`Processing URL: ${url}`);
    const htmlContent = await scrapeWithPuppeteer(url);
    if (!htmlContent) return;
    const puppeteerScript = await analyzeWithOpenAI(htmlContent, contentType);
    if (puppeteerScript) {
        const scriptPath = `./scripts/${Date.now()}_script.js`;
        await saveFile(scriptPath, puppeteerScript);
        console.log(`Puppeteer script saved at ${scriptPath}`);
    }
}

async function main() {
    const urls = config.urlsToProcess;
    for (const { url, content } of urls) {
        await processUrl(url, content);
    }
}

module.exports = {
    main
};
