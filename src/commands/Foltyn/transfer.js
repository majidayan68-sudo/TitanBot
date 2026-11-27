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

export default {data:new SlashCommandBuilder().setName('transfer').setDefaultMemberPermissions(null).setDescription('Transfers this ticket to another middleman.').addUserOption(o=>o.setName('middleman').setDescription('New assigned middleman').setRequired(true)),category:'Foltyn',
 async execute(interaction){
    if (!await hasMiddlemanAccess(interaction)) {
      return interaction.reply({ content: 'Only Middleman and higher roles can use this command.', flags: MessageFlags.Ephemeral });
    }
    const t=await getTicketData(interaction.guildId,interaction.channel.id);if(!t)return interaction.reply({content:'This command only works in a ticket.',flags:MessageFlags.Ephemeral});const selected=interaction.options.getUser('middleman');const member=selected?.id ? await interaction.guild.members.fetch(selected.id).catch(()=>null) : null;const role=await interaction.guild.roles.fetch(MIDDLEMAN_ROLE_ID).catch(()=>null);if(!member||member.user.bot||!role||member.roles.highest.comparePositionTo(role)<0)return interaction.reply({content:'The selected member must have the Middleman role or higher.',flags:MessageFlags.Ephemeral});const target=member.user;t.claimedBy=target.id;t.assignedMiddlemanId=target.id;t.claimedAt=new Date().toISOString();await saveTicketData(interaction.guildId,interaction.channel.id,t);await interaction.channel.send(`📨 Ticket responsibility transferred to ${target}.`);return interaction.reply({content:`Ticket transferred to ${target}.`,flags:MessageFlags.Ephemeral});}
};
