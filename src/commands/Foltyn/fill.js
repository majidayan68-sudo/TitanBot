import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';

const VERIFIED_MEMBER_ROLE_ID = '1559962688170500126';
const MIDDLEMAN_ROLE_ID = '1559962361522032802';

// Add only rank/cosmetic roles explicitly approved for automatic assignment.
// Never include staff, moderation, private-channel access or verification roles.
const FILL_ROLE_IDS = new Set([
  // '123456789012345678',
  ...(process.env.FOLTYN_FILL_ROLE_IDS || '').split(',').map(id => id.trim()).filter(id => /^\d{17,20}$/.test(id))
]);

const logo = 'https://i.postimg.cc/CxSsGg0c/Server-Logo.png';
const banner = 'https://i.postimg.cc/59YXQW59/Server-Banner-GIF.gif';

function resultEmbed(description, fields = [], title = 'Role Fill Results') {
  return { embeds: [createEmbed({ title, description, fields, color: '#D71920', thumbnail: logo, image: banner })], allowedMentions: { parse: [] } };
}

function roleList(roles) {
  if (!roles.length) return 'None';
  const lines = [];
  let length = 0;
  for (const role of roles) {
    const line = `• <@&${role.id}>`;
    if (length + line.length + 1 > 950) break;
    lines.push(line);
    length += line.length + 1;
  }
  if (lines.length < roles.length) lines.push(`… and ${roles.length - lines.length} more`);
  return lines.join('\n');
}

export default {
  data: new SlashCommandBuilder()
    .setName('fill')
    .setDescription('Fill approved missing roles between a member’s highest and lowest roles.')
    .addUserOption(option => option.setName('user').setDescription('Member to fill roles for').setRequired(true))
    .setDefaultMemberPermissions(null),
  category: 'Foltyn',

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild || !interaction.user?.id) return interaction.reply({ content: 'Use this command in a server.', flags: MessageFlags.Ephemeral });
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const [executor, verified, middleman] = await Promise.all([
        guild.members.fetch({ user: interaction.user.id, force: true }),
        guild.roles.fetch(VERIFIED_MEMBER_ROLE_ID),
        guild.roles.fetch(MIDDLEMAN_ROLE_ID)
      ]);
      if (!verified || !middleman || executor.roles.highest.comparePositionTo(verified) < 0) {
        return interaction.editReply(resultEmbed('Only Verified Member or higher can use this command.', [], 'Role Fill Unavailable'));
      }
      const requested = interaction.options.getUser('user');
      if (!requested?.id) return interaction.editReply(resultEmbed('Choose a valid server member.'));
      const [member, bot] = await Promise.all([
        guild.members.fetch({ user: requested.id, force: true }),
        guild.members.fetchMe()
      ]);
      await guild.roles.fetch();
      if (member.user.bot || !member.manageable || !bot.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.editReply(resultEmbed('The bot cannot manage this member.'));
      }
      if (member.id !== executor.id && guild.ownerId !== executor.id && executor.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
        return interaction.editReply(resultEmbed('You can fill your own roles or those of a member below you.'));
      }
      const roles = member.roles.cache.filter(role => role.id !== guild.id).sort((a,b) => b.comparePositionTo(a));
      if (roles.size < 2) return interaction.editReply(resultEmbed('The member needs at least two roles.'));
      const highest = roles.first();
      const lowest = roles.last();
      const missing = guild.roles.cache.filter(role => role.id !== guild.id && role.comparePositionTo(highest) < 0 && role.comparePositionTo(lowest) > 0 && !member.roles.cache.has(role.id)).sort((a,b) => b.comparePositionTo(a));
      const eligible = missing.filter(role =>
        FILL_ROLE_IDS.has(role.id) &&
        !role.managed && role.id !== verified.id && role.comparePositionTo(middleman) < 0 &&
        !role.permissions.has(PermissionFlagsBits.Administrator) &&
        role.comparePositionTo(bot.roles.highest) < 0 &&
        role.comparePositionTo(executor.roles.highest) < 0 &&
        member.permissions.has(role.permissions) && executor.permissions.has(role.permissions)
      );
      const added = [], failed = [];
      for (const role of eligible.values()) {
        try {
          await member.roles.add(role, `Role fill requested by ${executor.id}`);
          added.push(role);
        } catch (error) {
          failed.push(role);
          console.error('Role fill error:', role.id, error);
        }
      }
      const skipped = [...missing.filter(role => !eligible.has(role.id)).values()];
      const fields = [
        { name: 'Added', value: String(added.length), inline: true },
        { name: 'Skipped', value: String(skipped.length), inline: true },
        { name: 'Failed', value: String(failed.length), inline: true },
        { name: 'Roles added', value: roleList(added) },
        { name: 'Roles skipped', value: roleList(skipped) }
      ];
      if (failed.length) fields.push({ name: 'Failed roles', value: roleList(failed) });
      const note = !FILL_ROLE_IDS.size ? '\n\nNo approved fill roles have been configured yet.' : '';
      return interaction.editReply(resultEmbed(`**Member:** <@${member.id}>\n**Highest role:** <@&${highest.id}>\n**Lowest role:** <@&${lowest.id}>${note}`, fields));
    } catch (error) {
      console.error('Fill command error:', error);
      return interaction.editReply(resultEmbed('Unable to fill roles. Check the member and bot permissions.', [], 'Role Fill Error'));
    }
  }
};
