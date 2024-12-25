const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [
    {
        name: 'nevotwitter',
        description: 'Get a random file from the Twitter directory.',
    },
    {
        name: 'nevoboy',
        description: 'Get a random image from the cache.',
        options: [
            {
                name: 'id',
                type: 4, // INTEGER type
                description: 'The ID of the image to retrieve.',
                required: false, // Optional parameter
            },
        ],
    },
    {
        name: 'nevoboydelete',
        description: 'Mark an image for deletion.',
        options: [
            {
                name: 'id',
                type: 4, // INTEGER type
                description: 'The ID of the image to delete.',
                required: true, // Required parameter
            },
        ],
    },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
const clientId = process.env.CLIENT_ID; // Ensure your .env file has this defined

// Wrap everything in an async function
async function registerCommands() {
    try {
        console.log('Refreshing slash commands...');
        await rest.put(
            Routes.applicationCommands(clientId), // Uses your bot's application ID
            { body: commands }
        );
        console.log('Slash commands registered!');
    } catch (error) {
        console.error('Failed to register slash commands:', error);
    }
}

// Call the function to execute the logic
registerCommands();
