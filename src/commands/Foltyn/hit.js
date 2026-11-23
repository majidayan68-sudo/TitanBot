import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';

const VERIFIED_TRADER_ROLE_ID = 'PASTE_VERIFIED_TRADER_ROLE_ID_HERE';

// Paste your private verification message between the backticks below.
const HIT_MESSAGE = `PASTE YOUR VERIFICATION MESSAGE HERE`;

export default {
  data: new SlashCommandBuilder()
    .setName('hit')
    .setDescription('Send a Verified Trader approval message.')
    .addUserOption(option => option.setName('user').setDescription('Person being verified').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  category: 'Foltyn',
  async execute(interaction) {
    const user = interaction.options.getUser('user');
    if (user.bot) return interaction.reply({ content: 'Bots cannot become Verified Traders.', flags: MessageFlags.Ephemeral });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`foltyn_hit_accept:${user.id}`).setLabel('Accept').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`foltyn_hit_reject:${user.id}`).setLabel('Reject').setStyle(ButtonStyle.Danger),
    );
    return interaction.reply({ content: `${user}`, embeds: [{ description: HIT_MESSAGE, color: 0xD71920, thumbnail: { url: 'https://i.postimg.cc/CxSsGg0c/Server-Logo.png' }, image: { url: 'https://i.postimg.cc/59YXQW59/Server-Banner-GIF.gif' } }], components: [row] });
  },
};
