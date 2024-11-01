require('dotenv').config(); // Load environment variables from .env file
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs'); // Import fs module to handle file operations
const path = require('path'); // Import path module for file path handling
const axios = require('axios'); // Axios for making HTTP requests

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const TARGET_CHANNEL_ID = '1104045425029287988'; // Channel ID for 'this-is-for-nevo'
const CACHE_FILE_PATH = path.join('C:', 'Users', 'Nevo', 'NevoBot', 'image_cache.json'); // Path for the JSON cache file
const RULES_FILE_PATH = path.join(__dirname, 'rules.json'); // Path for the rules JSON file
const COMMANDS_FILE_PATH = path.join(__dirname, 'commandwords.json'); // Path for the commands JSON file


let imageCache = []; // Array to store image objects { id, url }
let isBuildingCache = false; // Flag to check if cache is currently being built

// Function to load rules from the rules.json file
function loadRules() {
    if (!fs.existsSync(RULES_FILE_PATH)) {
        fs.writeFileSync(RULES_FILE_PATH, JSON.stringify({}), 'utf-8');
    }
    const data = fs.readFileSync(RULES_FILE_PATH, 'utf-8');
    return JSON.parse(data);
}

// Function to load commands from the commands.json file
function loadCommands() {
    if (!fs.existsSync(COMMANDS_FILE_PATH)) {
        fs.writeFileSync(COMMANDS_FILE_PATH, JSON.stringify({}), 'utf-8');
    }
    const data = fs.readFileSync(COMMANDS_FILE_PATH, 'utf-8');
    return JSON.parse(data);
}

// Function to save rules to the rules.json file
function saveRules(rules) {
    fs.writeFileSync(RULES_FILE_PATH, JSON.stringify(rules, null, 2), 'utf-8');
}

// Load existing rules at startup
let rules = loadRules();
let commands = loadCommands();

// Function to extract Twitter images from embeds
const extractTwitterImageUrl = (msg) => {
    if (msg.embeds.length > 0) {
        const embed = msg.embeds[0];
        if (embed.image && embed.image.url) {
            return embed.image.url;
        }
    }
    return null;
};

// Function to extract Pixiv images from embeds
const extractPixivImageUrl = (msg) => {
    if (msg.embeds.length > 0) {
        const embed = msg.embeds[0];
        const pixivUrlRegex = /https:\/\/www\.pixiv\.net\/en\/artworks\/\d+/;

        // Check if embed.url exists before matching
        if (embed.url && embed.url.match(pixivUrlRegex)) {
            return embed.url.replace('www.pixiv.net', 'www.phixiv.net');
        }
    }
    return null;
};


// Function to load image cache from a file
async function loadImageCache() {
    try {
        if (fs.existsSync(CACHE_FILE_PATH)) {
            const data = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
            if (data.trim()) {
                imageCache = JSON.parse(data);
                console.log(`Cache loaded with ${imageCache.length} images from the file.`);
            } else {
                console.log('Cache file is empty. Starting with an empty cache.');
            }
        } else {
            console.log('Cache file does not exist. Starting with an empty cache.');
        }
    } catch (error) {
        console.error('Error loading cache from file:', error);
        imageCache = [];
    }
}

// Function to save image cache to a file
function saveImageCache() {
    const data = JSON.stringify(imageCache, null, 2);
    fs.writeFileSync(CACHE_FILE_PATH, data, 'utf-8');
    console.log(`Cache saved with ${imageCache.length} images to file.`);
}

// Function to check if a URL is valid (returns a 200 status)
async function verifyUrl(url) {
    try {
        const response = await axios.head(url);
        return response.status === 200;
    } catch (error) {
        console.error(`URL verification failed for ${url}:`, error.response?.status || error.message);
        return false;
    }
}

