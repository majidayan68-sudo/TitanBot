import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { db } from '../../utils/database/wrapper.js';
import { createEmbed } from '../../utils/embeds.js';
const VERIFIED_MEMBER_ROLE_ID = '1559962688170500126';

async function getVerifiedContext(i) {
  if (!i.guild || !i.guildId || !i.user?.id) return null;
  const [member, role] = await Promise.all([
    i.guild.members.fetch(i.user.id).catch(() => null),
    i.guild.roles.fetch(VERIFIED_MEMBER_ROLE_ID).catch(() => null)
  ]);
  if (!member || !role || member.roles.highest.comparePositionTo(role) < 0) return null;
  return { member, role };
}
export default {
 data:new SlashCommandBuilder().setName('wp').setDescription('View the latest five mentions received by a member.').addUserOption(o=>o.setName('user').setDescription('Member to check').setRequired(false)).setDefaultMemberPermissions(null),category:'Foltyn',
 async execute(i){
    const access = await getVerifiedContext(i);
    if (!access) return i.reply({content:'Only Verified Member or higher can use this command.',flags:MessageFlags.Ephemeral});
  const requested=i.options.getUser('user')||i.user;
  const member=await i.guild.members.fetch(requested.id).catch(()=>null);
  if(!member)return i.reply({content:'That member is not in this server.',flags:MessageFlags.Ephemeral});
  const u=member.user; const list=await db.get(`guild:${i.guildId}:foltyn:pings:${u.id}`,[]);
  // Only display mentions from channels visible to both the caller and this reply channel's audience.
  // Private channels are excluded from public replies, including prefix replies.
  const visible=[];
  for(const ping of list){
    const match=String(ping.url||'').match(/^https:\/\/(?:www\.)?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)$/);
    if(!match||match[1]!==i.guildId)continue;
    const channel=await i.guild.channels.fetch(match[2]).catch(()=>null);
    if(!channel||channel.isThread?.()||!channel.permissionsFor?.(access.member)?.has('ViewChannel')||!channel.permissionsFor?.(access.member)?.has('ReadMessageHistory'))continue;
    if(channel.id!==i.channel?.id && (!channel.permissionsFor(i.guild.roles.everyone)?.has('ViewChannel')||!channel.permissionsFor(i.guild.roles.everyone)?.has('ReadMessageHistory')))continue;
    visible.push(ping);
    if(visible.length===5)break;
  }
  const lines=visible.map(p=>`• <@${p.by}> · <t:${Math.floor(new Date(p.at).getTime()/1000)}:R> · [Jump to message](${p.url})`);
  return i.reply({embeds:[createEmbed({title:'who pinged you',description:`${u}, your last 5 visible pings:\n\n${lines.join('\n')||'No visible pings have been recorded yet.'}`,color:'#D71920',thumbnail:'https://i.postimg.cc/CxSsGg0c/Server-Logo.png',image:'https://i.postimg.cc/59YXQW59/Server-Banner-GIF.gif'})]});
 }
};
