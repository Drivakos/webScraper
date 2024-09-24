# Web Scraper with OpenAI Integration

This project is a **web scraper** that uses **Puppeteer** for scraping web pages and **OpenAI** for analyzing the scraped content.  
The scraper extracts HTML from target URLs, processes it with OpenAI to generate Puppeteer scripts, and saves the data extracted data based on the keywords provided in structured JSON files.

## Features

- **Web Scraping**: Uses Puppeteer to scrape websites and extract HTML.
- **Content Analysis**: Integrates with OpenAI to analyze scraped HTML and generate scripts for specific content extraction.
- **File Management**: Saves generated scripts and extracted data in structured directories.
- **CLI Menu**: Includes a simple command-line interface for initiating scraping and clearing generated files.
- **Modularized Code**: The project is structured for maintainability and scalability, with services and utilities separated into distinct modules.

## Project Structure

```bash
/project-root
├── /generated
│   ├── /extractedData  # Stores JSON output of extracted data
│   ├── /html           # Stores HTML files scraped from websites
│   └── /scripts        # Stores generated Puppeteer scripts
├── /src
│   ├── /utils
│   │   ├── fileUtils.js         # File-related utilities (e.g., saving files, ensuring directories exist)
│   │   └── directoryUtils.js    # Utilities for managing directories
│   ├── /services
│   │   ├── openaiService.js     # Handles communication with OpenAI API
│   │   ├── puppeteerService.js  # Manages Puppeteer browser sessions and scraping logic
│   │   └── scraperService.js    # Scraping logic and relevant content checking
│   ├── cli.js                   # Command-line interface for user interactions
│   ├── config.js                # Configuration for the project (API keys, URLs to process)
│   └── app.js                   # Main application logic, processing URLs and orchestrating services
├── package.json
└── .env                         # Environment variables (API keys, URLs to process)

```
**Requirements**  
Node.js: Make sure you have Node.js installed on your system.  
Puppeteer: Puppeteer is used for scraping web pages.  
OpenAI API: You'll need an OpenAI API key to use the content analysis feature.  

**Installation**  
1. Clone the repository  
```bash
git clone https://github.com/your-username/web-scraper.git
```
2. Navigate to the project directory:  
```bash
cd web-scraper
```
3. Install the dependencies:  
```bash
npm install
```
4. Set up the environment variables by creating a .env file in the project root:  
```bash
touch .env
```
5. Add the following variables to your .env file:  
```bash
OPENAI_API_KEY=your-openai-api-key
URLS_TO_PROCESS=[{"url":"https://example.com", "content":"blog articles"}]
```

**Usage**  
You can run the project using the command-line interface (CLI) or programmatically from app.js.  

**Start Scraping**  
To start scraping and processing URLs, run:  
```bash
npm start
```
Follow the on-screen prompts to initiate scraping or clear generated files.  

**Clear Generated Files**  
To clear the extractedData, scripts, and html directories, select the "Clear Generated Files" option in the CLI menu.  

**Customization**  
You can customize the project by adding URLs to the URLS_TO_PROCESS environment variable in the .env file.  
Modify the structure and content of the scraper in the relevant service files (like scraperService.js).

**Contribution**  
Feel free to fork the project and submit pull requests. Make sure to test any changes thoroughly.  

**License**  
This project is licensed under the MIT License.  
