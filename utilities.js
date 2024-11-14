const fs = require('fs');
const path = require('path');

// Helper function to load JSON data from a file
function loadJsonFile(filePath) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify({}), 'utf-8');
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
}

// Helper function to save JSON data to a file
function saveJsonFile(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// Example utility: delay function to simulate a wait
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    loadJsonFile,
    saveJsonFile,
    delay
};
