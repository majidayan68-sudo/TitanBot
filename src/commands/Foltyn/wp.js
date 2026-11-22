import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { db } from '../../utils/database/wrapper.js';
import { createEmbed } from '../../utils/embeds.js';
export default {
 data:new SlashCommandBuilder().setName('wp').setDescription('View the latest five mentions received by a member.').addUserOption(o=>o.setName('user').setDescription('Member to check').setRequired(false)),category:'Foltyn',
 async execute(i){
  const u=i.options.getUser('user')||i.user; const list=await db.get(`guild:${i.guildId}:foltyn:pings:${u.id}`,[]);
  const lines=list.slice(0,5).map(p=>`• <@${p.by}> · <t:${Math.floor(new Date(p.at).getTime()/1000)}:R> · [Jump to message](${p.url})`);
  return i.reply({embeds:[createEmbed({title:'who pinged you',description:`${u}, your last 5 pings:\n\n${lines.join('\n')||'No pings have been recorded yet.'}`,color:'#D71920'})]});
 }
};
