const { Configuration, OpenAIApi } = require('openai');
const config = require('../config');

const configuration = new Configuration({
    apiKey: config.openaiApiKey
});
const openai = new OpenAIApi(configuration);

async function analyzeWithOpenAI(htmlSnippet, contentType) {
    const messages = [
        { role: 'system', content: 'You are an AI assistant...' },
        { role: 'user', content: `Analyze HTML for "${contentType}". Extract titles, summaries, URLs... ${htmlSnippet}` }
    ];

    try {
        const response = await openai.createChatCompletion({
            model: 'gpt-4',
            messages,
            max_tokens: 2000
        });
        return response.data.choices[0].message.content.trim();
    } catch (error) {
        console.error("Error during OpenAI API call:", error.message);
        return null;
    }
}

module.exports = {
    analyzeWithOpenAI
};
