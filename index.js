require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config');
const imageHandler = require('./imageHandler');
const imageGrabber = require('./imageGrabber');
const rules = require('./rules'); // Import the rules module

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // Check if the image module is enabled in the config
    if (config.enableImageHandling) {
        await imageGrabber.initializeCache(client); // Pass the client to imageGrabber
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const userMessage = message.content.trim().toLowerCase();

    // Check for rule command if the rules handling is enabled
    if (config.enableRulesHandling && userMessage.startsWith('rule ')) {
        const ruleId = userMessage.split(' ')[1];
        const ruleMessage = rules.getRuleById(ruleId);

        // If the rule is a URL, Discord will automatically embed it
        message.channel.send(ruleMessage);
    }

    // Handle !nevobuildcache and other image-related commands
    if (config.enableImageHandling) {
        if (userMessage === '!nevobuildcache') {
            await message.channel.send('Starting to build the image cache...');
            const totalImagesLoaded = await imageGrabber.buildImageCache(client); // Pass the client to buildImageCache
            await message.channel.send(`Cache building complete. Loaded ${totalImagesLoaded} images into the cache.`);
        } else if (/^w+a+h*$/i.test(userMessage)) { // Regex to match any variation of "wah"
            message.channel.send("https://cdn.discordapp.com/attachments/1069014008427978762/1296913347966406750/image.png?ex=6731aded&is=67305c6d&hm=9c7fd4d8b77cea4d9b59e315ff9469939f52f7e19db1feec04f5dcab5d2da4fc&");
        } else {
            imageHandler.handleMessage(message, userMessage);
        }
    }
});

client.login(process.env.BOT_TOKEN);
