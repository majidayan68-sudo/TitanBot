
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle, EmbedBuilder, ChannelType,
  PermissionFlagsBits, MessageFlags
} from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../../../services/config/guildConfig.js';
import { getTicketPanelStatus } from '../../../utils/panelStatus.js';

const COLOR = '#D71920';
const LOGO = 'https://i.postimg.cc/CxSsGg0c/Server-Logo.png';
const BANNER = 'https://i.postimg.cc/59YXQW59/Server-Banner-GIF.gif';
const locks = new Map();
const row = (...components) => new ActionRowBuilder().addComponents(...components);
const button = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const select = (id, placeholder, options) => new StringSelectMenuBuilder().setCustomId(id).setPlaceholder(placeholder).addOptions(options);
const opt = (label, value) => ({ label: String(label).slice(0, 100), value: String(value) });
const question = (id, label, placeholder = '', style = 'paragraph', required = true) => ({ id, label, placeholder, style, required });
const originalQuestions = () => [
  question('other_trader', "Who's the other trader? (Full username)", 'Paste their full Roblox username', 'short'),
  question('your_side', "What's your side of the trade?", 'Explain what you are giving / receiving'),
  question('their_side', "What's their side of the trade?", 'Explain what the other trader is giving / receiving'),
  question('roblox_usernames', 'Both Roblox usernames', 'Paste both Roblox usernames', 'short')
];
const newPanel = (id, values = {}) => ({
  id: String(id), legacy: false, title: `Ticket System ${id}`,
  description: 'Click below to create a ticket.', color: COLOR,
  thumbnail: LOGO, banner: BANNER, buttonLabel: 'Create Ticket',
  buttonStyle: 'Secondary', buttonEmoji: '📩', channelId: null,
  messageId: null, publishedChannelId: null, categoryId: null,
  closedCategoryId: null, maxTickets: 3, dmOnClose: true, revision: 1,
  questions: [question('q1', 'How can we help?', 'Describe your issue...')],
  ...values
});

