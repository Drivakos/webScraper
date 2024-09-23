const path = require('path');
const { scrapeWithPuppeteer } = require('./services/puppeteerService');
const { analyzeWithOpenAI } = require('./services/openaiService');
const { saveFile, saveAsJson, saveFullHtml, saveScriptToFile } = require('./utils/fileUtils');
const config = require('./config');
const cliProgress = require("cli-progress");
const puppeteer = require("puppeteer");
const { scrapeAndAnalyze, hasRelevantContent} = require('./services/scrapperService')
require('dotenv').config();

async function processUrls(urls) {
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    const totalSteps = urls.length * 5; // Assume 5 steps per URL (adjust as needed)
    progressBar.start(totalSteps, 0);

    const browser = await puppeteer.launch({ headless: "new" });

    for (const { url, content } of urls) {
        console.log(`\nProcessing URL: ${url} for content type: ${content}`);

        try {
            const { html, mainContent } = await scrapeWithPuppeteer(browser, url);
            progressBar.increment();
            console.log("Step 1: Scraping completed.");

            // Step 2: Check for relevant content
            if (!hasRelevantContent(html, content)) {
                console.log(`No relevant content found for content type: ${content}. Skipping.`);
                progressBar.increment(4);  // Skip remaining steps for this URL
                continue;
            }
            progressBar.increment();  // Increment after checking content
            console.log("Step 2: Relevant content check completed.");

            const fullHtmlPath = await saveFullHtml(url, html);
            progressBar.increment();
            console.log("Step 3: Saving HTML completed.");

            const limitedHtmlSnippet = mainContent;
            let puppeteerScript = null;
            let attempts = 0;
            const maxAttempts = 3;

            while ((!puppeteerScript || !puppeteerScript.includes('puppeteer')) && attempts < maxAttempts) {
                attempts++;
                console.log(`Attempt ${attempts}: Generating Puppeteer script for URL: ${url}`);
                puppeteerScript = await analyzeWithOpenAI(limitedHtmlSnippet, content);

                if (!puppeteerScript || !puppeteerScript.includes('puppeteer')) {
                    console.warn(`Invalid script received on attempt ${attempts}. Retrying...`);
                }
            }

            if (!puppeteerScript) {
                console.error(`Failed to generate a valid Puppeteer script for ${url} after ${maxAttempts} attempts.`);
                progressBar.increment(3);
                continue;
            }
            progressBar.increment();
            console.log("Step 4: Puppeteer script generation completed.");

            const scriptFilename = `script_${Date.now()}.js`;
            const scriptPath = await saveScriptToFile(puppeteerScript, scriptFilename);

            const extractedData = await runSavedScript(scriptPath);

            if (extractedData) {
                await saveAsJson(extractedData, url, content);
            } else {
                console.log('No output from script execution, skipping JSON save. You might have to run it manually.');
            }
            progressBar.increment();
            console.log("Step 5: Script execution and JSON saving completed.");

        } catch (error) {
            console.error(`Error processing ${url}:`, error.message);
        }

    }

    await browser.close();
    progressBar.stop();
}

async function main() {
    const urls = config.urlsToProcess;
    if (!urls || urls.length === 0) {
        console.error('No URLs to process.');
        return;
    }

    for (const { url, content } of urls) {
        await processUrls(url, content);
    }
}

module.exports = {
    main
};
