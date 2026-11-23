
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Collection } from 'discord.js';
import { logger } from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_COMMANDS = 100;
const FOLTYN_GUILD_ID = '1559960356263039026';

const PRIORITY_COMMANDS = new Set([
    'ticket',
    'promote',
    'demote',
    'fill',
    'hit',
    'add',
    'afk',
    'confirm',
    'mmfee',
    'mminfo',
    'setvouches',
    'transfer',
    'unclaim',
    'vouch',
    'vouches',
    'w',
    'wp'
]);

function getSubcommandInfo(commandData) {
    const subcommands = [];

    for (const option of commandData.options || []) {
        if (option.type === 1) {
            subcommands.push(option.name);
        } else if (option.type === 2) {
            for (const subOption of option.options || []) {
                if (subOption.type === 1) {
                    subcommands.push(
                        `${option.name}/${subOption.name}`
                    );
                }
            }
        }
    }

    return subcommands;
}

async function getAllFiles(directory, fileList = []) {
    const files = await fs.readdir(directory, {
        withFileTypes: true
    });

    for (const file of files) {
        const filePath = path.join(directory, file.name);

        if (file.isDirectory()) {
            if (file.name === 'modules') continue;

            await getAllFiles(filePath, fileList);
        } else if (file.name.endsWith('.js')) {
            fileList.push(filePath);
        }
    }

    return fileList;
}

export async function loadCommands(client) {
    client.commands = new Collection();

    const commandsPath = path.join(
        __dirname,
        '../../commands'
    );

    const commandFiles = await getAllFiles(commandsPath);

    logger.info(
        `Found ${commandFiles.length} command files`
    );

    for (const filePath of commandFiles) {
        try {
            const commandModule = await import(
                pathToFileURL(filePath).href
            );

            const command =
                commandModule.default || commandModule;

            if (
                !command.data ||
                !command.execute ||
                typeof command.data.toJSON !== 'function'
            ) {
                logger.warn(
                    `Invalid command file: ${filePath}`
                );
                continue;
            }

            command.category = path.basename(
                path.dirname(filePath)
            );

            command.filePath = filePath.replace(/\\/g, '/');

            const commandName = command.data.name;

            if (client.commands.has(commandName)) {
                logger.warn(
                    `Duplicate command skipped: ${commandName}`
                );
                continue;
            }

            client.commands.set(commandName, command);

            const subcommands = getSubcommandInfo(
                command.data.toJSON()
            );

            logger.info(`Loaded command: /${commandName}`);

            if (subcommands.length > 0) {
                logger.info(
                    `Subcommands: ${subcommands.join(', ')}`
                );
            }

        } catch (error) {
            logger.error(
                `Error loading command from ${filePath}:`,
                error
            );
        }
    }

    const ticketCommand = client.commands.get('ticket');

    if (ticketCommand) {
        const subcommands = getSubcommandInfo(
            ticketCommand.data.toJSON()
        );

        logger.info(
            `[TICKET CHECK] /ticket loaded with subcommands: ${subcommands.join(', ')}`
        );
    } else {
        logger.error(
            '[TICKET CHECK] /ticket failed to load!'
        );
    }

    logger.info(
        `Loaded ${client.commands.size} commands`
    );

    return client.commands;
}

function collectCommandPayloads(client) {
    const commands = [];
    const registeredNames = new Set();

    for (const command of client.commands.values()) {
        if (
            !command.data ||
            typeof command.data.toJSON !== 'function'
        ) {
            continue;
        }

        const name = command.data.name;

        if (registeredNames.has(name)) continue;

        registeredNames.add(name);
        commands.push(command.data.toJSON());
    }

    return commands;
}

