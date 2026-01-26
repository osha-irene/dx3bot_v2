/**
 * 캐릭터 시트 확인 및 포럼 게시 모듈
 */

const { convertSyndromeToEnglish } = require('../../utils/helpers');
const config = require('../../config');

class CharacterSheetModule {
  constructor(database, sheetsClient) {
    this.db = database;
    this.sheets = sheetsClient;
  }

  /**
   * 시트 내용 생성
   */
  generateSheetContent(activeChar) {
    const d = activeChar.data;
    const emoji = d.emoji || '';
    const codeName = d.codeName || '코드네임 없음';
    if (!Array.isArray(d.lois)) d.lois = [];
    
    let breed = "브리드 없음";
    if (d.breed) {
      const b = d.breed.toLowerCase();
      if (b === "퓨어" || b === "pure") breed = "PURE";
      else if (b === "크로스" || b === "cross") breed = "CROSS";
      else if (b === "트라이" || b === "tri") breed = "TRI";
    }
    
    let syndromes = d.syndromes ? 
      d.syndromes.split(" × ").map(s => convertSyndromeToEnglish(s, config.syndromeTranslation)) : 
      ["신드롬 없음"];
    
    let r = `${emoji}  **${activeChar.name}** :: **「${codeName}」**\n`;
    r += `> ${d.cover || "커버 없음"}｜${d.works || "웍스 없음"}\n`;
    r += `> ${breed}｜${syndromes.join(" × ")}\n`;
    r += `> ${d.awakening || "각성 없음"}｜${d.impulse || "충동 없음"}\n`;
    r += `> D-Lois｜No.${d.dloisNo || "00"} ${d.dloisName || "D로이스 없음"}\n\n`;
    r += `> **HP** ${d.HP || 0}  |  **침식률** ${d.침식률 || 0}  |  **침식D** ${d.침식D || 0}  |  **로이스** ${d.lois.length}\n`;
    
    // 능력치
    for (let mainAttr of config.mainAttributes) {
      let sub = [];
      let mainVal = d[mainAttr] || 0;
      
      for (let [k, v] of Object.entries(d)) {
        if (config.subToMainMapping[k] === mainAttr) {
          sub.push(`${k}: ${v}`);
        } else {
          for (let p in config.dynamicMappingRules) {
            if (k.startsWith(p) && config.dynamicMappingRules[p] === mainAttr) {
              sub.push(`${k}: ${v}`);
            }
          }
        }
      }
      
      if (sub.length > 0 || mainVal !== 0) {
        r += `>     **【${mainAttr}】**  ${mainVal}   ` + sub.join(' ') + '\n';
      }
    }
    
    // 로이스
    if (d.lois && d.lois.length > 0) {
      r += `\n${emoji}  **로이스**\n`;
      for (let l of d.lois) {
        if (l.isTitus) {
          r += `-# ㆍ~~**${l.name}**~~ | ~~${l.pEmotion}~~ / ~~${l.nEmotion}~~ | ~~${l.description}~~\n`;
        } else {
          r += `ㆍ**${l.name}** | ${l.pEmotion} / ${l.nEmotion} | ${l.description}\n`;
        }
      }
    }
    
    // 메모리
    if (d.memory && d.memory.length > 0) {
      r += `\n${emoji}  **메모리**\n`;
      for (let m of d.memory) {
        r += `ㆍ**${m.name}** | ${m.emotion} | ${m.description}\n`;
      }
    }
    
    // 무기
    if (d.weapons && d.weapons.length > 0) {
      r += `\n${emoji}  **무기**\n`;
      for (let w of d.weapons) {
        r += `ㆍ**${w.name}**\n`;
        let details = `　　`;
        if (w.type) details += `${w.type}`;
        if (w.ability) details += ` | ${w.ability}`;
        if (w.range) details += ` | ${w.range}`;
        if (w.accuracy) details += ` | 명중 ${w.accuracy}`;
        if (w.attack) details += ` | 공격력 ${w.attack}`;
        if (w.guard) details += ` | 가드 ${w.guard}`;
        r += `-# ${details}\n`;
        if (w.description) r += `-# 　${w.description}\n`;
      }
    }
    
    // 방어구
    if (d.armor && d.armor.length > 0) {
      r += `\n${emoji}  **방어구**\n`;
      for (let a of d.armor) {
        r += `ㆍ**${a.name}**\n`;
        let details = `　　`;
        if (a.type) details += `${a.type}`;
        if (a.dodge) details += ` | 닷지 ${a.dodge}`;
        if (a.action) details += ` | 행동치 ${a.action}`;
        if (a.defense) details += ` | 장갑 ${a.defense}`;
        r += `-# ${details}\n`;
        if (a.description) r += `-# 　${a.description}\n`;
      }
    }
    
    // 비클
    if (d.vehicles && d.vehicles.length > 0) {
      r += `\n${emoji}  **비클**\n`;
      for (let v of d.vehicles) {
        r += `ㆍ**${v.name}**\n`;
        let details = `　　`;
        if (v.type) details += `${v.type}`;
        if (v.ability) details += ` | ${v.ability}`;
        if (v.attack) details += ` | 공격력 ${v.attack}`;
        if (v.action) details += ` | 행동치 ${v.action}`;
        if (v.defense) details += ` | 장갑 ${v.defense}`;
        if (v.move) details += ` | 이동 ${v.move}`;
        r += `-# ${details}\n`;
        if (v.description) r += `-# 　${v.description}\n`;
      }
    }
    
    // 아이템
    if (d.items && d.items.length > 0) {
      r += `\n${emoji}  **아이템**\n`;
      for (let i of d.items) {
        r += `ㆍ**${i.name}**\n`;
        let details = `　　`;
        if (i.type) details += `${i.type}`;
        if (i.ability) details += ` | ${i.ability}`;
        r += `-# ${details}\n`;
        if (i.description) r += `-# 　${i.description}\n`;
      }
    }
    
    // 이펙트
    if (d.effects && d.effects.length > 0) {
      const currentErosion = d.침식률 || 0;
      const isKigenShu = d.dloisName && d.dloisName.includes('기원종');
      const { calculateEffectLevel } = require('../../sheetsMapping');
      const effectLevel = calculateEffectLevel(currentErosion, isKigenShu);
      
      r += `\n${emoji}  **이펙트** (침식률 ${currentErosion}, Lv ${effectLevel}${isKigenShu ? ' 기원종' : ''})\n`;
      
      let effectLine = '';
      let effectsInLine = 0;
      const maxPerLine = 4;
      
      for (let effect of d.effects) {
        const currentLevel = parseInt(effect.currentLevel) || 0;
        const maxLevel = parseInt(effect.maxLevel) || 1;
        const displayLevel = Math.min(currentLevel + effectLevel, maxLevel);
        const effectText = `《${effect.name}(${displayLevel})》`;
        
        if (effectsInLine >= maxPerLine) {
          r += effectLine + '\n';
          effectLine = '';
          effectsInLine = 0;
        }
        
        if (effectLine) effectLine += ' + ';
        effectLine += effectText;
        effectsInLine++;
      }
      
      if (effectLine) {
        r += effectLine + '\n';
      }
    }
    
    // 🎯 콤보를 최하단에 배치 (새로운 형식)
    if (d.combos && d.combos.length > 0) {
      r += `\n${emoji}  **콤보**\n`;
      
      for (let combo of d.combos) {
        // 콤보가 객체인지 확인
        if (typeof combo === 'string') {
          // DB에서 가져온 경우 (이름만)
          r += `ㆍ**${combo}**\n`;
          continue;
        }
        
        // 시트에서 읽은 완전한 콤보 데이터
        r += `ㆍ**${combo.name}**\n`;
        
        // 기본 정보 (타이밍, 난이도, 대상, 사거리, 침식)
        let basicInfo = [];
        if (combo.timing) basicInfo.push(combo.timing);
        if (combo.difficulty) basicInfo.push(combo.difficulty);
        if (combo.target) basicInfo.push(combo.target);
        if (combo.range) basicInfo.push(combo.range);
        if (combo.erosion) basicInfo.push(`침식 ${combo.erosion}`);
        
        if (basicInfo.length > 0) {
          r += `${basicInfo.join(' | ')}\n`;
        }
        
        // 99↓ 조건 (인용구로 묶기)
        if (combo.effectList99 || combo.content99) {
          r += `> 99↓: ${combo.effectList99 || ''}\n`;
          if (combo.content99) {
            const lines = combo.content99.split('\n');
            for (const line of lines) {
              if (line.trim()) {
                r += `> ${line.trim()}\n`;
              }
            }
          }
        }
        
        // 100↑ 조건 (인용구로 묶기)
        if (combo.effectList100 || combo.content100) {
          r += `> 100↑: ${combo.effectList100 || ''}\n`;
          if (combo.content100) {
            const lines = combo.content100.split('\n');
            for (const line of lines) {
              if (line.trim()) {
                r += `> ${line.trim()}\n`;
              }
            }
          }
        }
      }
    }
    
    // 시트 연동 상태
    if (activeChar.fromSheet) {
      r += `\n*Google Sheets 연동 중*`;
      if (activeChar.sheetName) r += ` (탭: ${activeChar.sheetName})`;
    }
    
    return r;
  }

