
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags
} from 'discord.js';

const BLOCKED_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.ModerateMembers
];

export default {
  data: new SlashCommandBuilder()
    .setName('fill')
    .setDescription('Fill missing roles between a member’s highest and lowest roles.')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Member to fill roles for.')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageRoles
    ),

  category: 'Foltyn',

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: 'This command only works in a server.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({
        content: 'You need Manage Roles permission.',
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply({
      flags: MessageFlags.Ephemeral
    });

    try {
      const guild = interaction.guild;
      const user = interaction.options.getUser('user');

      const member = await guild.members.fetch(user.id);
      const botMember = await guild.members.fetchMe();
      const executor = await guild.members.fetch(interaction.user.id);

      await guild.roles.fetch();

      if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.editReply(
          'The bot needs Manage Roles permission.'
        );
      }

      const currentRoles = member.roles.cache
        .filter(role => role.id !== guild.id)
        .sort((a, b) => b.position - a.position);

      if (currentRoles.size < 2) {
        return interaction.editReply(
          'This member needs at least two roles to use /fill.'
        );
      }

      const highest = currentRoles.first();
      const lowest = currentRoles.last();

      const missingRoles = guild.roles.cache
        .filter(role =>
          role.id !== guild.id &&
          role.position < highest.position &&
          role.position > lowest.position &&
          !member.roles.cache.has(role.id)
        )
        .sort((a, b) => b.position - a.position);

      const eligibleRoles = missingRoles.filter(role => {
        if (role.managed) return false;

        if (role.position >= botMember.roles.highest.position) {
          return false;
        }

        if (
          guild.ownerId !== interaction.user.id &&
          role.position >= executor.roles.highest.position
        ) {
          return false;
        }

        if (
          BLOCKED_PERMISSIONS.some(permission =>
            role.permissions.has(permission)
          )
        ) {
          return false;
        }

        return true;
      });

      if (eligibleRoles.size === 0) {
        return interaction.editReply(
          `No eligible roles found for ${user}.\n\n` +
          `Highest: ${highest.name}\n` +
          `Lowest: ${lowest.name}\n` +
          `Missing roles between them: ${missingRoles.size}\n\n` +
          `Administrator, powerful staff, managed, and hierarchy-restricted roles are excluded.`
        );
      }

      const added = [];
      const failed = [];

      for (const role of eligibleRoles.values()) {
        try {
          await member.roles.add(
            role,
            `/fill executed by ${interaction.user.tag}`
          );

          added.push(role.name);
        } catch (error) {
          console.error(`Failed to add ${role.name}:`, error);
          failed.push(role.name);
        }
      }

      let response =
        `**Role Fill Complete**\n\n` +
        `Member: ${user}\n` +
        `Highest: ${highest.name}\n` +
        `Lowest: ${lowest.name}\n\n` +
        `Roles added: **${added.length}**\n` +
        `Failed: **${failed.length}**`;

      if (added.length) {
        response += `\n\n**Added Roles:**\n${added.map(name => `• ${name}`).join('\n')}`;
      }

      if (failed.length) {
        response += `\n\n**Failed Roles:**\n${failed.map(name => `• ${name}`).join('\n')}`;
      }

      return interaction.editReply(response.slice(0, 2000));

    } catch (error) {
      console.error('Fill command error:', error);

      return interaction.editReply(
        'An error occurred while filling roles. Check the bot permissions and role hierarchy.'
      );
    }
  }
};

