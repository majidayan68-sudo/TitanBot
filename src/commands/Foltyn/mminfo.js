import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { getTicketData } from '../../utils/database/tickets.js';

const MIDDLEMAN_ROLE_ID = '1559962361522032802';

async function hasMiddlemanAccess(interaction) {
  if (!interaction.guild || !interaction.user?.id) return false;
  const [role, member] = await Promise.all([
    interaction.guild.roles.fetch(MIDDLEMAN_ROLE_ID).catch(() => null),
    interaction.guild.members.fetch({ user: interaction.user.id, force: true }).catch(() => null)
  ]);
  return Boolean(role && member && !member.user.bot &&
    member.roles.highest.comparePositionTo(role) >= 0);
}

export default {
  data: new SlashCommandBuilder().setName('mminfo').setDefaultMemberPermissions(null).setDescription('Explains how the Foltyn middleman service works.'),
  category: 'Foltyn',
  async execute(interaction) {
    if (!await hasMiddlemanAccess(interaction)) {
      return interaction.reply({ content: 'Only Middleman and higher roles can use this command.', flags: MessageFlags.Ephemeral });
    }
    
    const ticket = interaction.guildId && interaction.channel ? await getTicketData(interaction.guildId, interaction.channel.id) : null;
    if (!ticket) return interaction.reply({ content: 'Use this command inside a ticket.', flags: MessageFlags.Ephemeral });
    const embed = createEmbed({ title: '🛡️ Middleman Service', description: 'A Middleman (MM) is a trusted staff member.\n- MMs ensure safe trades between users.\n\n**How does Middleman work? Example Trade:** User A → User B\n\n**Process:**\n- Seller gives item to MM\n- Buyer pays seller (after MM confirms item)\n- MM gives item to buyer\n\nBoth traders must agree before opening a ticket. Specify the trade clearly. Troll tickets will result in punishment.', color: '#D71920', thumbnail: 'https://i.postimg.cc/CxSsGg0c/Server-Logo.png', image: 'https://i.postimg.cc/59YXQW59/Server-Banner-GIF.gif' });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('foltyn_mminfo_ack').setLabel('I Understand').setStyle(ButtonStyle.Danger));
    return interaction.reply({ embeds: [embed], components: [row] });
  }
};
