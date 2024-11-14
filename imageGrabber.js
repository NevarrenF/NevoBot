const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Client } = require('discord.js');
const config = require('./config');

const CACHE_FILE_PATH = path.join(__dirname, 'storage', 'image_cache.json');
const DELETED_IMAGES_FILE_PATH = path.join(__dirname, 'storage', 'deleted_images.json');
const DELETED_IDS_FILE_PATH = path.join(__dirname, 'storage', 'deleted_ids.json');
let isBuildingCache = false;

// Load image cache from file
function loadImageCache() {
    if (fs.existsSync(CACHE_FILE_PATH)) {
        return JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf-8'));
    } else {
        console.log('Cache file does not exist. Starting with an empty cache.');
        return [];
    }
}

// Load deleted images from file
function loadDeletedImages() {
    if (fs.existsSync(DELETED_IMAGES_FILE_PATH)) {
        return JSON.parse(fs.readFileSync(DELETED_IMAGES_FILE_PATH, 'utf-8'));
    } else {
        console.log('Deleted images file does not exist. Starting with an empty blacklist.');
        return [];
    }
}

// Load deleted IDs from file
function loadDeletedIds() {
    if (fs.existsSync(DELETED_IDS_FILE_PATH)) {
        return JSON.parse(fs.readFileSync(DELETED_IDS_FILE_PATH, 'utf-8'));
    } else {
        console.log('Deleted IDs file does not exist. Starting with an empty list.');
        return [];
    }
}

// Save image cache to file
function saveImageCache(imageCache) {
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(imageCache, null, 2));
}

// Save deleted images to file
function saveDeletedImages(deletedImages) {
    fs.writeFileSync(DELETED_IMAGES_FILE_PATH, JSON.stringify(deletedImages, null, 2));
}

// Save deleted IDs to file
function saveDeletedIds(deletedIds) {
    fs.writeFileSync(DELETED_IDS_FILE_PATH, JSON.stringify(deletedIds, null, 2));
}

// Function to verify if a URL is valid
async function verifyUrl(url) {
    try {
        const response = await axios.head(url);
        return response.status === 200;
    } catch (error) {
        console.error(`URL verification failed for ${url}:`, error.response?.status || error.message);
        return false;
    }
}

// Function to extract Twitter images from embeds
function extractTwitterImageUrl(msg) {
    if (msg.embeds.length > 0) {
        const embed = msg.embeds[0];
        if (embed.image && embed.image.url) {
            return embed.image.url;
        }
    }
    return null;
}

// Function to extract Pixiv images from embeds
function extractPixivImageUrl(msg) {
    if (msg.embeds.length > 0) {
        const embed = msg.embeds[0];
        const pixivUrlRegex = /https:\/\/www\.pixiv\.net\/en\/artworks\/\d+/;
        if (embed.url && embed.url.match(pixivUrlRegex)) {
            return embed.url.replace('www.pixiv.net', 'www.phixiv.net');
        }
    }
    return null;
}

// Function to extract FXTwitter links from message content
function extractFxTwitterLink(msg) {
    const fxTwitterRegex = /https:\/\/fxtwitter\.com\/\w+\/status\/\d+/;
    const urlMatch = msg.content.match(fxTwitterRegex);
    return urlMatch ? urlMatch[0] : null;
}

// Function to initialize the cache
async function initializeCache(client) {
    if (fs.existsSync(CACHE_FILE_PATH)) {
        console.log('Cache file already exists. Skipping initial cache build.');
        return;
    }
    console.log('Cache file does not exist. Building cache...');
    await buildImageCache(client);
}

// Function to build the image cache
async function buildImageCache(client) {
    if (isBuildingCache) {
        console.log('Cache build is already in progress.');
        return 0;
    }
    isBuildingCache = true;

    console.log("Stage 1: Initializing cache build and fetching messages...");
    const deletedImages = loadDeletedImages();
    const deletedIds = loadDeletedIds();
    console.log("Deleted IDs loaded:", deletedIds); // Debug: Log deleted IDs

    const config = require('./config'); // Dynamically load config
    const maxImages = config.imageGrabber.maxImages;
    const channel = await client.channels.fetch(config.TARGET_CHANNEL_ID);
    if (!channel) {
        console.error('Target channel not found!');
        isBuildingCache = false;
        return 0;
    }

    let totalFetchedImages = 0;
    let lastMessageId;
    let newCache = [];

    try {
        // Fetch messages in a loop until the maxImages limit is reached or no more messages are found
        while (true) {
            const options = { limit: 100 };
            if (lastMessageId) {
                options.before = lastMessageId;
            }

            const messages = await channel.messages.fetch(options);
            if (messages.size === 0 || (maxImages > 0 && totalFetchedImages >= maxImages)) {
                break; // No more messages to fetch or maxImages limit reached
            }

            for (const msg of messages.values()) {
                // Check for attachments in the message and add all of them
                for (const attachment of msg.attachments.values()) {
                    const imageUrl = attachment.url;
                    if (await verifyUrl(imageUrl) && !deletedImages.includes(imageUrl)) {
                        newCache.push(imageUrl);
                        totalFetchedImages++;
                        if (maxImages > 0 && totalFetchedImages >= maxImages) {
                            break; // Exit if the maxImages limit is reached
                        }
                    }
                }

                // Extract additional image URLs from Pixiv, Twitter, or FXTwitter
                const extraImageUrl = extractPixivImageUrl(msg) || extractTwitterImageUrl(msg) || extractFxTwitterLink(msg);
                if (extraImageUrl && await verifyUrl(extraImageUrl) && !deletedImages.includes(extraImageUrl)) {
                    newCache.push(extraImageUrl);
                    totalFetchedImages++;
                    if (maxImages > 0 && totalFetchedImages >= maxImages) {
                        break; // Exit if the maxImages limit is reached
                    }
                }
            }

            // Update the last message ID to continue fetching older messages
            lastMessageId = messages.last()?.id;
        }

        console.log("Stage 2: Filtering out deleted URLs...");
        newCache = newCache.filter(url => !deletedImages.includes(url));

        console.log("Stage 3: Renumbering IDs in order...");
        // Renumber the remaining images to ensure IDs are sequential
        let imageCache = newCache.map((url, index) => ({ id: index + 1, url }));

        console.log("Stage 4: Removing images with deleted IDs...");
        const originalCacheLength = imageCache.length;
        imageCache = imageCache.filter(image => !deletedIds.includes(image.id));
        console.log(`Removed ${originalCacheLength - imageCache.length} images based on deleted IDs.`);

        console.log("Stage 5: Renumbering IDs again...");
        imageCache = imageCache.map((image, index) => ({ id: index + 1, url: image.url }));

        console.log("Stage 6: Saving updated image cache...");
        saveImageCache(imageCache);

        console.log("Stage 7: Clearing deleted IDs...");
        saveDeletedIds([]);
        console.log("Deleted IDs cleared.");

        console.log(`Finished building the cache with a total of ${imageCache.length} images.`);
        return imageCache.length;
    } catch (error) {
        console.error('Error fetching messages for cache build:', error);
        return totalFetchedImages;
    } finally {
        isBuildingCache = false;
    }
}




// Export the functions for use
module.exports = {
    buildImageCache,
    initializeCache,
    loadImageCache,
    loadDeletedIds,
    saveDeletedIds,
    saveDeletedImages
};
