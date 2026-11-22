import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { db } from '../../utils/database/wrapper.js';
import { createEmbed } from '../../utils/embeds.js';
export default {data:new SlashCommandBuilder().setName('vouches').setDescription('View a member’s vouches.').addUserOption(o=>o.setName('user').setDescription('Member to check').setRequired(false)),category:'Foltyn',
 async execute(i){const u=i.options.getUser('user')||i.user;const d=await db.get(`guild:${i.guildId}:foltyn:vouches:${u.id}`,{count:0,vouchers:[]});const recent=d.vouchers.slice(0,5).map(v=>`• <@${v.id}> · <t:${Math.floor(new Date(v.at).getTime()/1000)}:R>`).join('\n')||'No vouches yet.';return i.reply({embeds:[createEmbed({title:`vouches for ${u.username}`,description:`${u} has **${d.count}** vouches\n\n**recent vouchers**\n${recent}`,color:'#D71920'})]});}
};