  /**
   * 시트 확인 및 포럼 게시
   */
  async checkSheet(message, getActiveCharacterData, formatError) {
    console.log(`\n🔍 [CHECK] ===== 시트확인 시작 =====`);
    
    const activeChar = await getActiveCharacterData(message);
    if (!activeChar) {
      return message.reply(formatError('활성화된 캐릭터가 없습니다.'));
    }
    
    const serverId = message.guild.id;
    const userId = message.author.id;
    const characterName = activeChar.name;
    
    console.log(`🔍 [CHECK] Server: ${serverId}, User: ${userId}, Char: ${characterName}`);
    
    let forumChannelId = this.db.getSheetForumChannel(serverId);
    let forumChannel = null;
    
    // 기존 포럼 채널 찾기
    if (forumChannelId) {
      try {
        forumChannel = await message.guild.channels.fetch(forumChannelId);
        if (forumChannel.type !== 15) {
          forumChannel = null;
          forumChannelId = null;
        }
      } catch (error) {
        forumChannel = null;
        forumChannelId = null;
      }
    }
    
    // 포럼이 없으면 찾거나 생성
    if (!forumChannel) {
      const existingForum = message.guild.channels.cache.find(ch =>
        ch.type === 15 && (ch.name === '캐릭터-시트' || ch.name === 'character-sheets')
      );
      
      if (existingForum) {
        forumChannel = existingForum;
        this.db.setSheetForumChannel(serverId, existingForum.id);
        console.log(`✅ [CHECK] 기존 포럼 채널 찾음: ${existingForum.name}`);
      } else {
        // 포럼 생성 시도
        try {
          forumChannel = await message.guild.channels.create({
            name: '캐릭터-시트',
            type: 15,
            topic: '캐릭터 시트 자동 관리'
          });
          this.db.setSheetForumChannel(serverId, forumChannel.id);
          console.log(`✅ [CHECK] 새 포럼 채널 생성: ${forumChannel.name}`);
        } catch (error) {
          console.error('❌ [CHECK] 포럼 생성 오류:', error);
          return message.reply(
            `❌ **포럼 채널 생성 실패**\n\n` +
            `봇에게 다음 권한이 필요합니다:\n` +
            `• 채널 관리하기 (Manage Channels)\n` +
            `• 스레드 만들기 (Create Public Threads)\n` +
            `• 메시지 보내기 (Send Messages)`
          );
        }
      }
    }
    
    if (!forumChannel) {
      return message.reply(formatError('포럼 채널을 찾을 수 없습니다.'));
    }
    
    const sheetContent = this.generateSheetContent(activeChar);
    const threadInfo = this.db.getCharacterSheetThread(serverId, userId, characterName);
    
    try {
      // 기존 스레드 업데이트
      if (threadInfo && threadInfo.threadId) {
        console.log(`🔍 [CHECK] 기존 스레드 업데이트 시도...`);
        try {
          const thread = await forumChannel.threads.fetch(threadInfo.threadId);
          if (thread) {
            const chunks = this.splitContent(sheetContent);
            
            // 첫 메시지 수정
            const sheetMessage = await thread.messages.fetch(threadInfo.messageId);
            await sheetMessage.edit(chunks[0]);
            console.log(`✅ [CHECK] 첫 메시지 수정 완료`);
            
            // 기존 추가 메시지 삭제
            const allMessages = await thread.messages.fetch({ limit: 100 });
            const oldMessages = allMessages.filter(m =>
              m.author.id === message.client.user.id && m.id !== threadInfo.messageId
            );
            for (const msg of oldMessages.values()) {
              await msg.delete().catch(() => {});
            }
            
            // 새 추가 메시지 전송
            for (let i = 1; i < chunks.length; i++) {
              await thread.send(chunks[i]);
            }
            
            await message.delete().catch(() => {});
            const confirmMsg = await message.channel.send(
              `${activeChar.data.emoji || ''} **${characterName}** 시트 업데이트! <#${thread.id}>`
            );
            setTimeout(() => confirmMsg.delete().catch(() => {}), 5000);
            return;
          }
        } catch (error) {
          console.log(`⚠️ [CHECK] 기존 스레드 없음, 새로 생성`);
        }
      }
      
      // 새 스레드 생성
      console.log(`🔍 [CHECK] 새 스레드 생성 중...`);
      const emoji = activeChar.data.emoji || '';
      const codeName = activeChar.data.codeName || '';
      const threadName = `${emoji} ${characterName} ${codeName ? `「${codeName}」` : ''}`;
      
      const chunks = this.splitContent(sheetContent);
      
      const thread = await forumChannel.threads.create({
        name: threadName.substring(0, 100),
        message: { content: chunks[0] }
      });
      console.log(`✅ [CHECK] 스레드 생성 완료: ${thread.id}`);
      
      // 추가 메시지 전송
      for (let i = 1; i < chunks.length; i++) {
        await thread.send(chunks[i]);
      }
      
      const messages = await thread.messages.fetch({ limit: 1 });
      const firstMessage = messages.first();
      
      this.db.setCharacterSheetThread(serverId, userId, characterName, thread.id, firstMessage.id);
      
      await message.delete().catch(() => {});
      const confirmMsg = await message.channel.send(
        `${emoji} **${characterName}** 시트 스레드 생성! <#${thread.id}>`
      );
      setTimeout(() => confirmMsg.delete().catch(() => {}), 5000);
      
    } catch (error) {
      console.error('❌ [CHECK] 포럼 스레드 오류:', error);
      return message.reply(
        `❌ **포럼 스레드 생성/업데이트 실패**\n\n` +
        `오류: ${error.message}`
      );
    }
  }

