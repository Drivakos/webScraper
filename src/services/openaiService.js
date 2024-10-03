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
            specific content based on content types such as "${contentType}".`
        },
        {
            role: 'user',
            content: `Analyze the following HTML and determine the best way to extract the content related to 
            "${contentType}".
            Generate a Puppeteer script that extracts titles (h1, h2, h3), summaries, 
            URLs (a), and images (img). 
            The Puppeteer script should read the HTML from filePath = path.join(__dirname, '..' , '..', 'generated', 'html', 'body.html');
            and save the extracted data as JSON to jsonPath = path.join(__dirname, '..' , '..', 'generated', 'extractedData', 'blog.json').
            The data should be structured as below if possible:
            "blogPosts": [
                {
                    "title": "...",
                    "url": "...",
                    "publicationDate": "...",
                    "image": "...",
                    "content": "..."
                    "readMoreLink": "...",
                    "anyOtherUsefulInfo": "..."
                }
            ]

            ---- HTML ----
            ${htmlSnippet}
            ----------------
            Dynamically assign the class that wraps the content
            Respond only with a valid JavaScript Puppeteer script ready to be executed, no description or explanation.`
        }

    ]

    const maxRetries = 3;
    let attempt = 0;
    let delay = 1000;
    const maxDelay = 8000;

    while (attempt < maxRetries) {
        try {
            const response = await openai.createChatCompletion({
                model: 'gpt-4o',
                messages: messages,
                max_tokens: 2000
            });
            if (response && response.data && response.data.choices && response.data.choices.length > 0) {
                return response.data.choices[0].message.content.trim();
            } else {
                console.error('Unexpected response format from OpenAI API.');
                return null;
            }
        } catch (error) {
            if (error.response && error.response.status === 429) {
                console.error("Rate limit hit. Retrying after delay...");
                attempt++;
                await new Promise(resolve => setTimeout(resolve, delay));
                delay = Math.min(delay * 2, maxDelay);
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
