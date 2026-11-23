import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { getTicketData } from '../../utils/database/tickets.js';
export default {
 data: new SlashCommandBuilder().setName('mmfee').setDescription('Choose how the middleman fee will be covered.'), category:'Foltyn',
 async execute(interaction) {
  const t=await getTicketData(interaction.guildId,interaction.channel.id); if(!t) return interaction.reply({content:'Use this command inside a ticket.',ephemeral:true});
  const embed=createEmbed({title:'🔒 Middleman Service - Fee',description:'Please be patient while the Middleman calculates the service fee.\nBefore proceeding, agree on how the fee will be covered.\n\n**Split Payment (50/50)** - Both parties split the fee\n**Full Payment (100%)** - One party covers the entire fee\n\n⚠️ **Warning:** Once selected, this cannot be reversed.',color:'#D71920',thumbnail:'https://i.postimg.cc/CxSsGg0c/Server-Logo.png',image:'https://i.postimg.cc/59YXQW59/Server-Banner-GIF.gif'});
  const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('foltyn_fee_split').setLabel('Split (50/50)').setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId('foltyn_fee_full').setLabel('Full (100%)').setStyle(ButtonStyle.Secondary));
  return interaction.reply({embeds:[embed],components:[row]});
 }
};
