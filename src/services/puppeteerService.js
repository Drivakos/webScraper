const puppeteer = require('puppeteer');

async function scrapeWithPuppeteer(browser, url) {
    const page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        const fullHtml = await page.content();
        const $ = cheerio.load(fullHtml);
        $('script, meta, link, noscript, style').remove();
        const mainContent = $('main').html() || '';

        return { html: $.html(), mainContent: limitHtmlSize(mainContent, 3000) };
    } catch (error) {
        console.error(`Error scraping ${url}:`, error.message);
        return { html: '', mainContent: '' };
    } finally {
        await page.close();
    }
}

module.exports = {
    scrapeWithPuppeteer
};
