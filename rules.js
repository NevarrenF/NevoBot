const fs = require('fs');
const path = require('path');

const RULES_FILE_PATH = path.join(__dirname, 'storage', 'rules.json'); // Updated path

// Load rules from the JSON file
function loadRules() {
    if (fs.existsSync(RULES_FILE_PATH)) {
        return JSON.parse(fs.readFileSync(RULES_FILE_PATH, 'utf-8'));
    } else {
        console.error('Rules file not found!');
        return {};
    }
}

// Function to get a rule by ID
function getRuleById(id) {
    const rules = loadRules();
    return rules[id] || 'Rule not found.';
}

module.exports = {
    getRuleById
};
