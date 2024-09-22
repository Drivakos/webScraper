require('dotenv').config();

const configuration = {
    openaiApiKey: process.env.OPENAI_API_KEY,
    urlsToProcess: process.env.URLS_TO_PROCESS ? JSON.parse(process.env.URLS_TO_PROCESS) : [],
};

if (!configuration.openaiApiKey) {
    console.error('Error: OpenAI API key is missing. Please set your OPENAI_API_KEY environment variable.');
    process.exit(1);
}

module.exports = configuration;