export async function registerCommands(
    client,
    options = {}
) {
    const { clientId = null } = options;

    try {
        if (!clientId) {
            throw new Error('CLIENT_ID is required');
        }

        if (!client.rest) {
            throw new Error(
                'Discord REST client is unavailable'
            );
        }

        const commands = collectCommandPayloads(client);

        const guildCommandNames = new Set(
            PRIORITY_COMMANDS
        );

        for (const command of client.commands.values()) {
            if (
                command.category?.toLowerCase() === 'foltyn'
            ) {
                guildCommandNames.add(command.data.name);
            }
        }

        const globalCandidates = commands.filter(
            command => !guildCommandNames.has(command.name)
        );

        const globalCommands = globalCandidates.slice(
            0,
            MAX_COMMANDS
        );

        const overflowCommands = globalCandidates.slice(
            MAX_COMMANDS
        );

        const guildCommands = commands.filter(
            command => guildCommandNames.has(command.name)
        ).concat(overflowCommands);

        if (guildCommands.length > MAX_COMMANDS) {
            throw new Error(
                `Guild command limit exceeded: ${guildCommands.length}`
            );
        }

        const ticketPayload = guildCommands.find(
            command => command.name === 'ticket'
        );

        if (ticketPayload) {
            const subcommands = getSubcommandInfo(
                ticketPayload
            );

            logger.info(
                `[TICKET CHECK] Registering /ticket directly in Foltyn guild`
            );

            logger.info(
                `[TICKET CHECK] Subcommands: ${subcommands.join(', ')}`
            );

            if (!subcommands.includes('setup')) {
                logger.warn(
                    '[TICKET CHECK] Missing setup subcommand!'
                );
            }

            if (!subcommands.includes('dashboard')) {
                logger.warn(
                    '[TICKET CHECK] Missing dashboard subcommand!'
                );
            }
        } else {
            logger.error(
                '[TICKET CHECK] Ticket command missing from registration payload!'
            );
        }

        logger.info(
            `Registering ${globalCommands.length} global commands`
        );

        await client.rest.put(
            `/applications/${clientId}/commands`,
            { body: globalCommands }
        );

        logger.info(
            `Registering ${guildCommands.length} Foltyn guild commands`
        );

        const registeredGuildCommands = await client.rest.put(
            `/applications/${clientId}/guilds/${FOLTYN_GUILD_ID}/commands`,
            { body: guildCommands }
        );

        const registeredTicket = Array.isArray(
            registeredGuildCommands
        )
            ? registeredGuildCommands.find(
                command => command.name === 'ticket'
            )
            : null;

        if (registeredTicket) {
            logger.info(
                '[TICKET CHECK] Discord successfully registered /ticket!'
            );

            logger.info(
                `[TICKET CHECK] Registered subcommands: ${getSubcommandInfo(registeredTicket).join(', ')}`
            );
        } else {
            logger.warn(
                '[TICKET CHECK] Discord did not return /ticket in guild registration response'
            );
        }

        logger.info(
            'Global and Foltyn guild commands registered successfully'
        );

    } catch (error) {
        logger.error(
            'Error registering commands:',
            error
        );

        throw error;
    }
}

export async function reloadCommand(
    client,
    commandName
) {
    const command = client.commands.get(commandName);

    if (!command) {
        return {
            success: false,
            message: `Command "${commandName}" not found`
        };
    }

    try {
        const commandPath = path.resolve(command.filePath);
        const moduleUrl = pathToFileURL(commandPath);

        moduleUrl.searchParams.set(
            't',
            Date.now().toString()
        );

        const commandModule = await import(moduleUrl.href);

        const newCommand =
            commandModule.default || commandModule;

        newCommand.category = command.category;
        newCommand.filePath = command.filePath;

        client.commands.set(commandName, newCommand);

        logger.info(
            `Reloaded command: ${commandName}`
        );

        return {
            success: true,
            message: `Successfully reloaded command "${commandName}"`
        };

    } catch (error) {
        logger.error(
            `Error reloading command "${commandName}":`,
            error
        );

        return {
            success: false,
            message: `Error reloading command: ${error.message}`
        };
    }
}
