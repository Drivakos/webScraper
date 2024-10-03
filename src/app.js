const path = require('path');
const { scrapeWithPuppeteer, runSavedScript, launchBrowser } = require('./services/puppeteerService');
const { analyzeWithOpenAI } = require('./services/openaiService');
const { saveAsJson, saveFullHtml, saveScriptToFile } = require('./utils/fileUtils');
const config = require('./config');
const cliProgress = require("cli-progress");
const { hasRelevantContent } = require('./services/scrapperService');
const { connectDB, closeDB} = require('./services/db');
const fs = require('fs').promises;
require('dotenv').config();

async function processUrls(urls) {
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    const totalSteps = urls.length * 5;
    progressBar.start(totalSteps, 0);

    const browser = await launchBrowser();
    const db = await connectDB();

    for (const { url, content } of urls) {
        console.log(`\nProcessing URL: ${url} for content type: ${content}`);

        let scriptPath = null; // To store the script path

        try {
            const { html, mainContent } = await scrapeWithPuppeteer(browser, url);
            progressBar.increment();
            console.log("Step 1: Scraping completed.");

            if (!hasRelevantContent(html, content)) {
                console.log(`No relevant content found for content type: ${content}. Skipping.`);
                progressBar.increment(4);
                continue;
            }
            progressBar.increment();
            console.log("Step 2: Relevant content check completed.");

            const htmlDir = path.join(__dirname, '..', 'html');
            const fullHtmlPath = await saveFullHtml(htmlDir, html);  // Save HTML locally
            progressBar.increment();
            console.log("Step 3: Saving HTML completed.");

            // Generate or fetch Puppeteer script from MongoDB
            const limitedHtmlSnippet = mainContent;
            let puppeteerScript = null;
            let scriptId = null;
            const existingScript = await db.collection('scripts').findOne({ url });

            if (existingScript) {
                puppeteerScript = existingScript.script;
                scriptId = existingScript._id;
                console.log("Using existing Puppeteer script from DB. Skipping local save.");
                const scriptFilename = `script_${Date.now()}.js`;
                scriptPath = await saveScriptToFile(puppeteerScript, scriptFilename);
                console.log("Existing script saved to a temporary file.");
            } else {
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

                const cleanedScript = puppeteerScript
                    .replace(/```javascript/g, '')
                    .replace(/```/g, '')
                    .replace(/This Puppeteer script[\s\S]*$/, '')
                    .trim();  // Ensure no extra whitespace or new lines

                console.log("Generated and cleaned Puppeteer script.");

                const scriptDoc = { url, script: cleanedScript, created_at: new Date() };
                const scriptResult = await db.collection('scripts').insertOne(scriptDoc);
                scriptId = scriptResult.insertedId;

                puppeteerScript = cleanedScript;
                progressBar.increment();

                // Save Puppeteer script locally for execution
                const scriptFilename = `script_${Date.now()}.js`;
                scriptPath = await saveScriptToFile(puppeteerScript, scriptFilename);
                console.log("Saved generated Puppeteer script locally.");
            }

            try {
                const extractedData = await runSavedScript(scriptPath);
                if (extractedData) {
                    await saveAsJson(extractedData, url, content);
                    console.log("Saved extracted data to JSON locally.");

                    const dataDoc = {
                        url,
                        content,
                        results: extractedData,
                        script_id: scriptId,
                        status: 'success',
                        last_scraped_at: new Date()
                    };

                    // Remove the _id field if it exists to avoid trying to update it
                    delete dataDoc._id;

                    await db.collection('scraped_data').insertOne(dataDoc);  // Save data to MongoDB collection
                    console.log("Saved extracted data to MongoDB.");

                    await db.collection('links').updateOne({ url }, { $set: dataDoc }, { upsert: true });
                    console.log("Saved reference to scraped data in the 'links' collection.");
                } else {
                    console.log('No output from script execution, skipping JSON save.');
                }

                progressBar.increment();
                console.log("Step 5: Script execution and JSON saving completed.");

            } catch (error) {
                console.error("Error running Puppeteer script:", error);
            }

        } catch (error) {
            console.error(`Error processing ${url}:`, error.message);
        }
    }

    await browser.close();
    await closeDB();
    progressBar.stop();
}

async function main() {
    const urls = config.urlsToProcess;
    if (!urls || urls.length === 0) {
        console.error('No URLs to process.');
        return;
    }
    await processUrls(urls);
}

module.exports = {
    main
};
