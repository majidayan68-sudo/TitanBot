
import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  AttachmentBuilder,
  MessageFlags
} from 'discord.js';

import {
  createEmbed,
  successEmbed
} from '../utils/embeds.js';

import {
  createTicket,
  closeTicket,
  claimTicket,
  updateTicketPriority
} from '../services/ticket.js';

import { getGuildConfig } from '../services/config/guildConfig.js';
import { readTicketSystems } from '../commands/Ticket/modules/ticket_dashboard.js';
import { getTicketPanelStatus } from '../utils/panelStatus.js';
import { logTicketEvent } from '../utils/ticket/ticketLogging.js';
import { logger } from '../utils/logger.js';
import { InteractionHelper } from '../utils/interactionHelper.js';
import { checkRateLimit } from '../utils/rateLimiter.js';

import {
  replyUserError,
  ErrorTypes,
  handleInteractionError,
  createError
} from '../utils/errorHandler.js';

import { getTicketPermissionContext } from '../utils/ticket/ticketPermissions.js';

function escapeHtml(text) {
  if (!text) return '';

  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function ensureGuildContext(interaction) {
  if (interaction.inGuild()) {
    return true;
  }

  if (!interaction.replied && !interaction.deferred) {
    await replyUserError(interaction, {
      type: ErrorTypes.UNKNOWN,
      message: 'This action can only be used in a server.'
    });
  }

  return false;
}

async function assertTicketPermission(
  interaction,
  client,
  actionLabel,
  options = {},
  timeoutMs = 2500
) {
  const { allowTicketCreator = false } = options;

  let context;

  try {
    const contextPromise = getTicketPermissionContext({
      client,
      interaction
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Timeout')),
        timeoutMs
      )
    );

    context = await Promise.race([
      contextPromise,
      timeoutPromise
    ]);

  } catch (error) {
    if (error.message === 'Timeout') {
      throw createError(
        'Ticket permission timeout',
        ErrorTypes.RATE_LIMIT,
        'The permission check took too long. Please try again.'
      );
    }

    throw createError(
      'Ticket permission check failed',
      ErrorTypes.UNKNOWN,
      `Failed to check permissions: ${error.message}`
    );
  }

  if (!context.ticketData) {
    throw createError(
      'Not a ticket channel',
      ErrorTypes.VALIDATION,
      'This action can only be used in a valid ticket channel.'
    );
  }

  const allowed = allowTicketCreator
    ? context.canCloseTicket
    : context.canManageTicket;

  if (!allowed) {
    const permissionMessage = allowTicketCreator
      ? 'You must have **Manage Channels**, the configured **Ticket Staff Role**, or be the **ticket creator**.'
      : 'You must have **Manage Channels** or the configured **Ticket Staff Role**.';

    throw createError(
      'Ticket permission denied',
      ErrorTypes.PERMISSION,
      `${permissionMessage}\n\nYou cannot ${actionLabel}.`
    );
  }

  return context;
}

async function ensureTicketPermission(
  interaction,
  client,
  actionLabel,
  options = {}
) {
  const { allowTicketCreator = false } = options;

  const context = await getTicketPermissionContext({
    client,
    interaction
  });

  if (!context.ticketData) {
    await replyUserError(interaction, {
      type: ErrorTypes.UNKNOWN,
      message: 'This action can only be used in a valid ticket channel.'
    });

    return null;
  }

  const allowed = allowTicketCreator
    ? context.canCloseTicket
    : context.canManageTicket;

  if (!allowed) {
    const permissionMessage = allowTicketCreator
      ? 'You must have **Manage Channels**, the configured **Ticket Staff Role**, or be the **ticket creator**.'
      : 'You must have **Manage Channels** or the configured **Ticket Staff Role**.';

    await replyUserError(interaction, {
      type: ErrorTypes.PERMISSION,
      message: `${permissionMessage}\n\nYou cannot ${actionLabel}.`
    });

    return null;
  }

  return context;
}

// Legacy panels retain create_ticket.
// New panels use create_ticket:<system id>.

const openingTickets = new Set();

async function resolvePanel(
  interaction,
  client,
  id,
  messageId
) {
  const config = await getGuildConfig(
    client,
    interaction.guildId
  );

  const panels = readTicketSystems(config);

  const panel = id
    ? panels.find(p => p.id === String(id))
    : panels.find(p => p.legacy);

  if (!panel) {
    throw new Error(
      'This ticket system no longer exists.'
    );
  }

  let expected = panel.messageId;

  const channelId =
    panel.publishedChannelId || panel.channelId;

  if (!expected && panel.legacy) {
    const status = await getTicketPanelStatus(
      client,
      interaction.guild,
      {
        ticketPanelChannelId: channelId,
        ticketPanelMessageId: null
      }
    );

    expected =
      status.exists &&
      status.message?.author.id === client.user.id
        ? status.message.id
        : null;
  }

  if (
    !expected ||
    expected !== messageId ||
    interaction.channelId !== channelId
  ) {
    throw new Error(
      'This ticket panel is outdated. Please use the current panel.'
    );
  }

  return {
    ...panel,
    messageId: expected
  };
}

async function createFromPanel(
  interaction,
  panel,
  answers
) {
  const key =
    `${interaction.guildId}:${interaction.user.id}`;

  if (openingTickets.has(key)) {
    throw new Error(
      'Your ticket is already being created.'
    );
  }

  openingTickets.add(key);

  try {
    const byId = Object.fromEntries(
      answers.map(q => [q.id, q.value])
    );

    const tradeDetails = panel.legacy
      ? {
          otherTrader: byId.other_trader || '',
          yourSide: byId.your_side || '',
          theirSide: byId.their_side || '',
          robloxUsernames: byId.roblox_usernames || ''
        }
      : null;

    const member =
      await interaction.guild.members.fetch(
        interaction.user.id
      );

    const { channel } = await createTicket(
      interaction.guild,
      member,
      panel.categoryId,
      'Ticket form submitted',
      'none',
      tradeDetails,
      {
        ...panel,
        answers
      }
    );

    await interaction.editReply({
      embeds: [
        successEmbed(
          'Ticket Created',
          `Your ticket has been created in ${channel}!`
        )
      ]
    });

  } finally {
    openingTickets.delete(key);
  }
}

async function panelError(interaction, error) {
  logger.warn('Ticket panel action failed', {
    error: error.message,
    guildId: interaction.guildId
  });

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({
      content:
        error.userMessage ||
        error.message ||
        'Unable to create ticket.'
    }).catch(() => {});

  } else {
    await replyUserError(interaction, {
      type: ErrorTypes.UNKNOWN,
      message:
        error.userMessage ||
        error.message ||
        'Unable to create ticket.'
    }).catch(() => {});
  }
}

