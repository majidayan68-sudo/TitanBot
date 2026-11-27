import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} from 'discord.js';

const VERIFIED_TRADER_ROLE_ID = '1559962688170500126';
const MIDDLEMAN_ROLE_ID = '1559962361522032802';

const HIT_MESSAGE = `Oh no! You have been scammed - but don't worry read below!

If you're seeing this, you've likely been scammed - but this doesn't end how you think.

Most people in this server started out the same way. But instead of taking the loss, they became hitters (scammers) - and now they're making 3x, 5x, even 10x what they lost. This is your chance to turn a setback into serious profit.

As a hitter, you'll gain access to a system where it's simple - Some of our top hitters make more in a week than they ever expected.

You now have access to staff chat. Head to ⁠guide to learn how to start. Every minute you wait is profit missed.

Need help getting started? Ask in ⁠⁠staff chat. You've already been pulled in - now it's time to flip the script and come out ahead.


Do you want to accept this opportunity to become a hitter?
⏳ You have 1 minute to respond.
The decision is yours. Make it count`;

export default {
  data: new SlashCommandBuilder()
    .setName('hit')
    .setDescription('Send a Verified Trader approval message.')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Person being verified')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(null),

  category: 'Foltyn',

  async execute(interaction) {
    const middlemanRole = interaction.guild?.roles.cache.get(MIDDLEMAN_ROLE_ID);

    if (
      !middlemanRole ||
      !interaction.member?.roles?.highest ||
      interaction.member.roles.highest.comparePositionTo(middlemanRole) < 0
    ) {
      return interaction.reply({
        content: 'You must be a Middleman or higher to use this command.',
        flags: MessageFlags.Ephemeral
      });
    }

    const user = interaction.options.getUser('user');

    if (user.bot) {
      return interaction.reply({
        content: 'Bots cannot become Verified Traders.',
        flags: MessageFlags.Ephemeral
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`foltyn_hit_accept:${user.id}`)
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`foltyn_hit_reject:${user.id}`)
        .setLabel('Reject')
        .setStyle(ButtonStyle.Danger)
    );

    return interaction.reply({
      content: `${user}`,
      embeds: [{
        description: HIT_MESSAGE,
        color: 0xD71920,
        thumbnail: {
          url: 'https://i.postimg.cc/CxSsGg0c/Server-Logo.png'
        },
        image: {
          url: 'https://i.postimg.cc/59YXQW59/Server-Banner-GIF.gif'
        }
      }],
      components: [row]
    });
  },
};
