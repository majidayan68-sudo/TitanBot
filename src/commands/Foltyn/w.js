import { SlashCommandBuilder, MessageFlags } from 'discord.js';
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
const MIDDLEMAN_ROLE_ID = '1559962361522032802';
export default {
 data: new SlashCommandBuilder().setName('w').setDescription('View a member’s server information.').addUserOption(o=>o.setName('user').setDescription('Member to inspect').setRequired(false)).setDefaultMemberPermissions(null), category:'Foltyn',
 async execute(i){
    const access = await getVerifiedContext(i);
    if (!access) return i.reply({content:'Only Verified Member or higher can use this command.',flags:MessageFlags.Ephemeral});
  const requested=i.options.getUser('user')||i.user;
  const member=await i.guild.members.fetch(requested.id).catch(()=>null);
  if(!member)return i.reply({content:'That member is not in this server.',flags:MessageFlags.Ephemeral});
  const user=member.user;
  const roles=member.roles.cache.filter(r=>r.id!==i.guild.id).sort((a,b)=>b.position-a.position);
  const top=member.roles.highest; const created=Math.floor(user.createdTimestamp/1000); const joined=Math.floor((member.joinedTimestamp||Date.now())/1000);
  const mmRole=await i.guild.roles.fetch(MIDDLEMAN_ROLE_ID).catch(()=>null);
  const verified=top.comparePositionTo(access.role)>=0;
  const mm=!!mmRole&&top.comparePositionTo(mmRole)>=0;
  const permissions=member.permissions;
  const labels=[mm?'Middleman+':verified?'Verified Member+':'Member access'];
  const available=[];
  if(verified)available.push('afk [reason]','w [@user]','wp [@user]');
  if(verified)available.push('fill @user');
  if(mm)available.push('add @user','transfer @user','mminfo','mmfee','confirm');
  const embed=createEmbed({title:`${user.username} · Member Info`,description:`**Username:** ${user.tag}\n**User ID:** \`${user.id}\`\n**Account created:** <t:${created}:R>\n**Joined server:** <t:${joined}:R>\n**Top role:** ${roles.size?top:'@everyone'}\n**Role count:** ${roles.size}\n**Access:** ${labels.join(', ')}\n**Updated commands (/ or !):** ${available.join(', ')||'None'}\n\n**Roles**\n${roles.map(r=>r.toString()).join(', ')||'No additional roles'}`,color:'#D71920',thumbnail:'https://i.postimg.cc/CxSsGg0c/Server-Logo.png',image:'https://i.postimg.cc/59YXQW59/Server-Banner-GIF.gif'});
  embed.setThumbnail(user.displayAvatarURL({size:256}));
  return i.reply({embeds:[embed]});
 }
};