const createTicketHandler = {
  name: 'create_ticket',

  async execute(interaction, client, args = []) {
    try {
      if (!(await ensureGuildContext(interaction))) {
        return;
      }

      if (!await checkRateLimit(
        `${interaction.guildId}:${interaction.user.id}:create_ticket`,
        3,
        60000
      )) {
        throw new Error(
          'You are creating tickets too quickly. Please wait a minute.'
        );
      }

      const panel = await resolvePanel(
        interaction,
        client,
        args[0],
        interaction.message.id
      );

      const { getUserTicketCount } =
        await import('../services/ticket.js');

      if (
        await getUserTicketCount(
          interaction.guildId,
          interaction.user.id,
          panel.id
        ) >= panel.maxTickets
      ) {
        throw new Error(
          `You already have the maximum number of open tickets for this system (${panel.maxTickets}).`
        );
      }

      if (!panel.questions.length) {
        await interaction.deferReply({
          flags: MessageFlags.Ephemeral
        });

        return await createFromPanel(
          interaction,
          panel,
          []
        );
      }

      const modal = new ModalBuilder()
        .setCustomId(
          `create_ticket_modal:${panel.id}:${panel.revision}:${panel.messageId}`
        )
        .setTitle(panel.title.slice(0, 45));

      for (const q of panel.questions) {
        const input = new TextInputBuilder()
          .setCustomId(q.id)
          .setLabel(q.label)
          .setStyle(
            q.style === 'short'
              ? TextInputStyle.Short
              : TextInputStyle.Paragraph
          )
          .setRequired(q.required)
          .setMaxLength(700);

        if (q.placeholder) {
          input.setPlaceholder(q.placeholder);
        }

        modal.addComponents(
          new ActionRowBuilder().addComponents(input)
        );
      }

      await interaction.showModal(modal);

    } catch (error) {
      await panelError(interaction, error);
    }
  }
};

