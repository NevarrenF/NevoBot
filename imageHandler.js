const fs = require('fs');
const path = require('path');

const CACHE_FILE_PATH = path.join(__dirname, 'storage', 'image_cache.json');
const DELETED_IMAGES_FILE_PATH = path.join(__dirname, 'storage', 'deleted_images.json');
const DELETED_IDS_FILE_PATH = path.join(__dirname, 'storage', 'deleted_ids.json');

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

// Save deleted images to file
function saveDeletedImages(deletedImages) {
    fs.writeFileSync(DELETED_IMAGES_FILE_PATH, JSON.stringify(deletedImages, null, 2));
}

// Save deleted IDs to file
function saveDeletedIds(deletedIds) {
    fs.writeFileSync(DELETED_IDS_FILE_PATH, JSON.stringify(deletedIds, null, 2));
}

// Handle !nevoboy and related commands
function handleMessage(message, userMessage) {
    const imageCache = loadImageCache();
    const deletedImages = loadDeletedImages();
    const deletedIds = loadDeletedIds();

    // Handle !nevoboy
    if (userMessage === '!nevoboy') {
        if (imageCache.length === 0) {
            return message.channel.send('No images available in the cache.');
        }

        // Filter out images with deleted IDs
        const availableImages = imageCache.filter(image => !deletedIds.includes(image.id));
        if (availableImages.length === 0) {
            return message.channel.send('No images available in the cache.');
        }

        // Send a random image
        const randomIndex = Math.floor(Math.random() * availableImages.length);
        const randomImage = availableImages[randomIndex];
        message.channel.send(`ID: ${randomImage.id}\n${randomImage.url}`);
    }
    // Handle !nevoboy <ID>
    else if (userMessage.startsWith('!nevoboy ')) {
        const parts = userMessage.split(' ');
        if (parts.length === 2 && !isNaN(parts[1])) {
            const id = parseInt(parts[1], 10);

            if (deletedIds.includes(id)) {
                return message.channel.send('This image has been marked for deletion and is no longer available.');
            }
            if (id < 1 || id > imageCache.length) {
                return message.channel.send('Invalid ID. Please provide a valid image ID.');
            }

            const image = imageCache.find(img => img.id === id);
            if (image) {
                message.channel.send(`ID: ${id}\n${image.url}`);
            } else {
                message.channel.send('Invalid ID. Please provide a valid image ID.');
            }
        } else {
            message.channel.send('Invalid command. Use !nevoboy or !nevoboy <ID>.');
        }
    }
    // Handle !nevoboydelete <ID>
    else if (userMessage.startsWith('!nevoboydelete ')) {
        const parts = userMessage.split(' ');
        if (parts.length === 2 && !isNaN(parts[1])) {
            const id = parseInt(parts[1], 10);
            if (id < 1 || id > imageCache.length) {
                return message.channel.send('Invalid ID. Please provide a valid image ID.');
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

                message.channel.send(`Image with ID ${id} has been marked for deletion and will not appear in future cache builds.`);
            } else {
                message.channel.send('Invalid ID. Please provide a valid image ID.');
            }
        } else {
            message.channel.send('Invalid command. Use !nevoboydelete <ID>.');
        }
    }
}

module.exports = {
    handleMessage
};
