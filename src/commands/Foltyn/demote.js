import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('demote')
    .setDescription('Demote a member to the specified role')
    .addUserOption(option => option.setName('user').setDescription('The server member').setRequired(true))
    .addRoleOption(option => option.setName('role').setDescription('The destination role').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  category: 'Foltyn',

  async execute(interaction) {
    const fail = content => interaction.deferred
      ? interaction.editReply({ content })
      : interaction.reply({ content, flags: MessageFlags.Ephemeral });
    if (!interaction.inGuild()) return fail('This command only works in a server.');
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles))
      return fail('You need Manage Roles permission.');
    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const [member, bot, executor] = await Promise.all([
        interaction.guild.members.fetch({ user: user.id, force: true }),
        interaction.guild.members.fetchMe(),
        interaction.guild.members.fetch(interaction.user.id)
      ]);
      if (!bot.permissions.has(PermissionFlagsBits.ManageRoles)) return fail('I need Manage Roles permission.');
      if (role.id === interaction.guild.id || role.managed) return fail('That role cannot be managed manually.');
      if (role.comparePositionTo(bot.roles.highest) >= 0) return fail('That role is at or above my highest role.');
      const owner = interaction.guild.ownerId === executor.id;
      if (!owner && role.comparePositionTo(executor.roles.highest) >= 0) return fail('That role is at or above your highest role.');
      if (!member.manageable) return fail('I cannot manage this member due to role hierarchy.');
      if (!owner && member.roles.highest.comparePositionTo(executor.roles.highest) >= 0) return fail('You cannot manage a member with an equal or higher role.');
      const higher = member.roles.cache.filter(r => !r.managed && r.comparePositionTo(role) > 0);
      if (!higher.size) return fail('This member has no removable roles above the destination role.');
      if (higher.some(r => !r.editable || (!owner && r.comparePositionTo(executor.roles.highest) >= 0))) return fail('One or more higher roles cannot be managed. No changes made.');
      const remaining = member.roles.cache.filter(r => r.id !== interaction.guild.id && !higher.has(r.id));
      remaining.set(role.id, role);
      await member.roles.set([...remaining.keys()], `Demoted by ${interaction.user.tag}`);
      const managedAbove = remaining.some(r => r.managed && r.comparePositionTo(role) > 0);
      return interaction.editReply({ content: `✅ ${user} demoted to ${role}. Removed ${higher.size} higher role(s).${managedAbove ? '\nIntegration-managed higher roles were preserved.' : ''}`, allowedMentions: { parse: [] } });
    } catch (error) {
      console.error('demote command failed:', error);
      return fail('Unable to update roles. Check permissions and role hierarchy.');
    }
  }
};