const createTicketModalHandler = {
  name: 'create_ticket_modal',

  async execute(interaction, client, args = []) {
    try {
      if (!(await ensureGuildContext(interaction))) {
        return;
      }

      if (!await InteractionHelper.safeDefer(
        interaction,
        {
          flags: MessageFlags.Ephemeral
        }
      )) {
        return;
      }

      const [id, revision, messageId] = args;

      if (!id || !messageId) {
        throw new Error(
          'Please reopen the ticket form.'
        );
      }

      if (
        interaction.message &&
        interaction.message.id !== messageId
      ) {
        throw new Error(
          'This ticket form is outdated.'
        );
      }

      const panel = await resolvePanel(
        interaction,
        client,
        id,
        messageId
      );

      if (String(panel.revision) !== revision) {
        throw new Error(
          'The questions have changed. Please reopen the ticket form.'
        );
      }

      const answers = panel.questions.map(q => ({
        id: q.id,
        label: q.label,
        value: interaction.fields
          .getTextInputValue(q.id)
          .trim()
      }));

      if (
        answers.some(
          (a, n) =>
            panel.questions[n].required && !a.value
        )
      ) {
        throw new Error(
          'Please answer all required questions.'
        );
      }

      await createFromPanel(
        interaction,
        panel,
        answers
      );

    } catch (error) {
      await panelError(interaction, error);
    }
  }
};

const closeTicketHandler = {
  name: 'ticket_close',

  async execute(interaction, client) {
    try {
      if (!(await ensureGuildContext(interaction))) {
        return;
      }

      await assertTicketPermission(
        interaction,
        client,
        'close this ticket',
        {
          allowTicketCreator: true
        },
        2000
      );

      const modal = new ModalBuilder()
        .setCustomId('ticket_close_modal')
        .setTitle('Close Ticket');

      const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Reason for closing (optional)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(
          'Add an optional reason for closing this ticket...'
        )
        .setRequired(false)
        .setMaxLength(1000);

      const actionRow =
        new ActionRowBuilder().addComponents(
          reasonInput
        );

      modal.addComponents(actionRow);

      await interaction.showModal(modal);

    } catch (error) {
      logger.error(
        'Error closing ticket:',
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await replyUserError(interaction, {
          type: ErrorTypes.UNKNOWN,
          message: 'Could not open ticket close form.'
        });
      }
    }
  }
};

const closeTicketModalHandler = {
  name: 'ticket_close_modal',

  async execute(interaction, client) {
    try {
      if (!(await ensureGuildContext(interaction))) {
        return;
      }

      await assertTicketPermission(
        interaction,
        client,
        'close this ticket',
        {
          allowTicketCreator: true
        },
        2000
      );

      const deferSuccess =
        await InteractionHelper.safeDefer(
          interaction,
          {
            flags: MessageFlags.Ephemeral
          }
        );

      if (!deferSuccess) return;

      const providedReason = interaction.fields
        .getTextInputValue('reason')
        ?.trim();

      const reason =
        providedReason ||
        'Closed via ticket button without a specific reason.';

      await closeTicket(
        interaction.channel,
        interaction.user,
        reason
      );

      await interaction.editReply({
        embeds: [
          successEmbed(
            'Ticket Closed',
            'This ticket has been closed.'
          )
        ]
      });

    } catch (error) {
      logger.error(
        'Error submitting close ticket modal:',
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await replyUserError(interaction, {
          type: ErrorTypes.UNKNOWN,
          message: 'An error occurred while closing the ticket.'
        });

      } else if (interaction.deferred) {
        await replyUserError(interaction, {
          type: ErrorTypes.UNKNOWN,
          message: 'An error occurred while closing the ticket.'
        });
      }
    }
  }
};

const claimTicketHandler = {
  name: 'ticket_claim',

  async execute(interaction, client) {
    try {
      if (!(await ensureGuildContext(interaction))) {
        return;
      }

      await assertTicketPermission(
        interaction,
        client,
        'claim tickets',
        {},
        2000
      );

      const deferSuccess =
        await InteractionHelper.safeDefer(
          interaction,
          {
            flags: MessageFlags.Ephemeral
          }
        );

      if (!deferSuccess) return;

      await claimTicket(
        interaction.channel,
        interaction.user
      );

      await interaction.editReply({
        embeds: [
          successEmbed(
            'Ticket Claimed',
            'You have claimed this ticket.'
          )
        ]
      });

    } catch (error) {
      logger.error(
        'Error claiming ticket:',
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await replyUserError(interaction, {
          type: ErrorTypes.UNKNOWN,
          message: 'An error occurred while claiming the ticket.'
        });

      } else if (interaction.deferred) {
        await replyUserError(interaction, {
          type: ErrorTypes.UNKNOWN,
          message: 'An error occurred while claiming the ticket.'
        });
      }
    }
  }
};

