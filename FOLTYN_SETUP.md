# Foltyn Plays Bot - setup notes

## Prefix
The bot uses `$` by default. You can override this with `PREFIX` in your hosting environment.

## Foltyn commands

Prefix commands:
- `$mminfo` - post the middleman process acknowledgement.
- `$mmfee` - post the one-time fee arrangement selector.
- `$confirm` - post the two-trader confirmation button.
- `$vouch @member`, `$vouches [@member]`, `$setvouches @member <amount>`.
- `$afk [reason]`, `$w [@member]`, `$fill`, `$wp [@member]`.
- `$claim` is available through the existing ticket claim command.

Slash commands:
- `/add user:@member` - add the second trader to a ticket.
- `/transfer middleman:@member` - transfer ticket responsibility to a configured staff middleman.
- `/close` - asks for confirmation, then uses the existing ticket close service and transcript workflow.
- `/unclaim` - unassign a claimed ticket.

`/add` should be used to register the second trader before using the two-trader acknowledgement and confirmation buttons. The bot does not infer a second trader automatically.

## Required Discord setup

1. Enable the Message Content Intent in the Discord Developer Portal because prefix commands need to read message content.
2. Enable Server Members Intent for member lookups and role commands.
3. Invite the bot with the permissions required by the features you use. Ticket management needs Manage Channels; `$fill` needs Manage Roles. The bot's highest role must be above roles it is expected to assign.
4. Configure `ticketStaffRoleId` in the existing server configuration so the bot knows who can manage and transfer tickets.
5. Configure the ticket transcript channel in the existing ticket settings. The existing ticket close service generates and sends the transcript when `/close` is confirmed.
6. Use PostgreSQL for persistent AFK, ping, vouch and ticket state. The project's memory fallback loses stored data when the process restarts.

## Notes and limits

- `$wp` records mentions from the moment this version is running. It cannot reconstruct older mentions.
- `$fill` only assigns non-managed roles with no permissions, within the target member's existing role range, and below the bot's highest role. It requires Manage Roles.
- `$setvouches` requires Manage Server.
- Never commit `.env`, bot tokens, database passwords or other credentials. Keep existing hosting secrets/environment variables when updating the GitHub repository.
- Test the bot in a private test server before deploying to the live community.
