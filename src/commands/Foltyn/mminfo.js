import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { getTicketData } from '../../utils/database/tickets.js';

export default {
  data: new SlashCommandBuilder().setName('mminfo').setDescription('Explains how the Foltyn middleman service works.'),
  category: 'Foltyn',
  async execute(interaction) {
    const ticket = interaction.guildId && interaction.channel ? await getTicketData(interaction.guildId, interaction.channel.id) : null;
    if (!ticket) return interaction.reply({ content: 'Use this command inside a ticket.', ephemeral: true });
    const embed = createEmbed({ title: '🛡️ Middleman Service', description: 'A Middleman (MM) is a trusted staff member.\n- MMs ensure safe trades between users.\n\n**How does Middleman work? Example Trade:** User A → User B\n\n**Process:**\n- Seller gives item to MM\n- Buyer pays seller (after MM confirms item)\n- MM gives item to buyer\n\nBoth traders must agree before opening a ticket. Specify the trade clearly. Troll tickets will result in punishment.', color: '#D71920' });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('foltyn_mminfo_ack').setLabel('I Understand').setStyle(ButtonStyle.Danger));
    return interaction.reply({ embeds: [embed], components: [row] });
  }
};