const priorityTicketHandler = {
  name: 'ticket_priority',

  async execute(interaction, client, args) {
    try {
      if (!(await ensureGuildContext(interaction))) {
        return;
      }

      await assertTicketPermission(
        interaction,
        client,
        'change ticket priority',
        {},
        2000
      );

      const deferSuccess =
        await InteractionHelper.safeDefer(
          interaction,
          {
            flags: MessageFlags.Ephemeral
          }
        );

      if (!deferSuccess) return;

      const priority = args?.[0];

      if (!priority) {
        await replyUserError(interaction, {
          type: ErrorTypes.VALIDATION,
          message: 'A priority value is required.'
        });

        return;
      }

      await updateTicketPriority(
        interaction.channel,
        priority,
        interaction.user
      );

      await interaction.editReply({
        embeds: [
          successEmbed(
            'Priority Updated',
            `Ticket priority set to **${priority.toUpperCase()}**.`
          )
        ]
      });

    } catch (error) {
      logger.error(
        'Error updating ticket priority:',
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await replyUserError(interaction, {
          type: ErrorTypes.UNKNOWN,
          message: 'An error occurred while updating the priority.'
        });

      } else if (interaction.deferred) {
        await replyUserError(interaction, {
          type: ErrorTypes.UNKNOWN,
          message: 'An error occurred while updating the priority.'
        });
      }
    }
  }
};

const pinTicketHandler = {
  name: 'ticket_pin',

  async execute(interaction, client) {
    try {
      if (!(await ensureGuildContext(interaction))) {
        return;
      }

      await assertTicketPermission(
        interaction,
        client,
        'pin tickets',
        {},
        2000
      );

      const deferSuccess =
        await InteractionHelper.safeDefer(
          interaction,
          {
            flags: MessageFlags.Ephemeral
          }
        );

      if (!deferSuccess) return;

      const channel = interaction.channel;
      const category = channel.parent;

      if (!category) {
        await replyUserError(interaction, {
          type: ErrorTypes.UNKNOWN,
          message: 'This ticket is not in a category.'
        });

        return;
      }

      const hasPingEmoji =
        channel.name.startsWith('📌');

      if (hasPingEmoji) {
        const newName =
          channel.name.replace(/^📌\s*/, '');

        await channel.edit({
          name: newName,
          position: 999
        });

        await interaction.editReply({
          embeds: [
            createEmbed({
              title: '📌 Ticket Unpinned',
              description: 'This ticket has been unpinned and moved back to normal position.',
              color: 0x95A5A6
            })
          ],
          flags: MessageFlags.Ephemeral
        });

        logger.info('Ticket unpinned', {
          guildId: interaction.guildId,
          channelId: channel.id,
          channelName: newName,
          userId: interaction.user.id
        });

      } else {
        const pinnedName =
          `📌 ${channel.name}`;

        await channel.edit({
          name: pinnedName,
          position: 0
        });

        await interaction.editReply({
          embeds: [
            createEmbed({
              title: '📌 Ticket Pinned',
              description: 'This ticket has been pinned to the top of the category.',
              color: 0x3498db
            })
          ],
          flags: MessageFlags.Ephemeral
        });

        logger.info('Ticket pinned', {
          guildId: interaction.guildId,
          channelId: channel.id,
          channelName: pinnedName,
          userId: interaction.user.id
        });
      }

      await logTicketEvent({
        client: interaction.client,
        guildId: interaction.guildId,

        event: {
          type: hasPingEmoji
            ? 'unpin'
            : 'pin',

          ticketId: channel.id,

          ticketNumber:
            channel.name.replace(/[^0-9]/g, ''),

          userId: interaction.user.id,
          executorId: interaction.user.id,

          metadata: {
            isPinned: !hasPingEmoji,

            newChannelName: hasPingEmoji
              ? channel.name.replace(/^📌\s*/, '')
              : `📌 ${channel.name}`
          }
        }
      });

    } catch (error) {
      logger.error(
        'Error pinning/unpinning ticket:',
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await replyUserError(interaction, {
          type: ErrorTypes.UNKNOWN,
          message: 'Failed to pin/unpin the ticket.'
        });

      } else if (interaction.deferred) {
        await replyUserError(interaction, {
          type: ErrorTypes.UNKNOWN,
          message: 'Failed to pin/unpin the ticket.'
        });
      }
    }
  }
};

