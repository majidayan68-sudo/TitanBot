import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
export default {
 data:new SlashCommandBuilder().setName('fill').setDescription('Fill missing eligible roles between a member’s highest and lowest roles.').addUserOption(o=>o.setName('user').setDescription('Member to fill').setRequired(false)),category:'Foltyn',
 async execute(i){
  if(!i.memberPermissions?.has(PermissionFlagsBits.ManageRoles))return i.reply({content:'You need Manage Roles to use this command.',flags:MessageFlags.Ephemeral});
  const targetUser=i.options.getUser('user')||i.user; const target=await i.guild.members.fetch(targetUser.id).catch(()=>null); if(!target)return i.reply({content:'That member is not in this server.',flags:MessageFlags.Ephemeral}); const bot=i.guild.members.me;
  if(target.roles.highest.position>=i.member.roles.highest.position&&!i.memberPermissions?.has(PermissionFlagsBits.Administrator))return i.reply({content:'You cannot fill roles for a member whose highest role is equal to or above yours.',flags:MessageFlags.Ephemeral});
  const assigned=target.roles.cache.filter(r=>r.id!==i.guild.id); const lowest=assigned.reduce((min,r)=>Math.min(min,r.position),Infinity); const highest=target.roles.highest.position; const roles=i.guild.roles.cache.filter(r=>r.id!==i.guild.id&&!r.managed&&r.permissions.bitfield===0n&&!r.tags?.botId&&r.position>lowest&&r.position<highest&&r.position<bot.roles.highest.position);
  const missing=roles.filter(r=>!target.roles.cache.has(r.id));
  if(!missing.size)return i.reply({embeds:[createEmbed({title:'Role Fill',description:`❌ No roles to fill — ${target} already has all eligible roles between their highest and lowest.`,color:'#D71920',thumbnail:'https://i.postimg.cc/CxSsGg0c/Server-Logo.png',image:'https://i.postimg.cc/59YXQW59/Server-Banner-GIF.gif'})]});
  await target.roles.add(missing,'Foltyn role fill command');
  return i.reply({embeds:[createEmbed({title:`Roles filled for ${target.user.username}`,description:`**Added:** ${missing.map(r=>r.name).join(', ')}\n**Between:** ${target.roles.highest} → ${assigned.sort((a,b)=>a.position-b.position).first()||'@everyone'}`,color:'#D71920',thumbnail:'https://i.postimg.cc/CxSsGg0c/Server-Logo.png',image:'https://i.postimg.cc/59YXQW59/Server-Banner-GIF.gif'})]});
 }
};
