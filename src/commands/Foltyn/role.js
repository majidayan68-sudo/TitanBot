import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Add or remove a role from a server member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub => sub.setName('add').setDescription('Give a member a role.')
      .addUserOption(opt => opt.setName('user').setDescription('Member to receive the role').setRequired(true))
      .addRoleOption(opt => opt.setName('role').setDescription('Role to give').setRequired(true)))
    .addSubcommand(sub => sub.setName('remove').setDescription('Remove a role from a member.')
      .addUserOption(opt => opt.setName('user').setDescription('Member to remove the role from').setRequired(true))
      .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true))),
  category: 'Foltyn',
  async execute(interaction) {
    const ephemeral = { flags: MessageFlags.Ephemeral };
    if (!interaction.inGuild()) return interaction.reply({ content: 'Use this in a server.', ...ephemeral });
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) return interaction.reply({ content: 'You need Manage Roles permission.', ...ephemeral });
    try {
      const action = interaction.options.getSubcommand();
      const user = interaction.options.getUser('user', true);
      const role = interaction.options.getRole('role', true);
      const member = await interaction.guild.members.fetch(user.id);
      const bot = await interaction.guild.members.fetchMe();
      const actor = await interaction.guild.members.fetch(interaction.user.id);
      if (!bot.permissions.has(PermissionFlagsBits.ManageRoles)) return interaction.reply({ content: 'I need Manage Roles permission.', ...ephemeral });
      if (role.id === interaction.guild.id || role.managed) return interaction.reply({ content: 'That role cannot be manually managed.', ...ephemeral });
      if (role.comparePositionTo(bot.roles.highest) >= 0) return interaction.reply({ content: 'That role is at or above my highest role.', ...ephemeral });
      if (interaction.guild.ownerId !== actor.id && role.comparePositionTo(actor.roles.highest) >= 0) return interaction.reply({ content: 'That role is at or above your highest role.', ...ephemeral });
      if (!member.manageable) return interaction.reply({ content: 'I cannot manage this member due to role hierarchy.', ...ephemeral });
      if (action === 'add') {
        if (member.roles.cache.has(role.id)) return interaction.reply({ content: `${user} already has ${role}.`, ...ephemeral });
        await member.roles.add(role, `Assigned by ${interaction.user.tag} (${interaction.user.id})`);
        return interaction.reply({ content: `✅ Added ${role} to ${user}.` });
      }
      if (!member.roles.cache.has(role.id)) return interaction.reply({ content: `${user} does not have ${role}.`, ...ephemeral });
      await member.roles.remove(role, `Removed by ${interaction.user.tag} (${interaction.user.id})`);
      return interaction.reply({ content: `✅ Removed ${role} from ${user}.` });
    } catch (err) {
      console.error('Foltyn /role error:', err);
      if (!interaction.replied && !interaction.deferred) return interaction.reply({ content: 'Role update failed. Check permissions and role order.', ...ephemeral });
    }
  }
};
