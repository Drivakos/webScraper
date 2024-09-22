const puppeteer = require('puppeteer');

async function scrapeWithPuppeteer(url) {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        const htmlContent = await page.content();
        return htmlContent;
    } catch (error) {
        console.error(`Error scraping ${url}:`, error.message);
        return null;
    } finally {
        await page.close();
        await browser.close();
    }
}

module.exports = {
    scrapeWithPuppeteer
};
