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
 data:new SlashCommandBuilder().setName('confirm').setDefaultMemberPermissions(null).setDescription('Post the trade confirmation button.'),category:'Foltyn',
 async execute(interaction){
    if (!await hasMiddlemanAccess(interaction)) {
      return interaction.reply({ content: 'Only Middleman and higher roles can use this command.', flags: MessageFlags.Ephemeral });
    }
    const t=await getTicketData(interaction.guildId,interaction.channel.id);if(!t)return interaction.reply({content:'Use this command inside a ticket.',flags:MessageFlags.Ephemeral});
 const embed=createEmbed({title:'✅ Trade Confirmation',description:'Both parties must confirm the trade by clicking the button below.\n\nThis confirms that:\n- You are happy with your trade\n- The middleman can continue with your request',color:'#D71920',thumbnail:'https://i.postimg.cc/CxSsGg0c/Server-Logo.png',image:'https://i.postimg.cc/59YXQW59/Server-Banner-GIF.gif'});
 const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('foltyn_trade_confirm').setLabel('Confirm Trade').setStyle(ButtonStyle.Danger));return interaction.reply({embeds:[embed],components:[row]});}
};
