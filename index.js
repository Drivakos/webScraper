require('dotenv').config();
const puppeteer = require('puppeteer');
const { Configuration, OpenAIApi } = require('openai');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const cliProgress = require('cli-progress');

// OpenAI Setup
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function scrapeWithPuppeteer(url) {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    const fullHtml = await page.evaluate(() => document.querySelector('html').innerHTML);
    const $ = cheerio.load(fullHtml);
    $('script, meta, link, noscript, style').remove();
    const mainContent = $('main').html() || '';

    await browser.close();
    await saveFullHtml(url, $.html()); // Save the cleaned version of the full HTML

    return limitHtmlSize(mainContent, 3000);
}

// Function to save the full HTML content to the "html" folder
async function saveFullHtml(url, cleanedHtml) {
    const htmlDir = path.join(__dirname, 'html');
    ensureDirectoryExists(htmlDir);

    const { hostname } = new URL(url);
    const filename = `body.html`; // Use a different filename to indicate it's cleaned
    const filePath = path.join(htmlDir, filename);
    console.log('cleanedHtml is : ', cleanedHtml)
    fs.writeFileSync(filePath, cleanedHtml, 'utf-8');
}

// Function to check for relevant content using keyword-based filtering
function hasRelevantContent(html, contentType) {
    const relevantKeywords = {
        'blog articles': ['blog', 'article', 'post'],
        'product data': ['product', 'price', 'sale']
    };
    const keywords = relevantKeywords[contentType] || [];
    return keywords.some(keyword => html.includes(keyword));
}

// Function to call OpenAI API to generate Puppeteer script
async function analyzeWithOpenAI(limitedHtmlSnippet, contentType) {
    const test = path.join(__dirname, '../html/body.html')
    console.log(test)
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
            and save the extracted data as JSON to  jsonPath = path.join(__dirname, '..', 'extractedData', 'data.json').
            the data should be structured as below if possible :
            "blogPosts": [
            {
              "title": "...",
              "url": "...",
              "publicationDate": "...",
              "image": "...",
              "summary": "...",
              "readMoreLink": "...",
              any other useful info that can be utilized later
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
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec); // Promisify exec to use async/await

    try {
        const { stdout, stderr } = await execPromise(`node ${scriptPath}`);

        if (stderr) {
            console.error('Error executing script:', stderr);
            return null;
        }

        return stdout.trim();
    } catch (error) {
        console.error('Error running saved Puppeteer script:', error);
        return null;
    }
}

// Function to save the Puppeteer script under the "scripts" folder
async function saveScriptToFile(scriptContent, filename) {
    const scriptsDir = path.join(__dirname, 'scripts');
    ensureDirectoryExists(scriptsDir);

    const filePath = path.join(scriptsDir, filename);
    const cleanedScript = scriptContent
        .replace(/```javascript/g, '')
        .replace(/```/g, '')
        .replace(/This Puppeteer script[\s\S]*$/, '');

    fs.writeFileSync(filePath, cleanedScript.trim(), 'utf8');
    console.log(`Script saved to: ${filePath}`);

    return filePath; // Return the script path
}

// Helper function to ensure a directory exists
function ensureDirectoryExists(directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
}

function saveAsJson(data, url, contentType) {
    const dataDir = path.join(__dirname, 'data');
    ensureDirectoryExists(dataDir);

    const { hostname } = new URL(url);
    const filename = `${hostname}_${contentType.replace(/\s+/g, '_')}.json`;
    const filePath = path.join(dataDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Data saved to ${filePath}`);
}

// Main function to process each URL
async function processUrls(urls) {
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

    progressBar.start(urls.length, 0);

    await Promise.all(urls.map(async ({ url, content }, index) => {
        console.log(`Processing URL: ${url} for content type: ${content}`);

        if (!process.env.OPENAI_API_KEY) {
            console.error('Error: OpenAI API key is missing. Please set your OPENAI_API_KEY environment variable.');
            process.exit(1);
        }

        try {
            const html = await scrapeWithPuppeteer(url);

            // Keep trying to get a valid script from OpenAI
            let puppeteerScript = null;
            let attempts = 0;

            while (!puppeteerScript || !puppeteerScript.includes('puppeteer')) {
                attempts++;
                console.log(`Attempt ${attempts}: Trying to get a valid script for URL: ${url}`);
                puppeteerScript = await analyzeWithOpenAI(html, content);
                progressBar.update(index + (attempts * 0.1)); // Update the progress bar with each attempt
            }

            const scriptFilename = `script_${Date.now()}.js`;
            const scriptPath = await saveScriptToFile(puppeteerScript, scriptFilename);

            const scriptOutput = await runSavedScript(scriptPath);

            if (scriptOutput) {
                saveAsJson({ url, contentType: content, scriptOutput }, url, content);
            } else {
                console.log('No output from script execution, skipping JSON save, you might have to run it manually.');
            }

        } catch (error) {
            console.error(`Error processing ${url}:`, error.message);
        }

        progressBar.increment();
    }));

    progressBar.stop();
}

const urlsToProcess = process.env.URLS_TO_PROCESS ? JSON.parse(process.env.URLS_TO_PROCESS) : [];

if (urlsToProcess.length === 0) {
    console.error('Error: No URLs provided in the environment variable "URLS_TO_PROCESS".');
    process.exit(1);
}

urlsToProcess.forEach(urlObject => {
    console.log(`Processing URL: ${urlObject.url} for content type: ${urlObject.content}`);
});

processUrls(urlsToProcess).catch(console.error);

function limitHtmlSize(html, maxSize = 3000) {
    return html.slice(0, maxSize);
}

processUrls(urlsToProcess).catch(console.error);