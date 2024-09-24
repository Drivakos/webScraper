const { scrapeWithPuppeteer } = require('./puppeteerService');
const { saveFile } = require('../utils/fileUtils');


function hasRelevantContent(html, contentType) {
    const relevantKeywords = {
        'blog articles': ['blog', 'article', 'post'],
        'product data': ['product', 'price', 'sale']
    };
    const keywords = relevantKeywords[contentType] || [];
    return keywords.some(keyword => html.toLowerCase().includes(keyword));
}

module.exports = {
    hasRelevantContent
};
