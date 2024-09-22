require('dotenv').config();
const puppeteer = require('puppeteer');
const { Configuration, OpenAIApi } = require('openai');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');
const cliProgress = require('cli-progress');
const { URL } = require('url');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// OpenAI Setup
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OpenAI API key is missing. Please set your OPENAI_API_KEY environment variable.');
    process.exit(1);
}

async function ensureDirectoryExists(directory) {
    try {
        await fs.mkdir(directory, { recursive: true });
    } catch (error) {
        console.error(`Error creating directory ${directory}:`, error.message);
    }
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
        return { html: '', mainContent: '' };
    } finally {
        await page.close();
    }
}

// Function to save the full HTML content to the "html" folder
async function saveFullHtml(url, cleanedHtml) {
    const htmlDir = path.join(__dirname, 'html');
    await ensureDirectoryExists(htmlDir);
    const filename = `body.html`;
    const filePath = path.join(htmlDir, filename);
    await fs.writeFile(filePath, cleanedHtml, 'utf-8');
    return filePath;
}

// Function to check for relevant content using keyword-based filtering
function hasRelevantContent(html, contentType) {
    const relevantKeywords = {
        'blog articles': ['blog', 'article', 'post'],
        'product data': ['product', 'price', 'sale']
    };
    const keywords = relevantKeywords[contentType] || [];
    return keywords.some(keyword => html.toLowerCase().includes(keyword));
}

// Function to call OpenAI API to generate Puppeteer script
async function analyzeWithOpenAI(limitedHtmlSnippet, contentType) {
    const messages = [
        {
            role: 'system',
            content: `You are an AI assistant that analyzes HTML content and provides Puppeteer scripts for extracting
            specific content based on content types such as 'blog articles' or 'product data'.`
        },
        {
            role: 'user',
            content: `Analyze the following HTML and determine the best way to extract the content related to 
            "${contentType}". Generate a Puppeteer script that extracts titles (h1, h2, h3), summaries (p, div), 
            URLs (a), and images (img). 
            The Puppeteer script should read the HTML from filePath = path.join(__dirname, '..', 'html', 'body.html');
            and save the extracted data as JSON to jsonPath = path.join(__dirname, '..', 'extractedData', 'blog.json').
            The data should be structured as below if possible:
            "blogPosts": [
                {
                    "title": "...",
                    "url": "...",
                    "publicationDate": "...",
                    "image": "...",
                    "summary": "...",
                    "readMoreLink": "...",
                    "anyOtherUsefulInfo": "..."
                }
            ]

            ---- HTML ----
            ${limitedHtmlSnippet}
            ----------------

            Respond only with a valid JavaScript Puppeteer script ready to be executed, no description or explanation.`
        }
    ];

    try {
        const response = await openai.createChatCompletion({
            model: 'gpt-4o',
            messages: messages,
            max_tokens: 2000
        });

        return response.data.choices[0].message.content.trim();
    } catch (error) {
        console.error("Error during OpenAI API call:", error.response ? error.response.data : error.message);
        return null;
    }
}

// Function to run the Puppeteer script
async function runSavedScript(scriptPath) {
    try {
        const { stdout, stderr } = await execPromise(`node ${scriptPath}`);

        if (stderr) {
            console.error('Error executing script:', stderr);
            return null;
        }

        return stdout.trim();
    } catch (error) {
        console.error('Error running saved Puppeteer script:', error.message);
        return null;
    }
}

// Function to save the Puppeteer script under the "scripts" folder
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

function limitHtmlSize(html, maxSize = 3000) {
    return html.slice(0, maxSize);
}

// Main function to process each URL
async function processUrls(urls) {
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(urls.length, 0);
    const browser = await puppeteer.launch({ headless: "new" });

    for (const { url, content } of urls) {
        console.log(`\nProcessing URL: ${url} for content type: ${content}`);

        try {
            const { html, mainContent } = await scrapeWithPuppeteer(browser, url);

            if (!hasRelevantContent(html, content)) {
                console.log(`No relevant content found for content type: ${content}. Skipping.`);
                progressBar.increment();
                continue;
            }

            const fullHtmlPath = await saveFullHtml(url, html);
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
                progressBar.increment();
                continue;
            }

            const scriptFilename = `script_${Date.now()}.js`;
            const scriptPath = await saveScriptToFile(puppeteerScript, scriptFilename);
            const extractedData = await runSavedScript(scriptPath);

            if (extractedData) {
                await saveAsJson({ url, contentType: content, extractedData }, url, content);
            } else {
                console.log('No output from script execution, skipping JSON save. You might have to run it manually.');
            }

        } catch (error) {
            console.error(`Error processing ${url}:`, error.message);
        }

        progressBar.increment();
    }

    await browser.close();
    progressBar.stop();
}

async function main() {
    const urlsToProcess = process.env.URLS_TO_PROCESS ? JSON.parse(process.env.URLS_TO_PROCESS) : [];

    if (urlsToProcess.length === 0) {
        console.error('Error: No URLs provided in the environment variable "URLS_TO_PROCESS".');
        process.exit(1);
    }

    urlsToProcess.forEach(urlObject => {
        console.log(`Scheduled processing for URL: ${urlObject.url} with content type: ${urlObject.content}`);
    });

    await processUrls(urlsToProcess);
}

main().catch(error => {
    console.error('An unexpected error occurred:', error.message);
    process.exit(1);
});
