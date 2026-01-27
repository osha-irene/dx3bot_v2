/**
 * 캐릭터 시트 확인 및 포럼 게시 모듈
 * sheetsMapping.js 기반으로 완전히 재작성
 */

const { convertSyndromeToEnglish } = require('../../utils/helpers');
const config = require('../../config/config');
const { calculateEffectLevel } = require('../../lib/sheetsMapping');

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
    
    // 브리드 변환
    let breed = "브리드 없음";
    if (d.breed) {
      const b = d.breed.toLowerCase();
      if (b === "퓨어" || b === "pure") breed = "PURE";
      else if (b === "크로스" || b === "cross") breed = "CROSS";
      else if (b === "트라이" || b === "tri") breed = "TRI";
    }
    
    // 신드롬 변환
    let syndromes = d.syndromes ? 
      d.syndromes.split(" × ").map(s => convertSyndromeToEnglish(s, config.syndromeTranslation)) : 
      ["신드롬 없음"];
    
    // 헤더 정보
    let r = `${emoji}  **${activeChar.name}** :: **「${codeName}」**\n`;
    r += `> ${d.cover || "커버 없음"}｜${d.works || "웍스 없음"}\n`;
    r += `> ${breed}｜${syndromes.join(" × ")}\n`;
    r += `> ${d.awakening || "각성 없음"}｜${d.impulse || "충동 없음"}\n`;
    r += `> D-Lois｜No.${d.dloisNo || "00"} ${d.dloisName || "D로이스 없음"}\n\n`;
    r += `> **HP** ${d.HP || 0}  |  **침식률** ${d.침식률 || 0}  |  **침식D** ${d.침식D || 0}  |  **로이스** ${d.lois.length}\n`;
    
    // 능력치 (상위 항목 + 하위 항목)
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
        let details = [];
        if (w.type) details.push(w.type);
        if (w.ability) details.push(w.ability);
        if (w.range) details.push(`사정거리 ${w.range}`);
        if (w.accuracy) details.push(`명중 ${w.accuracy}`);
        if (w.attack) details.push(`공격력 ${w.attack}`);
        if (w.guard) details.push(`가드 ${w.guard}`);
        
        if (details.length > 0) {
          r += `-# 　${details.join(' | ')}\n`;
        }
        if (w.description) {
          r += `-# 　${w.description}\n`;
        }
      }
    }
    
    // 방어구
    if (d.armor && d.armor.length > 0) {
      r += `\n${emoji}  **방어구**\n`;
      for (let a of d.armor) {
        r += `ㆍ**${a.name}**\n`;
        let details = [];
        if (a.type) details.push(a.type);
        if (a.dodge) details.push(`닷지 ${a.dodge}`);
        if (a.action) details.push(`행동치 ${a.action}`);
        if (a.defense) details.push(`장갑 ${a.defense}`);
        
        if (details.length > 0) {
          r += `-# 　${details.join(' | ')}\n`;
        }
        if (a.description) {
          r += `-# 　${a.description}\n`;
        }
      }
    }
    
    // 비클
    if (d.vehicles && d.vehicles.length > 0) {
      r += `\n${emoji}  **비클**\n`;
      for (let v of d.vehicles) {
        r += `ㆍ**${v.name}**\n`;
        let details = [];
        if (v.type) details.push(v.type);
        if (v.ability) details.push(v.ability);
        if (v.attack) details.push(`공격력 ${v.attack}`);
        if (v.action) details.push(`행동치 ${v.action}`);
        if (v.defense) details.push(`장갑 ${v.defense}`);
        if (v.move) details.push(`이동 ${v.move}`);
        
        if (details.length > 0) {
          r += `-# 　${details.join(' | ')}\n`;
        }
        if (v.description) {
          r += `-# 　${v.description}\n`;
        }
      }
    }
    
    // 아이템
    if (d.items && d.items.length > 0) {
      r += `\n${emoji}  **아이템**\n`;
      for (let i of d.items) {
        r += `ㆍ**${i.name}**\n`;
        let details = [];
        if (i.type) details.push(i.type);
        if (i.ability) details.push(i.ability);
        
        if (details.length > 0) {
          r += `-# 　${details.join(' | ')}\n`;
        }
        if (i.description) {
          r += `-# 　${i.description}\n`;
        }
      }
    }
    
    // 이펙트
    if (d.effects && d.effects.length > 0) {
      const currentErosion = d.침식률 || 0;
      const isKigenShu = d.dloisName && d.dloisName.includes('기원종');
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
    
    // 콤보
    if (d.combos && d.combos.length > 0) {
      r += `\n${emoji}  **콤보**\n`;
      
      for (let combo of d.combos) {
        if (typeof combo === 'string') {
          r += `ㆍ**${combo}**\n`;
          continue;
        }
        
        r += `ㆍ**${combo.name}**\n`;
        
        // 기본 정보 (타이밍, 기능, 난이도, 대상, 사정거리, 제한, 침식)
        let basicInfo = [];
        if (combo.timing) basicInfo.push(combo.timing);
        if (combo.skill) basicInfo.push(combo.skill);
        if (combo.difficulty) basicInfo.push(combo.difficulty);
        if (combo.target) basicInfo.push(combo.target);
        if (combo.range) basicInfo.push(combo.range);
        if (combo.restriction) basicInfo.push(combo.restriction);
        if (combo.erosion) basicInfo.push(`침식 ${combo.erosion}`);
        
        if (basicInfo.length > 0) {
          r += `${basicInfo.join(' | ')}\n`;
        }
        
        // 99↓ 조건
        if (combo.effectList99 || combo.content99) {
          r += `> **99↓**: ${combo.effectList99 || ''}\n`;
          if (combo.content99) {
            const lines = combo.content99.split('\n');
            for (const line of lines) {
              if (line.trim()) {
                r += `> ${line.trim()}\n`;
              }
            }
          }
          // 다이스, 크리티컬, 공격력
          let stats99 = [];
          if (combo.dice99) stats99.push(`+${combo.dice99}dx`);
          if (combo.critical99) stats99.push(`크리티컬 ${combo.critical99}`);
          if (combo.attack99) stats99.push(`공격력 ${combo.attack99}`);
          if (stats99.length > 0) {
            r += `> ${stats99.join(' | ')}\n`;
          }
        }
        
        // 100↑ 조건
        if (combo.effectList100 || combo.content100) {
          r += `> **100↑**: ${combo.effectList100 || ''}\n`;
          if (combo.content100) {
            const lines = combo.content100.split('\n');
            for (const line of lines) {
              if (line.trim()) {
                r += `> ${line.trim()}\n`;
              }
            }
          }
          // 다이스, 크리티컬, 공격력
          let stats100 = [];
          if (combo.dice100) stats100.push(`+${combo.dice100}dx`);
          if (combo.critical100) stats100.push(`크리티컬 ${combo.critical100}`);
          if (combo.attack100) stats100.push(`공격력 ${combo.attack100}`);
          if (stats100.length > 0) {
            r += `> ${stats100.join(' | ')}\n`;
          }
        }
        
        r += '\n'; // 콤보 간 간격
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
            
            console.log(`🗑️ [UPDATE] ${oldMessages.size}개의 기존 추가 메시지 삭제 중...`);
            for (const msg of oldMessages.values()) {
              await msg.delete().catch((err) => {
                console.error(`메시지 삭제 실패: ${err.message}`);
              });
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // 새 추가 메시지 전송
            if (chunks.length > 1) {
              console.log(`📤 [UPDATE] ${chunks.length - 1}개의 새 메시지 전송 중...`);
              for (let i = 1; i < chunks.length; i++) {
                await thread.send(chunks[i]);
                console.log(`   ✅ [${i}/${chunks.length - 1}] 전송 완료 (${chunks[i].length}자)`);
                await new Promise(resolve => setTimeout(resolve, 200));
              }
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
      console.log(`📝 [CREATE] ${chunks.length}개의 청크로 분할됨`);
      
      const thread = await forumChannel.threads.create({
        name: threadName.substring(0, 100),
        message: { content: chunks[0] }
      });
      console.log(`✅ [CHECK] 스레드 생성 완료: ${thread.id}`);
      
      // 추가 메시지 전송
      if (chunks.length > 1) {
        console.log(`📤 [CREATE] ${chunks.length - 1}개의 추가 메시지 전송 중...`);
        for (let i = 1; i < chunks.length; i++) {
          await thread.send(chunks[i]);
          console.log(`   ✅ [${i}/${chunks.length - 1}] 전송 완료`);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
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
   * 내용을 2000자 단위로 분할 (개선된 버전)
   */
  splitContent(content) {
    const MAX_LENGTH = 1900;
    
    if (content.length <= MAX_LENGTH) {
      return [content];
    }
    
    const chunks = [];
    let currentChunk = '';
    const lines = content.split('\n');
    
    for (const line of lines) {
      const testChunk = currentChunk + line + '\n';
      
      if (testChunk.length > MAX_LENGTH) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = line + '\n';
      } else {
        currentChunk = testChunk;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    console.log(`📝 [SPLIT] 콘텐츠를 ${chunks.length}개로 분할 (총 ${content.length}자)`);
    chunks.forEach((chunk, i) => {
      console.log(`   [${i + 1}] ${chunk.length}자`);
    });
    
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
      
      const chunks = this.splitContent(content);
      
      const message = await thread.messages.fetch(threadInfo.messageId);
      await message.edit(chunks[0]);
      
      // 추가 메시지 처리
      if (chunks.length > 1) {
        const allMessages = await thread.messages.fetch({ limit: 100 });
        const oldMessages = allMessages.filter(m =>
          m.author.id === message.author.id && m.id !== threadInfo.messageId
        );
        
        for (const msg of oldMessages.values()) {
          await msg.delete().catch(() => {});
        }
        
        for (let i = 1; i < chunks.length; i++) {
          await thread.send(chunks[i]);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      console.log(`✅ [AUTO] ${characterName} 시트 자동 업데이트 완료!`);
    } catch (error) {
      console.error('❌ [AUTO] 오류 발생:', error.message);
    }
  }
}

module.exports = CharacterSheetModule;