// Convert the old configuration to system #1 without deleting the old panel.
export function readTicketSystems(config) {
  if (Array.isArray(config.ticketSystems)) return config.ticketSystems;
  if (!config.ticketPanelChannelId) return [];
  return [newPanel(1, {
    legacy: true, title: config.ticketPanelTitle || 'Foltyn Plays | Middleman Tickets',
    description: config.ticketPanelMessage || 'Click below to create a ticket.',
    color: config.ticketPanelColor || COLOR,
    thumbnail: config.ticketPanelThumbnail ?? LOGO, banner: config.ticketPanelBanner ?? BANNER,
    buttonLabel: config.ticketButtonLabel || 'Create Ticket',
    channelId: config.ticketPanelChannelId, publishedChannelId: config.ticketPanelChannelId,
    messageId: config.ticketPanelMessageId || null, categoryId: config.ticketCategoryId || null,
    closedCategoryId: config.ticketClosedCategoryId || null,
    maxTickets: config.maxTicketsPerUser || 3, dmOnClose: config.dmOnClose !== false,
    questions: originalQuestions()
  })];
}
async function load(client, guildId) {
  const config = await getGuildConfig(client, guildId);
  return { config, panels: readTicketSystems(config) };
}
async function change(client, guildId, fn) {
  const previous = locks.get(guildId) || Promise.resolve();
  const task = previous.catch(() => {}).then(async () => {
    const state = await load(client, guildId);
    const result = await fn(state);
    // Reload unrelated guild settings before writing to reduce stale overwrites.
    const config = await getGuildConfig(client, guildId);
    Object.assign(config, state.shared || {});
    config.ticketSystems = state.panels;
    if (state.config.ticketSystemNextId != null) config.ticketSystemNextId = state.config.ticketSystemNextId;
    const legacy = state.panels.find(p => p.legacy);
    if (legacy) Object.assign(config, {
      ticketPanelTitle: legacy.title, ticketPanelMessage: legacy.description,
      ticketPanelColor: legacy.color, ticketPanelThumbnail: legacy.thumbnail,
      ticketPanelBanner: legacy.banner, ticketButtonLabel: legacy.buttonLabel,
      ticketPanelChannelId: legacy.publishedChannelId || legacy.channelId,
      ticketPanelMessageId: legacy.messageId, ticketCategoryId: legacy.categoryId,
      ticketClosedCategoryId: legacy.closedCategoryId, maxTicketsPerUser: legacy.maxTickets,
      dmOnClose: legacy.dmOnClose
    });
    else Object.assign(config, { ticketPanelChannelId: null, ticketPanelMessageId: null });
    await setGuildConfig(client, guildId, config);
    return result;
  });
  locks.set(guildId, task);
  try { return await task; } finally { if (locks.get(guildId) === task) locks.delete(guildId); }
}
function find(state, id) {
  const p = state.panels.find(p => p.id === String(id));
  if (!p) throw new Error('This ticket system no longer exists.');
  return p;
}
function allocate(state, values = {}) {
  if (state.panels.length >= 25) throw new Error('Maximum of 25 ticket systems.');
  const id = Math.max(Number(state.config.ticketSystemNextId) || 1,
    ...state.panels.map(p => Number(p.id) + 1));
  state.config.ticketSystemNextId = id + 1;
  const p = newPanel(id, values);
  state.panels.push(p);
  return p;
}
function panelPayload(p) {
  const embed = new EmbedBuilder().setTitle(p.title).setDescription(p.description).setColor(p.color);
  if (p.thumbnail) embed.setThumbnail(p.thumbnail);
  if (p.banner) embed.setImage(p.banner);
  const b = button(p.legacy ? 'create_ticket' : `create_ticket:${p.id}`, p.buttonLabel, ButtonStyle[p.buttonStyle] || ButtonStyle.Secondary);
  if (p.buttonEmoji) b.setEmoji(p.buttonEmoji);
  return { embeds: [embed], components: [row(b)], allowedMentions: { parse: [] } };
}
async function messageFor(client, guild, p) {
  const channelId = p.publishedChannelId || p.channelId;
  if (!channelId) return null;
  if (p.messageId) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) return null;
    const msg = await channel.messages.fetch(p.messageId).catch(() => null);
    if (msg && msg.author.id === client.user.id) return msg;
  }
  if (p.legacy) {
    const status = await getTicketPanelStatus(client, guild, {ticketPanelChannelId: channelId, ticketPanelMessageId: p.messageId});
    if (status.exists && status.message?.author.id === client.user.id) return status.message;
  }
  return null;
}
async function publish(client, guild, id) {
  return change(client, guild.id, async state => {
    const p = find(state, id);
    if (!p.channelId) throw new Error('Set a panel channel first.');
    const channel = await guild.channels.fetch(p.channelId);
    if (channel.type !== ChannelType.GuildText) throw new Error('Choose a normal text channel.');
    const old = await messageFor(client, guild, p);
    const payload = panelPayload(p);
    let msg;
    if (old?.channelId === channel.id) msg = await old.edit(payload);
    else msg = await channel.send(payload);
    p.messageId = msg.id; p.publishedChannelId = channel.id;
    // The old panel is rejected by the new message-ID check even if deletion fails.
    if (old && old.id !== msg.id) await old.delete().catch(() => {});
    return msg;
  });
}
export async function setupTicketSystem(interaction, client) {
  const o = interaction.options;
  const p = await change(client, interaction.guildId, state => {
    const role = o.getRole('staff_role');
    if (role) {
      if (role.id === interaction.guildId) throw new Error('@everyone cannot be the staff role.');
      if (state.panels.length && state.config.ticketStaffRoleId !== role.id) throw new Error('Staff roles are shared. Set the shared staff role from the dashboard instead.');
      state.shared = { ticketStaffRoleId: role.id };
    }
    return allocate(state, {
      title: o.getString('title') || 'Support Tickets', description: o.getString('panel_message'),
      buttonLabel: o.getString('button_label') || 'Create Ticket', channelId: o.getChannel('panel_channel').id,
      categoryId: o.getChannel('category')?.id || null, closedCategoryId: o.getChannel('closed_category')?.id || null,
      maxTickets: o.getInteger('max_tickets_per_user') || 3, dmOnClose: o.getBoolean('dm_on_close') !== false
    });
  });
  const msg = await publish(client, interaction.guild, p.id);
  return interaction.editReply({ content: `**Ticket System ${p.id} | ${p.title}** created.\n[View panel](${msg.url})\nUse /ticket dashboard to customize it.` });
}
function input(id, label, value = '', max = 100, long = false, required = true) {
  const t = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(long ? TextInputStyle.Paragraph : TextInputStyle.Short).setMaxLength(max).setRequired(required);
  if (value !== '' && value != null) t.setValue(String(value).slice(0, max));
  return row(t);
}
async function modal(i, title, inputs) {
  const id = `ticketedit_${i.id}`;
  const m = new ModalBuilder().setCustomId(id).setTitle(title.slice(0,45)).addComponents(inputs);
  const pending = i.awaitModalSubmit({filter: s => s.customId === id && s.user.id === i.user.id, time: 120000}).catch(() => null);
  await i.showModal(m);
  const s = await pending;
  if (s) await s.deferReply({flags: MessageFlags.Ephemeral});
  return s;
}
function validURL(v) {
  if (!v) return '';
  const u = new URL(v);
  if (!['https:', 'http:'].includes(u.protocol)) throw new Error('Use an HTTP or HTTPS image URL.');
  return v;
}
function required(v, label) { if (!v) throw new Error(`${label} cannot be empty.`); return v; }
const channelText = id => id ? `<#${id}>` : 'Not set';
const roleText = id => id ? `<@&${id}>` : 'Not set';
const choices = [
  ['Panel Title & Description','appearance'], ['Panel Colour & Images','images'], ['Button Appearance','button'],
  ['Panel Channel','channelId'], ['Open Ticket Category','categoryId'], ['Closed Ticket Category','closedCategoryId'],
  ['Add Question','add'], ['Edit Question','edit'], ['Remove Question','remove'], ['Reorder Questions','reorder'],
  ['Max Open Tickets','max'], ['Toggle DM on Close','dm'], ['Shared Staff Role','ticketStaffRoleId'],
  ['Shared Logs Channel','ticketLogsChannelId'], ['Shared Transcript Channel','ticketTranscriptChannelId']
];
const sharedKeys = ['ticketStaffRoleId','ticketLogsChannelId','ticketTranscriptChannelId'];
const channelKeys = ['channelId','categoryId','closedCategoryId', ...sharedKeys.slice(1)];

