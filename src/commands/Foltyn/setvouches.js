import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { db } from '../../utils/database/wrapper.js';
import { createEmbed } from '../../utils/embeds.js';
export default {data:new SlashCommandBuilder().setName('setvouches').setDescription('Set a member’s vouch total.').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('New vouch total').setMinValue(0).setRequired(true)),category:'Foltyn',
 async execute(i){if(!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild))return i.reply({content:'You need Manage Server to change vouch totals.',flags:MessageFlags.Ephemeral});const u=i.options.getUser('user'),n=i.options.getInteger('amount'),k=`guild:${i.guildId}:foltyn:vouches:${u.id}`,d=await db.get(k,{count:0,vouchers:[]});d.count=n;await db.set(k,d);return i.reply({embeds:[createEmbed({title:'vouches updated',description:`user · ${u}\nset to · **${n}**`,color:'#D71920',thumbnail:'https://i.postimg.cc/CxSsGg0c/Server-Logo.png',image:'https://i.postimg.cc/59YXQW59/Server-Banner-GIF.gif'})]});}
};
