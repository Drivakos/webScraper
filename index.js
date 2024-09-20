require('dotenv').config();
const puppeteer = require('puppeteer');
const { MongoClient } = require('mongodb');
const { Configuration, OpenAIApi } = require('openai');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// OpenAI Setup
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Function to scrape a website using Puppeteer
async function scrapeWithPuppeteer(url) {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    const bodyContent = await page.evaluate(() => {
        return document.querySelector('body').innerHTML;
    });
    await browser.close();
    return bodyContent;
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

function extractRelevantSections(html, contentType) {
    const $ = cheerio.load(html);
    let relevantContent = '';

    // Focus only on the body of the HTML to avoid irrelevant headers and metadata
    const body = $('body');

    if (contentType.includes('blog articles')) {
        relevantContent = body.find('article, .blog-post').html();
    }

    if (contentType.includes('product data')) {
        relevantContent = body.find('.product, .product-listing, .product-details').html();
    }

    return relevantContent || body.html().slice(0, 2000);
}

function chunkHTML(html, maxLength = 2000) {
    return html.trim().length > maxLength ? html.slice(0, maxLength) : html.trim();
}

async function analyzeWithOpenAI(htmlSnippet, contentType) {
    const messages = [
        {
            role: 'system',
            content: `You are an expert at analyzing HTML and extracting relevant sections based on content type.
             You generate Puppeteer scripts that help scrape blog articles from the given HTML.`
        },
        {
            role: 'user',
            content: `
                Analyze the following HTML and check if it contains ${contentType}:
                ---- HTML ----
                ${htmlSnippet}
                ----------------
                The content type is "${contentType}" and it relates to blog articles. Specifically, look for sections that contain:
                - Blog post titles (<h1>, <h2>, <h3>)
                - Blog post summaries or introductory paragraphs (<p>, <div>)
                - Links to the full blog posts (<a>)
                - Blog post images (<img>, <picture>)

                Based on your analysis, provide a Puppeteer script that can extract the blog post titles, summaries, URLs, and images from the given HTML.
                Do not give any comments or any other input, only return the script

                If the HTML does not contain relevant blog article information, return "No blog articles found."
            `
        }
    ];

    try {
        const response = await openai.createChatCompletion({
            model: 'gpt-3.5-turbo',
            messages: messages,
            max_tokens: 1000 // Allow more tokens for detailed script responses
        });

        console.log('OpenAI Response:', response.data.choices[0].message.content);
        return response.data.choices[0].message.content.trim();
    } catch (error) {
        console.error("Error during OpenAI API call:", error.response ? error.response.data : error.message);
        return `Error: ${error.response ? error.response.data.error.message : error.message}`;
    }
}

// Function to save script or data to a file
async function saveScriptToFile(scriptContent, filename) {
    const filePath = path.join(__dirname, filename);
    fs.writeFileSync(filePath, scriptContent, 'utf8');
    console.log(`Script saved to: ${filePath}`);
}

// Function to save data to MongoDB
async function saveToMongoDB(data) {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();

    const db = client.db('scrapedDataDB');
    const collection = db.collection('scrapedData');

    await collection.insertMany(data);
    await client.close();
}

// Main function to process each URL
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec); // Promisify exec to use async/await

async function processUrls(urls) {
    await Promise.all(urls.map(async ({ url, content }) => {
        console.log(`Processing URL: ${url} for content type: ${content}`);

        if (!process.env.OPENAI_API_KEY) {
            console.error('Error: OpenAI API key is missing. Please set your OPENAI_API_KEY environment variable.');
            process.exit(1);
        }

        try {
            // Scrape the website
            const html = await scrapeWithPuppeteer(url);

            // Check for relevant content
            if (hasRelevantContent(html, content)) {
                const relevantHtml = extractRelevantSections(html, content);
                const htmlSnippet = chunkHTML(relevantHtml);

                // Send to OpenAI for analysis
                const response = await analyzeWithOpenAI(htmlSnippet, content);
                console.log('OpenAI response:', response);

                // Check if the response contains a Puppeteer script
                if (response && response.includes('require(\'puppeteer\')')) {
                    const scriptFilename = `script_${Date.now()}.js`;
                    await saveScriptToFile(response, scriptFilename);

                    // Run the saved Puppeteer script and capture output
                    const scriptOutput = await runSavedScript(scriptFilename);

                    // If the script returns output, save it as a JSON file
                    if (scriptOutput) {
                        const jsonFilename = `${new URL(url).hostname}_output_${Date.now()}.json`;
                        saveAsJson({ url, contentType: content, scriptOutput }, url, content);
                    } else {
                        console.log('No output from script execution, skipping JSON save.');
                    }
                } else {
                    console.log('No relevant script found in the response, skipping JSON save.');
                }
            } else {
                console.log('No relevant content found, skipping JSON save.');
            }
        } catch (error) {
            console.error(`Error processing ${url}:`, error.message);
        }
    }));
}

// Function to run the saved Puppeteer script and capture output
async function runSavedScript(scriptPath) {
    try {
        const { stdout, stderr } = await execPromise(`node ${scriptPath}`);
        if (stderr) {
            console.error('Error executing script:', stderr);
        }
        return stdout.trim(); // Return the captured output
    } catch (error) {
        console.error('Error running saved Puppeteer script:', error);
        return null; // Return null if an error occurs or no output is found
    }
}

// Function to save data as JSON
function saveAsJson(data, url, contentType) {
    const { hostname } = new URL(url);
    const filename = `${hostname}_${contentType.replace(/\s+/g, '_')}.json`;
    const filePath = path.join(__dirname, filename);

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Data saved to ${filePath}`);
}

const urlsToProcess = [
    { url: 'https://www.example.com/blog', content: 'blog articles' },
];

processUrls(urlsToProcess).catch(console.error);
