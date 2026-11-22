import { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { getTicketPermissionContext } from '../../utils/ticket/ticketPermissions.js';
export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName("close")
        .setDescription("Closes the current ticket.")
        .setDMPermission(false)
        .addStringOption((option) =>
            option
                .setName("reason")
                .setDescription("The reason for closing the ticket.")
                .setRequired(false),
        ),

    async execute(interaction, guildConfig, client) {
        const permissionContext = await getTicketPermissionContext({ client, interaction });
        if (!permissionContext.ticketData) {
            return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'This command can only be used in a valid ticket channel.' });
        }
        if (!permissionContext.canCloseTicket) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'You need Manage Channels, the configured Ticket Staff Role, or be the ticket creator to close this ticket.' });
        }
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('foltyn_close_confirm').setLabel('Confirm Close').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('foltyn_close_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );
        return interaction.reply({
            embeds: [successEmbed('⚠️ Close Ticket?', 'Are you sure you want to close this ticket? A transcript will be generated.')],
            components: [row],
            flags: MessageFlags.Ephemeral
        });
    },
};