// Function to build image cache
async function buildImageCache() {
    console.log('Starting to fetch images from the channel...');
    const targetChannel = client.channels.cache.get(TARGET_CHANNEL_ID);

    if (!targetChannel) {
        console.error('Target channel not found!');
        return 0;
    }

    let totalFetchedImages = 0;
    let lastMessageId;

    try {
        while (true) {
            const messages = await targetChannel.messages.fetch({
                limit: 100,
                before: lastMessageId,
            });

            if (messages.size === 0) break;

            for (const msg of messages.values()) {
                // Only process messages from the correct channel
                if (msg.channel.id !== TARGET_CHANNEL_ID) continue; // Ensure we're in the correct channel

                let imageUrl;

                if (msg.attachments.size > 0) {
                    imageUrl = msg.attachments.first().url;
                }

                if (!imageUrl) {
                    imageUrl = extractPixivImageUrl(msg);
                }

                if (!imageUrl) {
                    imageUrl = extractTwitterImageUrl(msg);
                }

                if (!imageUrl) {
                    imageUrl = extractFxTwitterLink(msg);
                }

                if (imageUrl && await verifyUrl(imageUrl)) {
                    const isDuplicate = imageCache.some((img) => img.url === imageUrl);
                    if (!isDuplicate) {
                        totalFetchedImages++;
                        imageCache.push({ id: totalFetchedImages, url: imageUrl });

                        if (totalFetchedImages % 50 === 0) {
                            console.log(`${totalFetchedImages} images fetched so far...`);
                        }
                    }
                }
            }

            lastMessageId = messages.last().id;
        }

        saveImageCache();
        console.log(`Finished building the cache with a total of ${totalFetchedImages} images.`);
        return totalFetchedImages;
    } catch (error) {
        console.error('Error fetching messages for cache build:', error);
        return totalFetchedImages;
    }
}


// Function to fetch image URL from FXTwitter link
async function fetchFxTwitterImage(fxTwitterLink) {
    try {
        const response = await axios.get(fxTwitterLink);
        const imageUrlRegex = /<meta property="og:image" content="([^"]+)"/; // Adjust regex if necessary
        const match = response.data.match(imageUrlRegex);
        return match ? match[1] : null; // Return the first capturing group (image URL)
    } catch (error) {
        console.error(`Error fetching image from FXTwitter link: ${fxTwitterLink}`, error.message);
        return null;
    }
}







// Function to extract fxtwitter links directly
const extractFxTwitterLink = (msg) => {
    const fxTwitterRegex = /https:\/\/fxtwitter\.com\/\w+\/status\/\d+/;  // Adjust regex to match full tweet URL
    const urlMatch = msg.content.match(fxTwitterRegex);
    return urlMatch ? urlMatch[0] : null;
};

// Function to add new image to cache
async function addImageToCache(message) {
    // Ensure this function only runs for messages in the target channel
    if (message.channel.id !== TARGET_CHANNEL_ID) return;

    // Add a delay of 5 seconds (5000 milliseconds)
    await new Promise(resolve => setTimeout(resolve, 5000));

    let imageUrl = null;

    // Check for attached images first
    if (message.attachments.size > 0) {
        imageUrl = message.attachments.first().url;
        console.log(`Found attachment URL: ${imageUrl}`);
    }

    // Extract image URLs from other sources if no attachment is found
    if (!imageUrl) {
        imageUrl = extractPixivImageUrl(message) || extractTwitterImageUrl(message) || extractFxTwitterLink(message);
        console.log(`Extracted image URL: ${imageUrl}`);
    }

    // If we found an image URL and it's valid
    if (imageUrl && await verifyUrl(imageUrl)) {
        const isDuplicate = imageCache.some((img) => img.url === imageUrl);
        if (!isDuplicate) {
            const newId = imageCache.length + 1;
            imageCache.push({ id: newId, url: imageUrl });
            console.log(`New link found, adding to cache: ${imageUrl}`);
            saveImageCache(); // Ensure the cache is saved after adding
        } else {
            console.log(`Duplicate image URL: ${imageUrl}`);
        }
    } else {
        console.log(`Invalid or inaccessible URL: ${imageUrl}`);
    }
}