  /**
   * 내용을 2000자 단위로 분할
   */
  splitContent(content) {
    if (content.length <= 2000) return [content];
    
    const chunks = [];
    let currentChunk = '';
    const lines = content.split('\n');
    
    for (const line of lines) {
      if ((currentChunk + line + '\n').length > 1900) {
        chunks.push(currentChunk);
        currentChunk = line + '\n';
      } else {
        currentChunk += line + '\n';
      }
    }
    
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
  }

  /**
   * 포럼 시트 자동 업데이트
   */
  async autoUpdateSheet(guild, serverId, userId, characterName) {
    try {
      const threadInfo = this.db.getCharacterSheetThread(serverId, userId, characterName);
      if (!threadInfo || !threadInfo.threadId) return;
      
      const forumChannelId = this.db.getSheetForumChannel(serverId);
      if (!forumChannelId) return;
      
      const forumChannel = await guild.channels.fetch(forumChannelId);
      if (!forumChannel || forumChannel.type !== 15) return;
      
      const thread = await forumChannel.threads.fetch(threadInfo.threadId);
      if (!thread) return;
      
      const characterData = this.db.getCharacter(serverId, userId, characterName);
      if (!characterData) return;
      
      const activeChar = { name: characterName, data: characterData, fromSheet: false, serverId, userId };
      const content = this.generateSheetContent(activeChar);
      
      const message = await thread.messages.fetch(threadInfo.messageId);
      await message.edit(content);
      
      console.log(`✅ [AUTO] ${characterName} 시트 자동 업데이트 완료!`);
    } catch (error) {
      console.error('❌ [AUTO] 오류 발생:', error.message);
    }
  }
}

module.exports = CharacterSheetModule;