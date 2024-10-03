const natural = require('natural');
const { connectDB } = require('./db');
const puppeteerService = require('./puppeteerService');

function preprocess(text) {
    const tokenizer = new natural.WordTokenizer();
    const stemmer = natural.PorterStemmer;
    return tokenizer.tokenize(text.toLowerCase())
        .map(word => stemmer.stem(word));
}

function hasRelevantContent(html, contentType) {
    const processedHTML = preprocess(html);
    const processedContentType = preprocess(contentType).flat();
    return processedContentType.some(keyword => processedHTML.includes(keyword));
}

async function scrapeLink(url) {
    const browser = await puppeteerService.launchBrowser();
    try {
        const scrapeResult = await puppeteerService.scrapeWithPuppeteer(browser, url);
        return scrapeResult;
    } finally {
        await browser.close();
    }
}

module.exports = {
    hasRelevantContent,
    scrapeLink
};
