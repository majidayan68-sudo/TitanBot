import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { db } from '../../utils/database/wrapper.js';
const key = (g, u) => `guild:${g}:foltyn:afk:${u}`;
export default {
  data: new SlashCommandBuilder().setName('afk').setDescription('Set your AFK status.').addStringOption(o => o.setName('reason').setDescription('Why you are AFK').setRequired(false).setMaxLength(180)),
  category: 'Foltyn',
  async execute(i) {
    const reason = i.options.getString('reason')?.trim() || 'AFK';
    await db.set(key(i.guildId, i.user.id), { reason, since: new Date().toISOString() });
    return i.reply({ content: `${i.user}: You're now afk with the status: ${reason}`, flags: MessageFlags.Ephemeral });
  }
};
