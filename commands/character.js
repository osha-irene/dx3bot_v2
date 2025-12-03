/**
 * 캐릭터 관리 명령어
 */

const { extractName, formatError, formatSuccess, convertSyndromeToEnglish } = require('../utils/helpers');
const config = require('../config');
const StatusPanelModule = require('./modules/statusPanel');

class CharacterCommands {
  constructor(database, sheetsClient) {
    this.db = database;
    this.sheets = sheetsClient;
    this.statusPanelModule = new StatusPanelModule(database);
  }

  async getActiveCharacterData(message) {
    const serverId = message.guild.id;
    const userId = message.author.id;
    const sheetInfo = this.db.getUserSheet(serverId, userId);
    
    if (sheetInfo && sheetInfo.spreadsheetId && this.sheets) {
      try {
        const data = await this.sheets.readFullCharacter(sheetInfo.spreadsheetId, sheetInfo.sheetName);
        if (data && data.characterName) {
          return { name: data.characterName, data, fromSheet: true, spreadsheetId: sheetInfo.spreadsheetId, sheetName: sheetInfo.sheetName, serverId, userId };
        }
      } catch (error) {
        console.error('시트 읽기 오류:', error);
      }
    }

    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    if (!activeCharName) return null;
    const data = this.db.getCharacter(serverId, userId, activeCharName);
    if (!data) return null;
    return { name: activeCharName, data, fromSheet: false, serverId, userId };
  }

  async statusPanel(message) {
    return await this.statusPanelModule.createOrUpdatePanel(message);
  }

  async updateStatusPanel(guild, serverId) {
    return await this.statusPanelModule.autoUpdate(guild, serverId);
  }

  async sheetInput(message, args) {
    const serverId = message.guild.id;
    const userId = message.author.id;
    const regex = /^(?:"([^"]+)"|\[([^\]]+)\]|(\S+))\s+(.+)$/;
    const match = args.join(' ').match(regex);
    if (!match) return message.channel.send(formatError('사용법: `!시트입력 "캐릭터 이름" [항목1] [값1]`'));
    
    const characterName = match[1] || match[2] || match[3];
    const attributeArgs = match[4].split(/\s+/);
    if (attributeArgs.length < 2 || attributeArgs.length % 2 !== 0) return message.channel.send(formatError('속성과 값은 짝수여야 합니다.'));
    
    let characterData = this.db.getCharacter(serverId, userId, characterName) || {};
    for (let i = 0; i < attributeArgs.length; i += 2) {
      const attribute = attributeArgs[i];
      const value = parseInt(attributeArgs[i + 1]);
      if (isNaN(value)) return message.channel.send(formatError(`**${attributeArgs[i + 1]}**는 숫자가 아닙니다.`));
      characterData[attribute] = value;
    }
    
