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

// Function to save rules to the rules.json file
function saveRules(rules) {
    fs.writeFileSync(RULES_FILE_PATH, JSON.stringify(rules, null, 2), 'utf-8');
}

// Load existing rules at startup
let rules = loadRules();

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
        const urlMatch = embed.url.match(pixivUrlRegex);
        if (urlMatch) {
            return urlMatch[0].replace('www.pixiv.net', 'www.phixiv.net');
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
        if (response.status === 200) {
            return true;
        }
    } catch (error) {
        console.error(`URL verification failed for ${url}:`, error.response?.status || error.message);
    }
    return false;
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

// Function to add new image to cache
async function addImageToCache(message) {
    let imageUrl;

    if (message.attachments.size > 0) {
        imageUrl = message.attachments.first().url;
    }

    if (!imageUrl) {
        imageUrl = extractPixivImageUrl(message);
    }

    if (!imageUrl) {
        imageUrl = extractTwitterImageUrl(message);
    }

    if (imageUrl && await verifyUrl(imageUrl)) {
        const isDuplicate = imageCache.some((img) => img.url === imageUrl);
        if (!isDuplicate) {
            const nextId = imageCache.length + 1;
            imageCache.push({ id: nextId, url: imageUrl });
            console.log(`New image added to cache with ID: ${nextId} and URL: ${imageUrl}`);
            saveImageCache();
        }
    } else {
        console.log(`Invalid or inaccessible URL: ${imageUrl}`);
    }
}

// Bot ready event


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


// Message handler
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Check if the !nevoboy command is being used in the target channel
    if (message.channel.id === TARGET_CHANNEL_ID && message.content.startsWith('!nevoboy')) {
        return message.channel.send("Can't be used in this channel.");
    }

    if (message.content === '!nevobuildcache') {
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

    if (message.content.startsWith('!nevoboy')) {
        const parts = message.content.split(' ');
        let imageId;

        if (parts.length > 1) {
            imageId = parseInt(parts[1], 10);
        }

        if (imageId) {
            const image = imageCache.find(img => img.id === imageId);
            if (image) {
                return message.channel.send(`ID: ${image.id}\n${image.url}`);
            } else {
                return message.channel.send(`No image found with ID: ${imageId}`);
            }
        } else {
            const randomImage = imageCache[Math.floor(Math.random() * imageCache.length)];
            return message.channel.send(`ID: ${randomImage.id}\n${randomImage.url}`);
        }
    }

    if (message.content === '!nevoboy') {
        console.log('!nevoboy triggered, running the command...');
        const randomImage = imageCache[Math.floor(Math.random() * imageCache.length)];
        return message.channel.send(`ID: ${randomImage.id}\n${randomImage.url}`);
    }

    // Rule retrieval
    if (message.content.startsWith('rule')) {
        const parts = message.content.split(' ');
        if (parts.length > 1) {
            const ruleId = parts[1];
            const rule = rules[ruleId];
            if (rule) {
                return message.channel.send(`${rule}`);
            } else {
                return false;
            }
        }
    }

    // Rule addition (only for user with ID 200048044786450433)
    if (message.content.startsWith('!nevoaddrule') && message.author.id === '200048044786450433') {
        const parts = message.content.split(' ');
        if (parts.length >= 3) {
            const ruleId = parts[1];
            const phrase = parts.slice(2).join(' ');
            rules[ruleId] = phrase;
            saveRules(rules);
            return message.channel.send(`Rule ${ruleId} added: ${phrase}`);
        } else {
            return message.channel.send('Invalid format. Usage: !nevoaddrule [ruleid] [phrase]');
        }
    }
});


// Log in the client with the bot token from environment variables
client.login(process.env.BOT_TOKEN);
