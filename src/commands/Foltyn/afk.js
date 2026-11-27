import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { db } from '../../utils/database/wrapper.js';
const key = (g, u) => `guild:${g}:foltyn:afk:${u}`;
const VERIFIED_MEMBER_ROLE_ID = '1559962688170500126';

async function getVerifiedContext(i) {
  if (!i.guild || !i.guildId || !i.user?.id) return null;
  const [member, role] = await Promise.all([
    i.guild.members.fetch(i.user.id).catch(() => null),
    i.guild.roles.fetch(VERIFIED_MEMBER_ROLE_ID).catch(() => null)
  ]);
  if (!member || !role || member.roles.highest.comparePositionTo(role) < 0) return null;
  return { member, role };
}
export default {
  data: new SlashCommandBuilder().setName('afk').setDescription('Set your AFK status.').addStringOption(o => o.setName('reason').setDescription('Why you are AFK').setRequired(false).setMaxLength(180)).setDefaultMemberPermissions(null),
  category: 'Foltyn',
  async execute(i) {
    const access = await getVerifiedContext(i);
    if (!access) return i.reply({content:'Only Verified Member or higher can use this command.',flags:MessageFlags.Ephemeral});
    const reason = i.options.getString('reason')?.trim() || 'AFK';
    await db.set(key(i.guildId, i.user.id), { reason, since: new Date().toISOString() });
    return i.reply({ content: `${i.user}: You're now afk with the status: ${reason}`, flags: MessageFlags.Ephemeral });
  }
};
