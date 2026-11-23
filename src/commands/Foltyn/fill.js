
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('fill')
    .setDescription('Fill missing roles between a member’s highest and lowest roles.')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Member to fill roles for')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  category: 'Foltyn',

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: 'This command only works in a server.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
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
      const bot = await guild.members.fetchMe();
      const executor = await guild.members.fetch(interaction.user.id);

      await guild.roles.fetch();

      if (!bot.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.editReply(
          'The bot needs Manage Roles permission.'
        );
      }

      const memberRoles = member.roles.cache
        .filter(role => role.id !== guild.id)
        .sort((a, b) => b.position - a.position);

      if (memberRoles.size < 2) {
        return interaction.editReply(
          'The member needs at least two roles.'
        );
      }

      const highest = memberRoles.first();
      const lowest = memberRoles.last();

      const missing = guild.roles.cache
        .filter(role =>
          role.id !== guild.id &&
          role.position < highest.position &&
          role.position > lowest.position &&
          !member.roles.cache.has(role.id)
        )
        .sort((a, b) => b.position - a.position);

      const eligible = missing.filter(role => {
        if (role.managed) return false;

        if (role.permissions.has(PermissionFlagsBits.Administrator)) {
          return false;
        }

        if (role.comparePositionTo(bot.roles.highest) >= 0) {
          return false;
        }

        if (
          guild.ownerId !== interaction.user.id &&
          role.comparePositionTo(executor.roles.highest) >= 0
        ) {
          return false;
        }

        return true;
      });

      const added = [];
      const failed = [];

      for (const role of eligible.values()) {
        try {
          await member.roles.add(
            role,
            `/fill by ${interaction.user.tag}`
          );
          added.push(role.name);
        } catch (error) {
          failed.push(role.name);
          console.error(`Failed to add ${role.name}:`, error);
        }
      }

      const skipped = missing.filter(
        role => !eligible.has(role.id)
      );

      let response =
        `**Role Fill Results**\n` +
        `Member: ${user}\n` +
        `Highest: ${highest.name}\n` +
        `Lowest: ${lowest.name}\n\n` +
        `Added: **${added.length}**\n` +
        `Skipped: **${skipped.size}**\n` +
        `Failed: **${failed.length}**`;

      if (added.length) {
        response += '\n\n**Added:**\n' +
          added.map(name => `• ${name}`).join('\n');
      }

      if (skipped.size) {
        response += '\n\n**Skipped:**\n' +
          skipped.map(role => `• ${role.name}`).join('\n');
      }

      if (failed.length) {
        response += '\n\n**Failed:**\n' +
          failed.map(name => `• ${name}`).join('\n');
      }

      return interaction.editReply(response.slice(0, 2000));

    } catch (error) {
      console.error('Fill command error:', error);

      return interaction.editReply(
        'An error occurred while filling roles.'
      );
    }
  }
};
