const { Configuration, OpenAIApi } = require('openai');
const config = require('../config');

const configuration = new Configuration({
    apiKey: config.openaiApiKey
});
const openai = new OpenAIApi(configuration);

async function analyzeWithOpenAI(htmlSnippet, contentType) {
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
            ${htmlSnippet}
            ----------------

            Respond only with a valid JavaScript Puppeteer script ready to be executed, no description or explanation.`
        }
    ];

    const maxRetries = 3;
    let attempt = 0;
    let delay = 1000;

    while (attempt < maxRetries) {
        try {
            const response = await openai.createChatCompletion({
                model: 'gpt-4o-mini',
                messages: messages,
                max_tokens: 2000
            });
            return response.data.choices[0].message.content.trim();
        } catch (error) {
            if (error.response && error.response.status === 429) {
                console.error("Rate limit hit. Retrying after delay...");
                attempt++;
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
            } else {
                console.error("Error during OpenAI API call:", error.message, error);
                return null;
            }
        }
    }
    console.error("Max retries reached. Failed to get a valid response from OpenAI.");
    return null;
}

module.exports = {
    analyzeWithOpenAI
};
