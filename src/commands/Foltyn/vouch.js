import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { db } from '../../utils/database/wrapper.js';
import { createEmbed } from '../../utils/embeds.js';
const key=(g,u)=>`guild:${g}:foltyn:vouches:${u}`;
export default {data:new SlashCommandBuilder().setName('vouch').setDescription('Vouch for a member.').addUserOption(o=>o.setName('user').setDescription('Member to vouch for').setRequired(true)),category:'Foltyn',
 async execute(i){const target=i.options.getUser('user');if(target.bot||target.id===i.user.id)return i.reply({content:'You cannot vouch for yourself or a bot.',flags:MessageFlags.Ephemeral});const k=key(i.guildId,target.id);const data=await db.get(k,{count:0,vouchers:[]});if(data.vouchers.some(v=>v.id===i.user.id))return i.reply({content:'You have already vouched for this member.',flags:MessageFlags.Ephemeral});data.count++;data.vouchers.unshift({id:i.user.id,tag:i.user.tag,at:new Date().toISOString()});data.vouchers=data.vouchers.slice(0,10);await db.set(k,data);const embed=createEmbed({title:'new vouch',description:`${i.user} vouched for ${target}\n\n**total · ${data.count}**`,color:'#D71920'});return i.reply({embeds:[embed]});}
};
