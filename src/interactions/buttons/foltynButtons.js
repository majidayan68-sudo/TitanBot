
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} from 'discord.js';

import {
  getTicketData,
  saveTicketData
} from '../../utils/database/tickets.js';

import { createEmbed } from '../../utils/embeds.js';
import { closeTicket } from '../../services/ticket.js';
import { getTicketPermissionContext } from '../../utils/ticket/ticketPermissions.js';

const VERIFIED_TRADER_ROLE_ID = '1559962688170500126';

async function getTicket(interaction) {
  if (!interaction.guildId || !interaction.channelId) return null;
  return getTicketData(interaction.guildId, interaction.channelId);
}

function isTrader(ticket, userId) {
  const ids = ticket?.traderIds?.length
    ? ticket.traderIds
    : [ticket?.userId];

  return ids.includes(userId);
}

export default [

  {
    name: 'foltyn_close_cancel',
    async execute(interaction) {
      await interaction.update({
        content: 'Ticket closure cancelled.',
        embeds: [],
        components: []
      });
    }
  },

  {
    name: 'foltyn_close_confirm',
    async execute(interaction) {
      const context = await getTicketPermissionContext({
        client: interaction.client,
        interaction
      });

      if (!context.ticketData || !context.canCloseTicket) {
        return interaction.reply({
          content: 'You no longer have permission to close this ticket.',
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.update({
        content: 'Generating transcript and closing ticket…',
        embeds: [],
        components: []
      });

      await closeTicket(
        interaction.channel,
        interaction.user,
        'Closed via confirmation button.'
      );
    }
  },

  {
    name: 'foltyn_mminfo_ack',
    async execute(interaction) {
      const t = await getTicket(interaction);

      if (!t) {
        return interaction.reply({
          content: 'This is not a ticket.',
          flags: MessageFlags.Ephemeral
        });
      }

      if (!isTrader(t, interaction.user.id)) {
        return interaction.reply({
          content: 'Only the two traders can acknowledge this.',
          flags: MessageFlags.Ephemeral
        });
      }

      t.traderIds = [
        ...new Set([...(t.traderIds || [t.userId]), interaction.user.id])
      ].slice(0, 2);

      t.mminfoAcknowledged = [
        ...new Set([...(t.mminfoAcknowledged || []), interaction.user.id])
      ];

      await saveTicketData(interaction.guildId, interaction.channelId, t);

      const ids = t.traderIds;
      const done = ids.length === 2 &&
        ids.every(id => t.mminfoAcknowledged.includes(id));

      await interaction.reply({
        content: done
          ? 'Both users have read and understood how middleman works.'
          : `${interaction.user} has read and understood how middleman works.`,
        flags: MessageFlags.Ephemeral
      });

      if (done) {
        await interaction.message.edit({ components: [] }).catch(() => {});
      }
    }
  },

  {
    name: 'foltyn_fee_split',
    async execute(interaction) {
      await chooseFee(interaction, 'split');
    }
  },

  {
    name: 'foltyn_fee_full',
    async execute(interaction) {
      await chooseFee(interaction, 'full');
    }
  },

  {
    name: 'foltyn_trade_confirm',
    async execute(interaction) {
      const t = await getTicket(interaction);

      if (!t) {
        return interaction.reply({
          content: 'This is not a ticket.',
          flags: MessageFlags.Ephemeral
        });
      }

      if (!isTrader(t, interaction.user.id)) {
        return interaction.reply({
          content: 'Only the two traders can confirm this trade.',
          flags: MessageFlags.Ephemeral
        });
      }

      t.traderIds = [
        ...new Set([...(t.traderIds || [t.userId]), interaction.user.id])
      ].slice(0, 2);

      t.tradeConfirmed = [
        ...new Set([...(t.tradeConfirmed || []), interaction.user.id])
      ];

      await saveTicketData(interaction.guildId, interaction.channelId, t);

      const done = t.traderIds.length === 2 &&
        t.traderIds.every(id => t.tradeConfirmed.includes(id));

      await interaction.reply({
        content: done
          ? 'Both parties have confirmed. The middleman can proceed.'
          : `${interaction.user} has confirmed. Waiting for the other party...`,
        flags: MessageFlags.Ephemeral
      });

      if (done) {
        await interaction.message.edit({ components: [] }).catch(() => {});
      }
    }
  },

  {
    name: 'foltyn_hit_accept',
    async execute(interaction) {
      const targetId = interaction.customId.split(':')[1];

      if (interaction.user.id !== targetId) {
        return interaction.reply({
          content: 'This verification request is not for you.',
          flags: MessageFlags.Ephemeral
        });
      }

      if (!interaction.guild) {
        return interaction.reply({
          content: 'This button can only be used in a server.',
          flags: MessageFlags.Ephemeral
        });
      }

      const member = await interaction.guild.members.fetch(targetId);

      const role = await interaction.guild.roles
        .fetch(VERIFIED_TRADER_ROLE_ID)
        .catch(() => null);

      if (!role) {
        return interaction.reply({
          content: 'The Verified Trader role could not be found. Check the role ID.',
          flags: MessageFlags.Ephemeral
        });
      }

      await member.roles.add(
        role,
        'Accepted Verified Trader verification'
      );

      await interaction.update({
        content: `${interaction.message.content}\n\n✅ **Accepted. You are now a Verified Trader!**`,
        components: []
      });
    }
  },

  {
    name: 'foltyn_hit_reject',
    async execute(interaction) {
      const targetId = interaction.customId.split(':')[1];

      if (interaction.user.id !== targetId) {
        return interaction.reply({
          content: 'This verification request is not for you.',
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.update({
        content: `${interaction.message.content}\n\n❌ **Verification rejected.**`,
        components: []
      });
    }
  }

];

async function chooseFee(interaction, choice) {
  const t = await getTicket(interaction);

  if (!t) {
    return interaction.reply({
      content: 'This is not a ticket.',
      flags: MessageFlags.Ephemeral
    });
  }

  if (!isTrader(t, interaction.user.id)) {
    return interaction.reply({
      content: 'Only the two traders can select the fee arrangement.',
      flags: MessageFlags.Ephemeral
    });
  }

  if (t.feeArrangement) {
    return interaction.reply({
      content: `The fee arrangement is already locked as **${t.feeArrangement === 'split' ? 'Split (50/50)' : 'Full (100%)'}**.`,
      flags: MessageFlags.Ephemeral
    });
  }

  t.feeArrangement = choice;
  t.feeSelectedBy = interaction.user.id;
  t.feeSelectedAt = new Date().toISOString();

  await saveTicketData(interaction.guildId, interaction.channelId, t);

  const embed = createEmbed({
    title: choice === 'split'
      ? 'Split Payment Selected'
      : 'Full Payment Selected',

    description: choice === 'split'
      ? `Both parties will split the middleman fee 50/50. Selected by: **${interaction.user}**`
      : `One party will cover 100% of the middleman fee. Selected by: **${interaction.user}**`,

    color: '#D71920',
    thumbnail: 'https://i.postimg.cc/CxSsGg0c/Server-Logo.png',
    image: 'https://i.postimg.cc/59YXQW59/Server-Banner-GIF.gif'
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('foltyn_fee_locked')
      .setLabel('Selection Locked')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );

  await interaction.update({
    embeds: [embed],
    components: [row]
  });
}
