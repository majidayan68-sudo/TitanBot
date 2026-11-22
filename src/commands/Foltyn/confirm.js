import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { getTicketData } from '../../utils/database/tickets.js';
export default {
 data:new SlashCommandBuilder().setName('confirm').setDescription('Post the trade confirmation button.'),category:'Foltyn',
 async execute(interaction){const t=await getTicketData(interaction.guildId,interaction.channel.id);if(!t)return interaction.reply({content:'Use this command inside a ticket.',ephemeral:true});
 const embed=createEmbed({title:'✅ Trade Confirmation',description:'Both parties must confirm the trade by clicking the button below.\n\nThis confirms that:\n- You are happy with your trade\n- The middleman can continue with your request',color:'#D71920'});
 const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('foltyn_trade_confirm').setLabel('Confirm Trade').setStyle(ButtonStyle.Danger));return interaction.reply({embeds:[embed],components:[row]});}
};
