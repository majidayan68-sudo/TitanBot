import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { getTicketData, saveTicketData } from '../../utils/database/tickets.js';
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

export default { data:new SlashCommandBuilder().setName('add').setDefaultMemberPermissions(null).setDescription('Adds a trader or member to this ticket.').addUserOption(o=>o.setName('user').setDescription('Member to add').setRequired(true)),category:'Foltyn',
 async execute(interaction){
    if (!await hasMiddlemanAccess(interaction)) {
      return interaction.reply({ content: 'Only Middleman and higher roles can use this command.', flags: MessageFlags.Ephemeral });
    }
    const t=await getTicketData(interaction.guildId,interaction.channel.id);if(!t)return interaction.reply({content:'This command only works in a ticket.',flags:MessageFlags.Ephemeral});const selected=interaction.options.getUser('user');const member=selected?.id ? await interaction.guild.members.fetch(selected.id).catch(()=>null) : null;if(!member)return interaction.reply({content:'Select a valid server member.',flags:MessageFlags.Ephemeral});const user=member.user;if((t.traderIds||[t.userId]).length>=2 && !(t.traderIds||[t.userId]).includes(user.id))return interaction.reply({content:'This ticket already has two traders registered.',flags:MessageFlags.Ephemeral});if(user.bot)return interaction.reply({content:'Bots cannot be added as traders.',flags:MessageFlags.Ephemeral});await interaction.channel.permissionOverwrites.edit(user.id,{ViewChannel:true,SendMessages:true,AttachFiles:true,ReadMessageHistory:true});t.traderIds=[...new Set([...(t.traderIds||[t.userId]),user.id])].slice(0,2);t.traderDetectionDisabled=true;await saveTicketData(interaction.guildId,interaction.channel.id,t);return interaction.reply({content:`✅ **User Added**\n${user} has been added to this ticket. User ID: \`${user.id}\`\nTrader detection has been deactivated for this ticket.`});}
};