    this.db.setCharacter(serverId, userId, characterName, characterData);
    return message.channel.send(formatSuccess(`**${characterName}**의 항목이 설정되었습니다.`));
  }

  async setActive(message, args) {
    const serverId = message.guild.id;
    const userId = message.author.id;
    if (args.length === 0) return message.channel.send(formatError('사용법: `!지정 "캐릭터 이름"`'));
    
    const characterName = extractName(args.join(' '));
    const characterData = this.db.getCharacter(serverId, userId, characterName);
    if (!characterData) return message.channel.send(formatError(`캐릭터 "${characterName}"를 찾을 수 없습니다.`));
    
    this.db.setActiveCharacter(serverId, userId, characterName);
    const emoji = characterData.emoji || '✅';
    const codeName = characterData.codeName || '';
    const replyMsg = await message.reply(`${emoji} **${characterName}** ${codeName ? `「${codeName}」` : ''} 활성화!\n💚 HP: ${characterData.HP || 0} | 🔴 침식률: ${characterData.침식률 || 0}`);
    setTimeout(() => { replyMsg.delete().catch(() => {}); message.delete().catch(() => {}); }, 5000);
    await this.updateStatusPanel(message.guild, serverId);
  }

  async unsetActive(message) {
    const serverId = message.guild.id;
    const userId = message.author.id;
    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    if (!activeCharName) return message.reply(formatError('활성화된 캐릭터가 없습니다.'));
    
    this.db.clearActiveCharacter(serverId, userId);
    const replyMsg = await message.reply(`⚪ **${activeCharName}** 활성 해제`);
    setTimeout(() => { replyMsg.delete().catch(() => {}); message.delete().catch(() => {}); }, 5000);
    await this.updateStatusPanel(message.guild, serverId);
  }

  async checkSheet(message) {
    const activeChar = await this.getActiveCharacterData(message);
    if (!activeChar) return message.reply(formatError('활성화된 캐릭터가 없습니다.'));
    
    const serverId = message.guild.id;
    const userId = message.author.id;
    const characterName = activeChar.name;
    
    let forumChannelId = this.db.getSheetForumChannel(serverId);
    let forumChannel = null;
    
    if (forumChannelId) {
      try {
        forumChannel = await message.guild.channels.fetch(forumChannelId);
        if (forumChannel.type !== 15) { forumChannel = null; forumChannelId = null; }
      } catch (error) {
        forumChannel = null; forumChannelId = null;
      }
    }
    
    if (!forumChannel) {
      const existingForum = message.guild.channels.cache.find(ch => ch.type === 15 && (ch.name === '캐릭터-시트' || ch.name === 'character-sheets'));
      if (existingForum) {
        forumChannel = existingForum;
        this.db.setSheetForumChannel(serverId, existingForum.id);
      } else {
        try {
          forumChannel = await message.guild.channels.create({ name: '캐릭터-시트', type: 15, topic: '캐릭터 시트 자동 관리' });
          this.db.setSheetForumChannel(serverId, forumChannel.id);
        } catch (error) {
          console.error('포럼 생성 오류:', error);
          return await this.checkSheetNormal(message, activeChar);
        }
      }
    }
    
    const sheetContent = this.generateSheetContent(activeChar);
    const threadInfo = this.db.getCharacterSheetThread(serverId, userId, characterName);
    
    try {
      if (threadInfo && threadInfo.threadId) {
        try {
          const thread = await forumChannel.threads.fetch(threadInfo.threadId);
          if (thread) {
            const sheetMessage = await thread.messages.fetch(threadInfo.messageId);
            await sheetMessage.edit(sheetContent);
            await message.delete().catch(() => {});
            const confirmMsg = await message.channel.send(`${activeChar.data.emoji || '📋'} **${characterName}** 시트 업데이트!\n📍 <#${thread.id}>`);
            setTimeout(() => confirmMsg.delete().catch(() => {}), 5000);
            return;
          }
        } catch (error) {}
      }
      
      const emoji = activeChar.data.emoji || '📋';
      const codeName = activeChar.data.codeName || '';
      const threadName = `${emoji} ${characterName} ${codeName ? `「${codeName}」` : ''}`;
      
      const thread = await forumChannel.threads.create({ name: threadName.substring(0, 100), message: { content: sheetContent } });
      const messages = await thread.messages.fetch({ limit: 1 });
      const firstMessage = messages.first();
      this.db.setCharacterSheetThread(serverId, userId, characterName, thread.id, firstMessage.id);
      await message.delete().catch(() => {});
      const confirmMsg = await message.channel.send(`${emoji} **${characterName}** 시트 스레드 생성!\n📍 <#${thread.id}>`);
      setTimeout(() => confirmMsg.delete().catch(() => {}), 5000);
    } catch (error) {
      console.error('포럼 스레드 오류:', error);
      return await this.checkSheetNormal(message, activeChar);
    }
  }

  async checkSheetNormal(message, activeChar) {
    return message.reply(this.generateSheetContent(activeChar));
  }

  generateSheetContent(activeChar) {
    const d = activeChar.data;
    const emoji = d.emoji || '❌';
    const codeName = d.codeName || '코드네임 없음';
    if (!Array.isArray(d.lois)) d.lois = [];
    
    let breed = "브리드 없음";
    if (d.breed) {
      const b = d.breed.toLowerCase();
      if (b === "퓨어" || b === "pure") breed = "PURE";
      else if (b === "크로스" || b === "cross") breed = "CROSS";
      else if (b === "트라이" || b === "tri") breed = "TRI";
    }
    
    let syndromes = d.syndromes ? d.syndromes.split(" × ").map(s => convertSyndromeToEnglish(s, config.syndromeTranslation)) : ["신드롬 없음"];
    
    let r = `${emoji}  **${activeChar.name}** :: **「${codeName}」**\n`;
    r += `> ${d.cover || "커버 없음"}｜${d.works || "웍스 없음"}\n`;
    r += `> ${breed}｜${syndromes.join(" × ")}\n`;
    r += `> ${d.awakening || "각성 없음"}｜${d.impulse || "충동 없음"}\n`;
    r += `> D-Lois｜No.${d.dloisNo || "00"} ${d.dloisName || "D로이스 없음"}\n\n`;
    r += `> **HP** ${d.HP || 0}  |  **침식률** ${d.침식률 || 0}  |  **침식D** ${d.침식D || 0}  |  **로이스** ${d.lois.length}\n`;
    
    for (let mainAttr of config.mainAttributes) {
      let sub = [];
      let mainVal = d[mainAttr] || 0;
      for (let [k, v] of Object.entries(d)) {
        if (config.subToMainMapping[k] === mainAttr) sub.push(`${k}: ${v}`);
        else {
          for (let p in config.dynamicMappingRules) {
            if (k.startsWith(p) && config.dynamicMappingRules[p] === mainAttr) sub.push(`${k}: ${v}`);
          }
        }
      }
      if (sub.length > 0 || mainVal !== 0) r += `>     **【${mainAttr}】**  ${mainVal}   ` + sub.join(' ') + '\n';
    }
    
    const combos = this.db.getCombos(activeChar.serverId, activeChar.userId, activeChar.name);
    if (Object.keys(combos).length > 0) {
      r += `\n${emoji}  **콤보**\n`;
      for (let cn in combos) r += `> ㆍ **${cn}**\n`;
    }
    
    if (d.lois && d.lois.length > 0) {
      r += `\n${emoji}  **로이스**\n`;
      for (let l of d.lois) r += `> ㆍ **${l.name}** | ${l.pEmotion} / ${l.nEmotion} | ${l.description}\n`;
    }
    
    if (d.memory && d.memory.length > 0) {
      r += `\n${emoji}  **메모리**\n`;
      for (let m of d.memory) r += `> ㆍ **${m.name}** | ${m.emotion} | ${m.description}\n`;
    }
    
    if (d.weapons && d.weapons.length > 0) {
      r += `\n${emoji}  **무기**\n`;
      for (let w of d.weapons) {
        let wi = `> ㆍ **${w.name}**`;
        if (w.type) wi += ` (${w.type})`;
        if (w.ability) wi += ` | 기능: ${w.ability}`;
        if (w.range) wi += ` | 사정거리: ${w.range}`;
        if (w.accuracy) wi += ` | 명중: ${w.accuracy}`;
        if (w.attack) wi += ` | 공격력: ${w.attack}`;
        if (w.guard) wi += ` | 가드: ${w.guard}`;
        wi += '\n';
        if (w.description) wi += `>   ${w.description}\n`;
        r += wi;
      }
    }
    
    if (d.armor && d.armor.length > 0) {
      r += `\n${emoji}  **방어구**\n`;
      for (let a of d.armor) {
        let ai = `> ㆍ **${a.name}**`;
        if (a.type) ai += ` (${a.type})`;
        if (a.dodge) ai += ` | 닷지: ${a.dodge}`;
        if (a.action) ai += ` | 행동치: ${a.action}`;
        if (a.defense) ai += ` | 장갑: ${a.defense}`;
        ai += '\n';
        if (a.description) ai += `>   ${a.description}\n`;
        r += ai;
      }
    }
    
    if (d.vehicles && d.vehicles.length > 0) {
      r += `\n${emoji}  **비클**\n`;
      for (let v of d.vehicles) {
        let vi = `> ㆍ **${v.name}**`;
        if (v.type) vi += ` (${v.type})`;
        if (v.ability) vi += ` | 기능: ${v.ability}`;
        if (v.attack) vi += ` | 공격력: ${v.attack}`;
        if (v.action) vi += ` | 행동치: ${v.action}`;
        if (v.defense) vi += ` | 장갑: ${v.defense}`;
        if (v.move) vi += ` | 이동: ${v.move}`;
        vi += '\n';
        if (v.description) vi += `>   ${v.description}\n`;
        r += vi;
      }
    }
    
    if (d.items && d.items.length > 0) {
      r += `\n${emoji}  **아이템**\n`;
      for (let i of d.items) {
        let ii = `> ㆍ **${i.name}**`;
        if (i.type) ii += ` (${i.type})`;
        if (i.ability) ii += ` | 기능: ${i.ability}`;
        ii += '\n';
        if (i.description) ii += `>   ${i.description}\n`;
        r += ii;
      }
    }
    
    if (d.effects && d.effects.length > 0) {
      r += `\n${emoji}  **이펙트**\n`;
      for (let e of d.effects) r += `> ㆍ **${e.name}** | ${e.description}\n`;
    }
    
    if (activeChar.fromSheet) {
      r += `\n📊 *Google Sheets 연동 중*`;
      if (activeChar.sheetName) r += ` (탭: ${activeChar.sheetName})`;
    }
    
    return r;
  }

  async myCharacters(message) {
    const serverId = message.guild.id;
    const userId = message.author.id;
    const all = this.db.getAllCharacters(serverId, userId);
    const active = this.db.getActiveCharacter(serverId, userId);
    if (!all || Object.keys(all).length === 0) return message.reply('📋 등록된 캐릭터가 없습니다.');
    
    let r = `📋 **${message.author.username}님의 캐릭터 목록**\n\n`;
    for (const [name, data] of Object.entries(all)) {
      const isActive = name === active;
      const emoji = data.emoji || '❌';
      const code = data.codeName || '코드네임 없음';
      r += isActive ? `✅ ${emoji} **${name}** 「${code}」 ← 현재 활성\n` : `⚪ ${emoji} **${name}** 「${code}」\n`;
      r += `   💚 HP: ${data.HP || 0} | 🔴 침식률: ${data.침식률 || 0}\n`;
    }
    return message.reply(r);
  }

  async serverCharacters(message) {
    const serverId = message.guild.id;
    const allUsers = this.db.getAllUsers(serverId);
    if (!allUsers || Object.keys(allUsers).length === 0) return message.reply('📋 등록된 캐릭터가 없습니다.');
    
    let r = `📋 **${message.guild.name} 서버의 캐릭터 목록**\n\n`;
    let total = 0;
    for (const [uid, udata] of Object.entries(allUsers)) {
      try {
        const user = await message.guild.members.fetch(uid);
        const active = this.db.getActiveCharacter(serverId, uid);
        if (udata && typeof udata === 'object') {
          const chars = Object.keys(udata).filter(k => typeof udata[k] === 'object' && !k.startsWith('__'));
          if (chars.length > 0) {
            r += `👤 **${user.user.username}**\n`;
            for (const cn of chars) {
              const cd = udata[cn];
              const emoji = cd.emoji || '❌';
              const isActive = cn === active;
              r += isActive ? `   ✅ ${emoji} **${cn}** ← 활성\n` : `   ⚪ ${emoji} ${cn}\n`;
              total++;
            }
            r += '\n';
          }
        }
      } catch (error) {}
    }
    r += `📊 총 **${total}명**`;
    return message.reply(r);
  }

  async deleteCharacter(message, args) {
    const serverId = message.guild.id;
    const userId = message.author.id;
    const regex = /^(?:"([^"]+)"|\[([^\]]+)\]|(\S+))$/;
    const match = args.join(' ').match(regex);
    if (!match) return message.channel.send(formatError('사용법: `!캐릭터삭제 "이름"`'));
    
    const name = match[1] || match[2] || match[3];
    if (!this.db.getCharacter(serverId, userId, name)) return message.channel.send(formatError(`**"${name}"** 캐릭터를 찾을 수 없습니다.`));
    
    this.db.deleteCharacter(serverId, userId, name);
    const combos = this.db.getCombos(serverId, userId, name);
    if (Object.keys(combos).length > 0) {
      for (const cn of Object.keys(combos)) this.db.deleteCombo(serverId, userId, name, cn);
    }
    if (this.db.getActiveCharacter(serverId, userId) === name) this.db.clearActiveCharacter(serverId, userId);
    await this.updateStatusPanel(message.guild, serverId);
    return message.channel.send(formatSuccess(`**"${name}"** 삭제되었습니다.`));
  }

  async updateAttribute(message, attribute, value) {
    const activeChar = await this.getActiveCharacterData(message);
    if (!activeChar) return message.channel.send(formatError('활성화된 캐릭터가 없습니다.'));
    activeChar.data[attribute] = value;
    this.db.setCharacter(activeChar.serverId, activeChar.userId, activeChar.name, activeChar.data);
    return message.channel.send(formatSuccess(`**${activeChar.name}**의 **${attribute}**이(가) **"${value}"**(으)로 설정되었습니다.`));
  }

  async dlois(message, args) {
    const serverId = message.guild.id;
    const userId = message.author.id;
    const active = this.db.getActiveCharacter(serverId, userId);
    if (!active) return message.reply(formatError('활성 캐릭터가 없습니다.'));
    
    const d = this.db.getCharacter(serverId, userId, active);
    if (!d) return message.reply(formatError('캐릭터 데이터를 찾을 수 없습니다.'));
    
    if (args.length === 0) {
      if (!d.dloisFull) return message.reply('📋 D로이스가 설정되지 않았습니다.');
      let r = `📋 **${active}의 D로이스**\n> **${d.dloisFull}**\n`;
      if (d.dloisDesc) r += `> \n> ${d.dloisDesc}`;
      return message.reply(r);
    }
    
    const text = args.join(' ');
    const m = text.match(/^(No\.\s*\d+)\s+(.+)$/i);
    if (!m) return message.reply(formatError('사용법: `!D로 No. 번호 이름`'));
    
    const no = m[1];
    const rest = m[2].trim();
    let name = rest;
    let desc = '';
    if (rest.length > 100) {
      name = rest.substring(0, 50).trim();
      desc = rest.substring(50).trim();
    }
    
    const full = `${no} ${name}`;
    d.dloisFull = full;
    d.dloisDesc = desc;
    this.db.setCharacter(serverId, userId, active, d);
    
    let r = formatSuccess(`**${active}**의 D로이스가 설정되었습니다!`) + '\n> **${full}**\n';
    if (desc) r += `> \n> ${desc}\n`;
    return message.reply(r);
  }

  async autoUpdateSheet(guild, serverId, userId, characterName) {
    console.log(`🔍 [AUTO] autoUpdateSheet: ${characterName}`);
    try {
      const ti = this.db.getCharacterSheetThread(serverId, userId, characterName);
      if (!ti || !ti.threadId) return console.log(`⚠️ [AUTO] 스레드 정보 없음`);
      
      const fid = this.db.getSheetForumChannel(serverId);
      if (!fid) return console.log(`⚠️ [AUTO] 포럼 채널 없음`);
      
      const fc = await guild.channels.fetch(fid);
      if (!fc || fc.type !== 15) return console.log(`⚠️ [AUTO] 포럼 채널 타입 불일치`);
      
      const th = await fc.threads.fetch(ti.threadId);
      if (!th) return console.log(`⚠️ [AUTO] 스레드 없음`);
      
      const cd = this.db.getCharacter(serverId, userId, characterName);
      if (!cd) return console.log(`⚠️ [AUTO] 캐릭터 데이터 없음`);
      
      const ac = { name: characterName, data: cd, fromSheet: false, serverId, userId };
      const content = this.generateSheetContent(ac);
      const msg = await th.messages.fetch(ti.messageId);
      await msg.edit(content);
      console.log(`✅ [AUTO] ${characterName} 시트 업데이트 완료!`);
    } catch (error) {
      console.error('❌ [AUTO] 오류:', error.message);
    }
  }
}

module.exports = CharacterCommands;