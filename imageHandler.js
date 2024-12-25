const fs = require('fs');
const path = require('path');

const CACHE_FILE_PATH = path.join(__dirname, 'storage', 'image_cache.json');
const DELETED_IMAGES_FILE_PATH = path.join(__dirname, 'storage', 'deleted_images.json');
const DELETED_IDS_FILE_PATH = path.join(__dirname, 'storage', 'deleted_ids.json');
const TWITTER_FILES_PATH = 'H:\\Twi'; // Path to the directory for !nevotwitter

// Load image cache from file
function loadImageCache() {
    if (fs.existsSync(CACHE_FILE_PATH)) {
        return JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf-8'));
    } else {
        console.log('Cache file does not exist. Starting with an empty cache.');
        return [];
    }
}

// Helper function to list files in a directory
function getTwitterFiles() {
    const twitterDir = 'H:\\Twi'; // Replace with your actual directory
    try {
        if (!fs.existsSync(twitterDir)) {
            console.error('Twitter directory does not exist:', twitterDir);
            return [];
        }

        const files = fs.readdirSync(twitterDir).filter(file => !fs.lstatSync(path.join(twitterDir, file)).isDirectory());
        //console.log('Twitter files found:', files);
        return files;
    } catch (error) {
        console.error('Error reading twitter files:', error);
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

// Save deleted images to file
function saveDeletedImages(deletedImages) {
    fs.writeFileSync(DELETED_IMAGES_FILE_PATH, JSON.stringify(deletedImages, null, 2));
}

// Save deleted IDs to file
function saveDeletedIds(deletedIds) {
    fs.writeFileSync(DELETED_IDS_FILE_PATH, JSON.stringify(deletedIds, null, 2));
}

// Handle all text-based and slash commands
function handleMessage(message, userMessage, skipSend = false) {
    const imageCache = loadImageCache();
    const deletedImages = loadDeletedImages();
    const deletedIds = loadDeletedIds();

    if (userMessage === '!nevotwitter') {
        const twitterFiles = getTwitterFiles();

        if (twitterFiles.length === 0) {
            const noFilesMessage = 'No files available in the Twitter directory.';
            return skipSend ? noFilesMessage : message.channel.send(noFilesMessage);
        }

        // Pick a random file
        const randomFile = twitterFiles[Math.floor(Math.random() * twitterFiles.length)];
        const fileUrl = `https://nevostuff.com/nevotwitter/${randomFile}`;

        return skipSend ? fileUrl : message.channel.send(fileUrl);
    } else if (userMessage === '!nevoboy') {
        if (imageCache.length === 0) {
            const noImagesMessage = 'No images available in the cache.';
            return skipSend ? noImagesMessage : message.channel.send(noImagesMessage);
        }

        // Filter out images with deleted IDs
        const availableImages = imageCache.filter(image => !deletedIds.includes(image.id));
        if (availableImages.length === 0) {
            const noAvailableImagesMessage = 'No images available in the cache.';
            return skipSend ? noAvailableImagesMessage : message.channel.send(noAvailableImagesMessage);
        }

        // Send a random image
        const randomIndex = Math.floor(Math.random() * availableImages.length);
        const randomImage = availableImages[randomIndex];
        const resultMessage = `ID: ${randomImage.id}\n${randomImage.url}`;
        return skipSend ? resultMessage : message.channel.send(resultMessage);
    } else if (userMessage.startsWith('!nevoboy ')) {
        const parts = userMessage.split(' ');
        if (parts.length === 2 && !isNaN(parts[1])) {
            const id = parseInt(parts[1], 10);

            if (deletedIds.includes(id)) {
                const deletedMessage = 'This image has been marked for deletion and is no longer available.';
                return skipSend ? deletedMessage : message.channel.send(deletedMessage);
            }
            if (id < 1 || id > imageCache.length) {
                const invalidIdMessage = 'Invalid ID. Please provide a valid image ID.';
                return skipSend ? invalidIdMessage : message.channel.send(invalidIdMessage);
            }

            const image = imageCache.find(img => img.id === id);
            if (image) {
                const imageMessage = `ID: ${id}\n${image.url}`;
                return skipSend ? imageMessage : message.channel.send(imageMessage);
            } else {
                const invalidIdMessage = 'Invalid ID. Please provide a valid image ID.';
                return skipSend ? invalidIdMessage : message.channel.send(invalidIdMessage);
            }
        } else {
            const invalidCommandMessage = 'Invalid command. Use !nevoboy or !nevoboy <ID>.';
            return skipSend ? invalidCommandMessage : message.channel.send(invalidCommandMessage);
        }
    } else if (userMessage.startsWith('!nevoboydelete ')) {
        const parts = userMessage.split(' ');
        if (parts.length === 2 && !isNaN(parts[1])) {
            const id = parseInt(parts[1], 10);
            if (id < 1 || id > imageCache.length) {
                const invalidIdMessage = 'Invalid ID. Please provide a valid image ID.';
                return skipSend ? invalidIdMessage : message.channel.send(invalidIdMessage);
            }

            const image = imageCache.find(img => img.id === id);
            if (image) {
                if (!deletedImages.includes(image.url)) {
                    deletedImages.push(image.url);
                    saveDeletedImages(deletedImages);
                }
                if (!deletedIds.includes(id)) {
                    deletedIds.push(id);
                    saveDeletedIds(deletedIds);
                }

                // Remove the image from the cache
                const updatedCache = imageCache.filter(img => img.id !== id);
                fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(updatedCache, null, 2));

                const deleteMessage = `Image with ID ${id} has been marked for deletion and will not appear in future cache builds.`;
                return skipSend ? deleteMessage : message.channel.send(deleteMessage);
            } else {
                const invalidIdMessage = 'Invalid ID. Please provide a valid image ID.';
                return skipSend ? invalidIdMessage : message.channel.send(invalidIdMessage);
            }
        } else {
            const invalidCommandMessage = 'Invalid command. Use !nevoboydelete <ID>.';
            return skipSend ? invalidCommandMessage : message.channel.send(invalidCommandMessage);
        }
    }
}


// Slash command handler
async function handleInteraction(interaction) {
    const imageCache = loadImageCache();
    const deletedImages = loadDeletedImages();
    const deletedIds = loadDeletedIds();

    const { commandName, options } = interaction;

    if (commandName === 'nevotwitter') {
        const twitterFiles = getTwitterFiles();

        if (twitterFiles.length === 0) {
            return interaction.reply('No files available in the Twitter directory.');
        }

        const randomFile = twitterFiles[Math.floor(Math.random() * twitterFiles.length)];
        const fileUrl = `https://nevostuff.com/nevotwitter/${randomFile}`;

        await interaction.reply(fileUrl);
    } else if (commandName === 'nevoboy') {
        if (imageCache.length === 0) {
            return interaction.reply('No images available in the cache.');
        }

        const availableImages = imageCache.filter(image => !deletedIds.includes(image.id));
        if (availableImages.length === 0) {
            return interaction.reply('No images available in the cache.');
        }

        const randomImage = availableImages[Math.floor(Math.random() * availableImages.length)];
        await interaction.reply(`ID: ${randomImage.id}\n${randomImage.url}`);
    } else if (commandName === 'nevoboydelete') {
        const id = options.getInteger('id');

        if (id < 1 || id > imageCache.length) {
            return interaction.reply('Invalid ID. Please provide a valid image ID.');
        }

        const image = imageCache.find(img => img.id === id);
        if (!image) {
            return interaction.reply('Invalid ID. Please provide a valid image ID.');
        }

        if (!deletedImages.includes(image.url)) {
            deletedImages.push(image.url);
            saveDeletedImages(deletedImages);
        }
        if (!deletedIds.includes(id)) {
            deletedIds.push(id);
            saveDeletedIds(deletedIds);
        }

        const updatedCache = imageCache.filter(img => img.id !== id);
        fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(updatedCache, null, 2));

        await interaction.reply(`Image with ID ${id} has been marked for deletion.`);
    }
}

module.exports = {
    handleMessage,
    handleInteraction,
};