const unclaimTicketHandler = {
  name: 'ticket_unclaim',

  async execute(interaction, client) {
    try {
      if (!(await ensureGuildContext(interaction))) {
        return;
      }

      await assertTicketPermission(
        interaction,
        client,
        'unclaim tickets',
        {},
        2000
      );

      const deferSuccess =
        await InteractionHelper.safeDefer(
          interaction,
          {
            flags: MessageFlags.Ephemeral
          }
        );

      if (!deferSuccess) return;

      const { unclaimTicket } =
        await import('../services/ticket.js');

      await unclaimTicket(
        interaction.channel,
        interaction.member
      );

      await interaction.editReply({
        embeds: [
          successEmbed(
            'Ticket Unclaimed',
            'This ticket has been unclaimed.'
          )
        ]
      });

    } catch (error) {
      logger.error(
        'Error unclaiming ticket:',
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await replyUserError(interaction, {
          type: ErrorTypes.UNKNOWN,
          message: 'An error occurred while unclaiming the ticket.'
        });

      } else if (interaction.deferred) {
        await replyUserError(interaction, {
          type: ErrorTypes.UNKNOWN,
          message: 'An error occurred while unclaiming the ticket.'
        });
      }
    }
  }
};

const reopenTicketHandler = {
  name: 'ticket_reopen',

  async execute(interaction, client) {
    try {
      if (!(await ensureGuildContext(interaction))) {
        return;
      }

      await assertTicketPermission(
        interaction,
        client,
        'reopen tickets',
        {},
        2000
      );

      const deferSuccess =
        await InteractionHelper.safeDefer(
          interaction,
          {
            flags: MessageFlags.Ephemeral
          }
        );

      if (!deferSuccess) return;

      const { reopenTicket } =
        await import('../services/ticket.js');

      const {
        movedToOpenCategory,
        openCategoryMoveFailed
      } = await reopenTicket(
        interaction.channel,
        interaction.member
      );

      let reopenMessage =
        'This ticket has been reopened.';

      if (openCategoryMoveFailed) {
        reopenMessage +=
          ' Note: Could not move the channel back to the open tickets category.';
      }

      await interaction.editReply({
        embeds: [
          successEmbed(
            'Ticket Reopened',
            reopenMessage
          )
        ]
      });

    } catch (error) {
      logger.error(
        'Error reopening ticket:',
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await replyUserError(interaction, {
          type: ErrorTypes.UNKNOWN,
          message: 'An error occurred while reopening the ticket.'
        });

      } else if (interaction.deferred) {
        await replyUserError(interaction, {
          type: ErrorTypes.UNKNOWN,
          message: 'An error occurred while reopening the ticket.'
        });
      }
    }
  }
};

const deleteTicketHandler = {
  name: 'ticket_delete',

  async execute(interaction, client) {
    try {
      if (!(await ensureGuildContext(interaction))) {
        return;
      }

      await assertTicketPermission(
        interaction,
        client,
        'delete tickets',
        {},
        2000
      );

      const deferSuccess =
        await InteractionHelper.safeDefer(
          interaction,
          {
            flags: MessageFlags.Ephemeral
          }
        );

      if (!deferSuccess) return;

      const { deleteTicket } =
        await import('../services/ticket.js');

      await deleteTicket(
        interaction.channel,
        interaction.member
      );

      await interaction.editReply({
        embeds: [
          successEmbed(
            'Ticket Deleted',
            'This ticket will be deleted shortly.'
          )
        ]
      });

    } catch (error) {
      logger.error(
        'Error deleting ticket:',
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await replyUserError(interaction, {
          type: ErrorTypes.UNKNOWN,
          message: 'An error occurred while deleting the ticket.'
        });

      } else if (interaction.deferred) {
        await replyUserError(interaction, {
          type: ErrorTypes.UNKNOWN,
          message: 'An error occurred while deleting the ticket.'
        });
      }
    }
  }
};

export default createTicketHandler;

export {
  createTicketModalHandler,
  closeTicketModalHandler,
  closeTicketHandler,
  claimTicketHandler,
  priorityTicketHandler,
  pinTicketHandler,
  unclaimTicketHandler,
  reopenTicketHandler,
  deleteTicketHandler
};
