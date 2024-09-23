const { scrapeWithPuppeteer } = require('./puppeteerService');
const { analyzeHtmlWithOpenAI } = require('./openaiService');
const { saveFile } = require('../utils/fileUtils');

async function scrapeAndAnalyze(url, contentType) {
    const htmlContent = await scrapeWithPuppeteer(url);

    if (!htmlContent) {
        console.error(`Failed to scrape ${url}`);
        return;
    }

    const puppeteerScript = await analyzeHtmlWithOpenAI(htmlContent, contentType);

    if (puppeteerScript) {
        const scriptPath = await saveFile('./scripts', `script_${Date.now()}.js`, puppeteerScript);
        console.log(`Script saved to ${scriptPath}`);
    } else {
        console.log(`No valid script generated for ${url}`);
    }
}

function hasRelevantContent(html, contentType) {
    const relevantKeywords = {
        'blog articles': ['blog', 'article', 'post'],
        'product data': ['product', 'price', 'sale']
    };
    const keywords = relevantKeywords[contentType] || [];
    return keywords.some(keyword => html.toLowerCase().includes(keyword));
}

module.exports = {
    scrapeAndAnalyze,
    hasRelevantContent
};
