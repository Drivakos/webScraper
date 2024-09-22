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
const readline = require('readline');

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

async function runSavedScript(scriptPath) {
    try {
        const { stdout, stderr } = await execPromise(`node "${scriptPath}"`);
        console.log('Script stdout:', stdout);
        console.error('Script stderr:', stderr);

        const extractedDataPath = path.join(__dirname, 'extractedData', 'blog.json');

        // Retry mechanism to wait for the JSON file to be created because the script takes some time to run
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

async function clearDirectory(directory, progressBar) {
    try {
        const files = await fs.readdir(directory);
        for (const file of files) {
            const filePath = path.join(directory, file);
            const fileStat = await fs.stat(filePath);

            if (fileStat.isDirectory()) {
                await clearDirectory(filePath, progressBar); // Recursively clear subdirectories
            } else {
                await fs.unlink(filePath); // Delete the file
                progressBar.increment(); // Increment progress after each file is deleted
            }
        }
        console.log(`Directory contents cleared: ${directory}`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`Directory not found: ${directory}`);
        } else {
            console.error(`Error clearing directory ${directory}:`, error.message);
        }
    }
}

// Function to clear all saved data directories: extractedData, scripts, html
async function clearAllData() {
    const directories = ['extractedData', 'scripts', 'html'];

    // Count total number of files across all directories
    let totalFiles = 0;
    for (const dir of directories) {
        const fullPath = path.join(__dirname, dir);
        totalFiles += await countFiles(fullPath); // Count total files to delete
    }

    // Initialize progress bar
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(totalFiles, 0); // Start progress bar with total file count

    for (const dir of directories) {
        const fullPath = path.join(__dirname, dir);
        await clearDirectory(fullPath, progressBar); // Clear files and update progress
    }

    progressBar.stop(); // Stop the progress bar when done
    console.log('All data cleared.');
}

// Function to count the total number of files in a directory (recursively)
async function countFiles(directory) {
    try {
        const files = await fs.readdir(directory);
        let totalFiles = 0;
        for (const file of files) {
            const filePath = path.join(directory, file);
            const fileStat = await fs.stat(filePath);

            if (fileStat.isDirectory()) {
                totalFiles += await countFiles(filePath); // Recursively count files in subdirectories
            } else {
                totalFiles++; // Count the file
            }
        }
        return totalFiles;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return 0; // Directory doesn't exist, return 0
        }
        console.error(`Error counting files in directory ${directory}:`, error.message);
        return 0;
    }
}

(async () => {
    try {
        // Dynamic imports for chalk and figlet
        const chalk = (await import('chalk')).default;
        const figlet = (await import('figlet')).default;

        // Create readline interface
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        // Function to display the menu
        function displayMenu() {
            console.log(chalk.blue.bold(figlet.textSync('CLI Menu', { horizontalLayout: 'full' })));
            console.log(chalk.green("\nChoose an option:"));
            console.log(chalk.cyan("1: ") + chalk.white("Start Scraping"));
            console.log(chalk.cyan("2: ") + chalk.white("Clear Generated Files"));
            console.log(chalk.cyan("3: ") + chalk.white("Exit"));
            console.log(chalk.gray("\nType the number of your choice and press Enter."));
        }

        // Handle user input
        function handleUserInput(input) {
            switch (input.trim()) {
                case '1':
                    console.log(chalk.yellow('Starting the scraping process...'));
                    main().then(() => {
                        displayMenu();
                    });
                    break;
                case '2':
                    console.log(chalk.yellow('Clearing all generated files...'));
                    clearAllData().then(() => {
                        displayMenu();
                    });
                    break;
                case '3':
                    console.log(chalk.red('Exiting...'));
                    rl.close();
                    break;
                default:
                    console.log(chalk.red('Invalid option. Please select 1, 2, or 3.'));
                    displayMenu();
            }
        }

        // Setup readline and display the menu
        displayMenu();
        rl.on('line', handleUserInput);

    } catch (error) {
        console.error('Error loading modules:', error.message);
    }
})();