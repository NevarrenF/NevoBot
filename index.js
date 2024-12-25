require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config');
const imageHandler = require('./imageHandler'); // Assuming this contains handleMessage and related logic
const imageGrabber = require('./imageGrabber');
const rules = require('./rules'); // Import the rules module

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    if (config.enableImageHandling) {
        await imageGrabber.initializeCache(client);
    }
});

// Handle text-based commands (e.g., !nevoboy)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const userMessage = message.content.trim().toLowerCase();

    if (config.enableRulesHandling && userMessage.startsWith('rule ')) {
        const ruleId = userMessage.split(' ')[1];
        const ruleMessage = rules.getRuleById(ruleId);
        message.channel.send(ruleMessage);
    } else if (config.enableImageHandling) {
        if (userMessage === '!nevobuildcache') {
            await message.channel.send('Starting to build the image cache...');
            const totalImagesLoaded = await imageGrabber.buildImageCache(client);
            await message.channel.send(`Cache building complete. Loaded ${totalImagesLoaded} images into the cache.`);
        } else if (/^w+a+h*$/i.test(userMessage)) {
            const urls = [
                "https://www.nevostuff.com/uploads/2024/December/waah.png",
                "https://www.nevostuff.com/uploads/2024/December/taiyosob.jpg",
            ];
            const randomUrl = urls[Math.floor(Math.random() * urls.length)];
            message.channel.send(randomUrl);
        } else {
            imageHandler.handleMessage(message, userMessage); // Calls the existing logic for text commands
        }
    }
});

// Handle slash commands (e.g., /nevoboy)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    try {
        //console.log(`Received command: ${commandName}`);
        await interaction.deferReply();

        if (commandName === 'nevoboy' || commandName === 'nevotwitter' || commandName === 'nevoboydelete') {
            const id = interaction.options.getInteger('id'); // Get the id, if provided
            const mockMessage = {
                author: interaction.user,
                channel: interaction.channel,
                content: `!${commandName}${id ? ' ' + id : ''}`, // Include the id only if it exists
            };

            //console.log('Passing to handleMessage:', mockMessage);

            // Call handleMessage with skipSend: true
            const result = await imageHandler.handleMessage(mockMessage, mockMessage.content, true);

           // console.log('handleMessage result:', result);

            if (result) {
                await interaction.editReply(result);
            } else {
                await interaction.deleteReply();
            }
        } else {
            await interaction.editReply('Unknown command.');
        }
    } catch (error) {
       // console.error('Error processing interaction:', error);
        await interaction.editReply('An error occurred while processing your request.');
    }
});






client.login(process.env.BOT_TOKEN);
