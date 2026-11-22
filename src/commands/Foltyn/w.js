import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
export default {
 data: new SlashCommandBuilder().setName('w').setDescription('View a member’s server information.').addUserOption(o=>o.setName('user').setDescription('Member to inspect').setRequired(false)), category:'Foltyn',
 async execute(i){
  const user=i.options.getUser('user')||i.user; const member=await i.guild.members.fetch(user.id).catch(()=>null);
  if(!member)return i.reply({content:'That member is not in this server.',flags:MessageFlags.Ephemeral});
  const roles=member.roles.cache.filter(r=>r.id!==i.guild.id).sort((a,b)=>b.position-a.position);
  const top=roles.first(); const created=Math.floor(user.createdTimestamp/1000); const joined=Math.floor((member.joinedTimestamp||Date.now())/1000);
  const perms=member.permissions; const access=[perms.has('ManageChannels')?'Ticket management':'Member access']; const available=['$mminfo','$mmfee','$confirm','$vouch @user','$vouches [@user]','$afk [reason]','$w [@user]','$wp [@user]']; if(perms.has('ManageChannels'))available.push('/add','/transfer','/close','/unclaim','$claim'); if(perms.has('ManageRoles'))available.push('$fill [@user]'); if(perms.has('ManageGuild'))available.push('$setvouches @user <amount>');
  const embed=createEmbed({title:`${user.username} · Member Info`,description:`**Username:** ${user.tag}\n**User ID:** \`${user.id}\`\n**Account created:** <t:${created}:R>\n**Joined server:** <t:${joined}:R>\n**Top role:** ${top||'@everyone'}\n**Role count:** ${roles.size}\n**Access:** ${access.join(', ')}\n**Available commands:** ${available.join(', ')}\n\n**Roles**\n${roles.map(r=>r.toString()).join(', ')||'No additional roles'}`,color:'#D71920'});
  embed.setThumbnail(user.displayAvatarURL({size:256}));
  return i.reply({embeds:[embed]});
 }
};
