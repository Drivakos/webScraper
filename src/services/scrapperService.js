const natural = require('natural');

function preprocess(text) {
    const tokenizer = new natural.WordTokenizer();
    const stemmer = natural.PorterStemmer;
    return tokenizer.tokenize(text.toLowerCase())
        .map(word => stemmer.stem(word));
}

function hasRelevantContent(html, contentType) {
    const processedHTML = preprocess(html);
    const processedContentType = preprocess(contentType).flat();
    return processedContentType.some(keyword => processedHTML.includes(keyword));
}

module.exports = {
    hasRelevantContent
};