// Bot ready event
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    const ruleCount = Object.keys(rules).length;
    console.log(`Rules loaded with ${ruleCount} rules from the file.`);
    // Load cache if it exists, otherwise build the cache on bot startup
    await loadImageCache();

    if (imageCache.length === 0) {
        console.log('No cache found, building cache on startup...');
        await buildImageCache();
    }
});
// Define the command descriptions
const commandDescriptions = {
    '!nevoboy': 'Sends a random image from the cache or an image with a specific ID.',
    'rule [id]': 'Confirms the existence of a rule with the specified ID without revealing its content.',
    '!nevoaddrule [id] [phrase]': 'Adds a new rule for a specific user.',
    '!nevobuildcache': 'Rebuilds the image cache and informs users when it’s done.',
    '!commands': 'Lists all commands available to the bot, including other command triggers.',
    '!rules': 'Lists all currently existing rule IDs without revealing their content.'
};

client.on('messageCreate', async (message) => {
    console.log(`Received message: ${message.content}`);

     // Handle the !nevoboyadd command
     if (message.content.trim().toLowerCase() === '!nevoboyadd') {
        // Fetch the most recent message before this command
        const messages = await message.channel.messages.fetch({ limit: 2 });
        const lastMessage = messages.last();

        if (!lastMessage || lastMessage.id === message.id) {
            return message.channel.send('Could not find the previous message.');
        }

        // Extract image URL from the last message
        let imageUrl = null;

        if (lastMessage.attachments.size > 0) {
            imageUrl = lastMessage.attachments.first().url;
        } else {
            imageUrl = extractPixivImageUrl(lastMessage) || extractTwitterImageUrl(lastMessage) || extractFxTwitterLink(lastMessage);
        }

        if (imageUrl && await verifyUrl(imageUrl)) {
            const isDuplicate = imageCache.some((img) => img.url === imageUrl);
            if (!isDuplicate) {
                const newId = imageCache.length + 1;
                imageCache.push({ id: newId, url: imageUrl });
                saveImageCache();
                return message.channel.send(`Image added to cache with ID: ${newId}`);
            } else {
                return message.channel.send('This image is already in the cache.');
            }
        } else {
            return message.channel.send('No valid image found in the previous message.');
        }
    }


    // Ignore messages from bots
    if (message.author.bot) return;

    const userMessage = message.content.trim().toLowerCase(); // Normalize user message

    

    // Check if the message is from the target channel
    if (message.channel.id === TARGET_CHANNEL_ID) {
        // If the message is from the target channel, do not allow the !nevoboy command
        if (userMessage.startsWith('!nevoboy')) {
            return message.channel.send("Can't be used in this channel.");
        }

        // Handle adding image to cache only from the target channel
        await addImageToCache(message);
        return; // Exit after processing the target channel
    }

    if (userMessage === '!rules') {
        const ruleIds = Object.keys(rules); // Get all rule IDs
        if (ruleIds.length === 0) {
            return message.channel.send('There are currently no rules defined.');
        }
    
        // Join rule IDs into a comma-separated string
        const ruleList = ruleIds.join(', ');
        return message.channel.send(`All rules: ${ruleList}`);
    }


    // Check for the "wah" command with any amount of "a's" or capitalization
    const wahRegex = /^w(a+)h$/i; // Matches "wah" with one or more "a's" (case insensitive)
    if (wahRegex.test(userMessage)) {
        return message.channel.send('https://cdn.discordapp.com/attachments/1069014008427978762/1296913347966406750/image.png?ex=6714042d&is=6712b2ad&hm=26dc4f625a7d63ef63c78237a775a12b9cda194cda16d993ff38b790e72ec4fd&');
    }

    // Handle commands for all other channels
    if (commands[userMessage]) {
        console.log(`Command recognized: ${userMessage}`);
        return message.channel.send(commands[userMessage]); // Send the response from the JSON file
    }

    // Check if the user's message matches any trigger words in commandwords.json
    for (const trigger in commands) {
        if (userMessage.includes(trigger)) {
            console.log(`${trigger}`);
            return message.channel.send(commands[trigger]); // Send the corresponding response
        }
    }

    // Handle the !commands command
    if (userMessage === '!commands') {
        const commandList = Object.entries(commandDescriptions)
            .map(([command, description]) => `${command} - ${description}`)
            .join('\n');

        return message.channel.send(`Here are the available commands:\n${commandList}`);
    }

    // Handle rule command
    if (userMessage.startsWith('rule ')) {
        const ruleId = userMessage.split(' ')[1];
        if (rules[ruleId]) {
            return message.channel.send(`${rules[ruleId]}`); // Send only the rule text
        } else {
            return message.channel.send(`Rule ${ruleId} not found.`);
        }
    }

    // Handle command to add new rule
    if (userMessage.startsWith('!nevoaddrule')) {
        const parts = userMessage.split(' ');
        const userId = message.author.id;

        if (userId !== '200048044786450433') {
            return message.channel.send('You do not have permission to add rules.');
        }

        const ruleId = parts[1];
        const phrase = parts.slice(2).join(' ');

        if (!ruleId || !phrase) {
            return message.channel.send('Please provide a rule ID and the phrase.');
        }

        rules[ruleId] = phrase;
        saveRules(rules);
        return message.channel.send(`Rule ${ruleId} added successfully.`);
    }

// Function to get a more random index using a time-based seed
function getRandomIndex(array) {
    const seed = Date.now();
    return Math.floor(((Math.random() * seed) % array.length));
}

// The !nevoboy command
if (userMessage.startsWith('!nevoboy')) {
    const parts = userMessage.split(' '); // Split the command and arguments
    if (parts.length === 1) {
        // Original random image behavior
        if (imageCache.length > 0) {
            const randomIndex = getRandomIndex(imageCache);
            const randomImage = imageCache[randomIndex];
            return message.channel.send(`ID: ${randomImage.id}\n${randomImage.url}`);
        } else {
            return message.channel.send('No images available in the cache.');
        }
    } else if (parts.length === 2) {
        // Specific ID behavior
        const id = parseInt(parts[1], 10);
        const image = imageCache.find(img => img.id === id);

        if (image) {
            return message.channel.send(`ID: ${image.id}\n${image.url}`);
        } else {
            return message.channel.send(`No image found with ID: ${id}`);
        }
    } else if (parts.length === 3 && parts[1] === 'for') {
        // New behavior for '!nevoboy for @username'
        const mentionedUser = parts[2];
        if (imageCache.length > 0) {
            const randomIndex = getRandomIndex(imageCache);
            const randomImage = imageCache[randomIndex];
            return message.channel.send(`Nevoboy for ${mentionedUser}\nID: ${randomImage.id}\n${randomImage.url}`);
        } else {
            return message.channel.send('No images available in the cache.');
        }
    }
}


    // Handle the command to build the cache
    if (userMessage === '!nevobuildcache') {
        console.log('!nevobuildcache command triggered');

        if (isBuildingCache) {
            return message.channel.send('Cache is already being built. Please wait...');
        }

        if (fs.existsSync(CACHE_FILE_PATH)) {
            fs.unlinkSync(CACHE_FILE_PATH);
            console.log('Existing cache file deleted.');
        }

        imageCache = [];
        console.log('In-memory cache cleared.');

        isBuildingCache = true;

        await message.channel.send('Cache building has started! Please wait...');

        const totalImagesLoaded = await buildImageCache();
        isBuildingCache = false;

        return message.channel.send(`Cache rebuilt with ${totalImagesLoaded} images loaded.`);
    }

    // Handle adding image to cache
    await addImageToCache(message);
});








// Log in the bot using the token from the .env file
client.login(process.env.BOT_TOKEN);
