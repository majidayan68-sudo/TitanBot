import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('promote')
    .setDescription('Give a member a server role')
    .addUserOption(option => option.setName('user').setDescription('The server member').setRequired(true))
    .addRoleOption(option => option.setName('role').setDescription('The role to assign').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  category: 'Foltyn',

  async execute(interaction) {
    const fail = content => interaction.reply({ content, flags: MessageFlags.Ephemeral });
    if (!interaction.inGuild()) return fail('This command only works in a server.');
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles))
      return fail('You need Manage Roles permission.');

    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    try {
      const [member, bot, executor] = await Promise.all([
        interaction.guild.members.fetch(user.id),
        interaction.guild.members.fetchMe(),
        interaction.guild.members.fetch(interaction.user.id)
      ]);
      if (!bot.permissions.has(PermissionFlagsBits.ManageRoles))
        return fail('I need Manage Roles permission.');
      if (role.id === interaction.guild.id || role.managed)
        return fail('That role cannot be managed manually.');
      if (role.comparePositionTo(bot.roles.highest) >= 0)
        return fail('That role is at or above my highest role.');
      if (interaction.guild.ownerId !== executor.id && role.comparePositionTo(executor.roles.highest) >= 0)
        return fail('That role is at or above your highest role.');
      if (!member.manageable)
        return fail('I cannot manage this member due to role hierarchy.');
      if (interaction.guild.ownerId !== executor.id &&
          member.id !== executor.id &&
          member.roles.highest.comparePositionTo(executor.roles.highest) >= 0)
        return fail('You cannot manage a member with an equal or higher role.');

      if (member.roles.cache.has(role.id))
        return fail(`${user} already has ${role}.`);
      await member.roles.add(role, `promote command used by ${interaction.user.tag}`);
      return interaction.reply({ content: `✅ ${user} received the ${role} role.` });
    } catch (error) {
      console.error('promote command failed:', error);
      return fail('Unable to update the role. Check permissions and role hierarchy.');
    }
  }
};
