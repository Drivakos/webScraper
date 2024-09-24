const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { limitHtmlSize } = require('../utils/fileUtils')
const util = require("util");
const {exec} = require("child_process");
const execPromise = util.promisify(exec);
const fs = require('fs').promises;
const path = require('path');

async function launchBrowser() {
    return await puppeteer.launch({headless: 'new'});
}

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
        return null;
    } finally {
        await page.close();
    }
}

async function runSavedScript(scriptPath) {
    try {
        console.log(scriptPath)
        const { stdout, stderr } = await execPromise(`node "${scriptPath}"`);
        console.log('Script stdout:', stdout);
        console.error('Script stderr:', stderr);

        const extractedDataPath = path.join(__dirname, '..', 'generated', 'extractedData', 'blog.json');
        console.log(extractedDataPath)
        let attempts = 0;
        const maxAttempts = 10;
        const retryDelay = 1000;

        while (attempts < maxAttempts) {
            try {
                await fs.access(extractedDataPath);
                break;
            } catch (err) {
                attempts++;
                console.log(`JSON file not found. Retrying in ${retryDelay / 1000} seconds... (${attempts}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }

        if (attempts === maxAttempts) {
            console.error(`JSON file not found after ${maxAttempts} attempts.`);
            return null;
        }

        const jsonData = await fs.readFile(extractedDataPath, 'utf-8');
        return JSON.parse(jsonData);
    } catch (error) {
        console.error('Error running saved Puppeteer script:', error.message);
        return null;
    }
}

module.exports = { scrapeWithPuppeteer, runSavedScript, launchBrowser };