export default {
  prefixOnly: false,
  async execute(interaction, config, client) {
    const guild = interaction.guild, gid = guild.id;
    const prefix = `td_${interaction.id}_`;
    let selectedId = null, extra = null, busy = false, closed = false;
    async function render() {
      if (closed) return;
      const state = await load(client, gid);
      const p = state.panels.find(p => p.id === selectedId);
      const embed = new EmbedBuilder().setTitle('Ticket System Manager').setColor(COLOR);
      const components = [];
      if (state.panels.length) components.push(row(select(prefix+'select','Choose a ticket system',state.panels.map(x => ({...opt(`Ticket System ${x.id} | ${x.title}`, x.id), default: x.id === selectedId})) )));
      const buttons = [button(prefix+'new','Create New System',ButtonStyle.Success)];
      if (p) buttons.push(button(prefix+'publish','Publish / Update',ButtonStyle.Primary),button(prefix+'delete','Delete System',ButtonStyle.Danger));
      components.push(row(...buttons));
      if (p) {
        embed.setDescription(`**Ticket System ${p.id} | ${p.title}**\n${p.description.slice(0,600)}`)
          .addFields(
            {name:'Panel Channel',value:channelText(p.channelId),inline:true},
            {name:'Status',value:p.messageId && p.publishedChannelId===p.channelId?'Published (ID saved)':'Draft / needs publishing',inline:true},
            {name:'Colour',value:p.color,inline:true},
            {name:'Button',value:`${p.buttonLabel} (${p.buttonStyle})`,inline:true},
            {name:'Open Category',value:channelText(p.categoryId),inline:true},
            {name:'Closed Category',value:channelText(p.closedCategoryId),inline:true},
            {name:'Max Open Tickets',value:String(p.maxTickets),inline:true},
            {name:'DM on Close',value:p.dmOnClose?'Enabled':'Disabled',inline:true},
            {name:'Questions',value:p.questions.length?p.questions.map((q,n)=>`${n+1}. ${q.label} (${q.style}, ${q.required?'required':'optional'})`).join('\n'):'None'},
            {name:'Shared Staff Role',value:roleText(state.config.ticketStaffRoleId),inline:true},
            {name:'Shared Logs',value:channelText(state.config.ticketLogsChannelId),inline:true},
            {name:'Shared Transcripts',value:channelText(state.config.ticketTranscriptChannelId),inline:true});
        components.push(row(select(prefix+'settings','Customize this ticket system',choices.map(([l,v])=>opt(l,v)))));
        if (extra) components.push(extra);
      } else embed.setDescription(state.panels.length?'Select an existing ticket system or create a new one.':'Create your first ticket system.');
      embed.setFooter({text:`${state.panels.length}/25 systems | Changes are saved automatically`});
      await interaction.editReply({embeds:[embed],components});
    }
    async function update(id, fn) {
      const p = await change(client,gid,state=>{const p=find(state,id);fn(p,state);return p;});
      // Edits affect only the saved message for this panel, never another system.
      const message = await messageFor(client,guild,p);
      if (message && message.channelId===p.channelId) {
        try { await message.edit(panelPayload(p)); return true; } catch { return false; }
      }
      return false;
    }
    await render();
    const reply = await interaction.fetchReply();
    const collector = reply.createMessageComponentCollector({filter:i=>i.user.id===interaction.user.id&&i.customId.startsWith(prefix),time:600000});
    collector.on('collect',async i=>{
      let s, acquired = false;
      try {
        if (!i.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) return i.reply({content:'Permission denied.',flags:MessageFlags.Ephemeral});
        if (busy) return i.reply({content:'Finish the current edit first.',flags:MessageFlags.Ephemeral});
        busy=true;acquired=true;
        const action=i.customId.slice(prefix.length);
        if(action==='select'){await i.deferUpdate();selectedId=i.values[0];extra=null;return await render();}
        if(action==='new'){await i.deferUpdate();const p=await change(client,gid,state=>allocate(state));selectedId=p.id;extra=null;return await render();}
        const id=selectedId, state=await load(client,gid), p=find(state,id);
        if(action==='publish'){await i.deferUpdate();await publish(client,guild,id);extra=null;return await render();}
        if(action==='delete'){
          s=await modal(i,'Delete Ticket System',[input('confirm','Type DELETE to confirm')]);if(!s)return;
          if(s.fields.getTextInputValue('confirm')!=='DELETE')throw new Error('Deletion cancelled.');
          await change(client,gid,async state=>{const p=find(state,id);const m=await messageFor(client,guild,p);if(m)await m.delete();state.panels=state.panels.filter(x=>x.id!==id);});
          selectedId=null;extra=null;await s.editReply('System deleted. Existing ticket channels are unchanged.');return await render();
        }
        if(action.startsWith('pick_')){
          const key=action.slice(5);if(!channelKeys.includes(key)&&key!=='ticketStaffRoleId')throw new Error('Invalid setting.');
          const value=i.values[0]||null;if(key==='ticketStaffRoleId'&&value===gid)throw new Error('@everyone cannot be ticket staff.');
          await i.deferUpdate();await update(id,(p,state)=>{if(sharedKeys.includes(key))state.shared={[key]:value};else p[key]=value;});extra=null;return await render();
        }
        let setting=action==='settings'?i.values[0]:null;
        let questionId=null;
        if(action==='qedit'||action==='qremove'){setting=action==='qedit'?'edit_selected':'remove_selected';questionId=i.values[0];}
        if(!setting)throw new Error('Unknown setting.');
        extra=null;
        if(channelKeys.includes(setting)||setting==='ticketStaffRoleId'){
          const picker=setting==='ticketStaffRoleId'?new RoleSelectMenuBuilder():new ChannelSelectMenuBuilder().setChannelTypes(['categoryId','closedCategoryId'].includes(setting)?ChannelType.GuildCategory:ChannelType.GuildText);
          picker.setCustomId(prefix+'pick_'+setting).setPlaceholder('Choose a value (clear to unset)').setMinValues(setting==='channelId'?1:0).setMaxValues(1);
          extra=row(picker);await i.deferUpdate();return await render();
        }
        if(setting==='dm'){await i.deferUpdate();await update(id,p=>{p.dmOnClose=!p.dmOnClose;});return await render();}
        if(setting==='edit'||setting==='remove'){
          if(!p.questions.length)throw new Error('No questions to edit.');
          extra=row(select(prefix+(setting==='edit'?'qedit':'qremove'),'Choose a question',p.questions.map((q,n)=>opt(`${n+1}. ${q.label}`,q.id))));await i.deferUpdate();return await render();
        }
        if(setting==='remove_selected'){
          await i.deferUpdate();await update(id,p=>{p.questions=p.questions.filter(q=>q.id!==questionId);p.revision++;});return await render();
        }
        let inputs, title;
        switch(setting){
          case 'appearance':title='Panel Appearance';inputs=[input('title','Panel title',p.title,256),input('description','Panel description',p.description,4000,true)];break;
          case 'images':title='Colour & Images';inputs=[input('color','Hex colour',p.color,7),input('thumbnail','Thumbnail URL (optional)',p.thumbnail,1000,false,false),input('banner','Banner URL (optional)',p.banner,1000,false,false)];break;
          case 'button':title='Button Appearance';inputs=[input('label','Button label',p.buttonLabel,80),input('style','Primary / Secondary / Success / Danger',p.buttonStyle,10),input('emoji','Unicode emoji (optional)',p.buttonEmoji,32,false,false)];break;
          case 'max':title='Max Open Tickets';inputs=[input('max','Maximum open tickets (1-10)',p.maxTickets,2)];break;
          case 'reorder':title='Reorder Questions';if(!p.questions.length)throw new Error('No questions to reorder.');inputs=[input('order','New order (example: 3,1,2)',p.questions.map((_,n)=>n+1).join(','),20)];break;
          case 'add':case 'edit_selected':{
            if(setting==='add'&&p.questions.length>=5)throw new Error('Discord allows up to five questions.');
            const q=setting==='add'?question('',''):p.questions.find(q=>q.id===questionId);
            if(!q)throw new Error('Question no longer exists.');
            title=setting==='add'?'Add Question':'Edit Question';inputs=[input('label','Question text',q.label,45),input('placeholder','Placeholder (optional)',q.placeholder,100,false,false),input('style','Answer style: short or paragraph',q.style,9),input('required','Required: yes or no',q.required?'yes':'no',3)];break;}
          default:throw new Error('Invalid setting.');
        }
        s=await modal(i,title,inputs);if(!s)return;
        if(!s.memberPermissions?.has(PermissionFlagsBits.ManageChannels))throw new Error('Permission denied.');
        const v=k=>s.fields.getTextInputValue(k).trim();
        const live=await update(id,current=>{
          switch(setting){
            case 'appearance':current.title=required(v('title'),'Title');current.description=required(v('description'),'Description');break;
            case 'images':if(!/^#[\da-f]{6}$/i.test(v('color')))throw new Error('Use a hex colour like #D71920.');current.color=v('color');current.thumbnail=validURL(v('thumbnail'));current.banner=validURL(v('banner'));break;
            case 'button':{const style=['Primary','Secondary','Success','Danger'].find(x=>x.toLowerCase()===v('style').toLowerCase());if(!style)throw new Error('Invalid button style.');current.buttonLabel=required(v('label'),'Button label');current.buttonStyle=style;current.buttonEmoji=v('emoji');if(current.buttonEmoji&&!/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(current.buttonEmoji))throw new Error('Use a Unicode emoji or leave it blank.');panelPayload(current).components[0].toJSON();break;}
            case 'max':{const n=Number(v('max'));if(!Number.isInteger(n)||n<1||n>10)throw new Error('Use a whole number from 1 to 10.');current.maxTickets=n;break;}
            case 'reorder':{const order=v('order').split(',').map(x=>Number(x.trim())-1);if(order.length!==current.questions.length||new Set(order).size!==order.length||order.some(x=>!current.questions[x]))throw new Error('Include every question number exactly once.');current.questions=order.map(x=>current.questions[x]);current.revision++;break;}
            case 'add':case 'edit_selected':{
              const style=v('style').toLowerCase(), req=v('required').toLowerCase();if(!['short','paragraph'].includes(style)||!['yes','no'].includes(req))throw new Error('Use short/paragraph and yes/no.');
              if(setting==='add'&&current.questions.length>=5)throw new Error('Maximum five questions.');
              const q=question(setting==='add'?`q${s.id}`:questionId,required(v('label'),'Question'),v('placeholder'),style,req==='yes');
              if(setting==='add')current.questions.push(q);else {const n=current.questions.findIndex(q=>q.id===questionId);if(n<0)throw new Error('Question no longer exists.');current.questions[n]=q;}
              current.revision++;break;}
          }
        });
        await s.editReply(live?'Saved and panel updated.':'Saved. Use Publish / Update to post or refresh the panel.');await render();
      }catch(e){const content=`Error: ${e.message}`;if(s?.deferred)await s.editReply(content).catch(()=>{});else if(i.deferred||i.replied)await i.followUp({content,flags:MessageFlags.Ephemeral}).catch(()=>{});else await i.reply({content,flags:MessageFlags.Ephemeral}).catch(()=>{});}
      finally{if(acquired)busy=false;}
    });
    collector.on('end',()=>{closed=true;interaction.editReply({components:[]}).catch(()=>{});});
  }
};
