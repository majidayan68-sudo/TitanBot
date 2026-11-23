
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Manage a member’s server roles.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)

    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Give a member a role.')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('The member receiving the role.')
            .setRequired(true)
        )
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The role to give.')
            .setRequired(true)
        )
    )

    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a role from a member.')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('The member losing the role.')
            .setRequired(true)
        )
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The role to remove.')
            .setRequired(true)
        )
    ),

  category: 'Foltyn',

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({
        content: 'You need Manage Roles permission to use this command.',
        flags: MessageFlags.Ephemeral
      });
    }

    const action = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');

    const member = await interaction.guild.members.fetch(user.id);
    const botMember = await interaction.guild.members.fetchMe();

    if (role.managed) {
      return interaction.reply({
        content: 'You cannot manually assign or remove an integration-managed role.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (role.position >= botMember.roles.highest.position) {
      return interaction.reply({
        content: 'I cannot manage that role because it is equal to or higher than my highest role.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (!member.manageable) {
      return interaction.reply({
        content: 'I cannot manage this member because of role hierarchy restrictions.',
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      if (action === 'add') {
        if (member.roles.cache.has(role.id)) {
          return interaction.reply({
            content: `${user} already has the ${role} role.`,
            flags: MessageFlags.Ephemeral
          });
        }

        await member.roles.add(role, `Role assigned by ${interaction.user.tag}`);

        return interaction.reply({
          content: `✅ Successfully gave ${role} to ${user}.`
        });
      }

      if (action === 'remove') {
        if (!member.roles.cache.has(role.id)) {
          return interaction.reply({
            content: `${user} doesn't have the ${role} role.`,
            flags: MessageFlags.Ephemeral
          });
        }

        await member.roles.remove(role, `Role removed by ${interaction.user.tag}`);

        return interaction.reply({
          content: `✅ Successfully removed ${role} from ${user}.`
        });
      }
    } catch (error) {
      console.error('Role command error:', error);

      return interaction.reply({
        content: 'Something went wrong while managing that role. Check my permissions and role hierarchy.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
