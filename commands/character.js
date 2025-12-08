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
    
    // 🆕 먼저 활성 캐릭터 확인
    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    if (!activeCharName) return null;
    
    // 🆕 활성 캐릭터의 시트 정보 확인
    const sheetInfo = this.db.getCharacterSheet(serverId, userId, activeCharName);
    
    if (sheetInfo && sheetInfo.spreadsheetId && this.sheets) {
      try {
        console.log(`📊 [getActiveCharacterData] 시트에서 ${activeCharName} 읽기 중...`);
        const data = await this.sheets.readFullCharacter(sheetInfo.spreadsheetId, sheetInfo.sheetName);
        if (data && data.characterName) {
          // 🔥 DB에 저장된 emoji 보존
          const dbData = this.db.getCharacter(serverId, userId, data.characterName);
          if (dbData && dbData.emoji) {
            data.emoji = dbData.emoji;
          }
          
          // 🔥 이펙트 읽기
          try {
            const effects = await this.sheets.readEffects(sheetInfo.spreadsheetId, sheetInfo.sheetName);
            data.effects = effects;
          } catch (error) {
            console.error('이펙트 읽기 오류:', error);
            data.effects = [];
          }
          
          // 🔥 콤보 목록 읽기
          try {
            const combos = await this.sheets.readCombos(sheetInfo.spreadsheetId, sheetInfo.sheetName);
            data.combos = combos.map(c => c.name); // 이름만 저장
          } catch (error) {
            console.error('콤보 읽기 오류:', error);
            data.combos = [];
          }
          
          console.log(`✅ [getActiveCharacterData] ${data.characterName} 시트 읽기 완료`);
          return { name: data.characterName, data, fromSheet: true, spreadsheetId: sheetInfo.spreadsheetId, sheetName: sheetInfo.sheetName, serverId, userId };
        }
      } catch (error) {
        console.error('시트 읽기 오류:', error);
      }
    }

    // 시트 연동이 안 되어 있으면 DB에서 가져오기
    const data = this.db.getCharacter(serverId, userId, activeCharName);
    if (!data) return null;
    console.log(`💾 [getActiveCharacterData] ${activeCharName} DB에서 읽기`);
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
    let characterData = this.db.getCharacter(serverId, userId, characterName);
    if (!characterData) return message.channel.send(formatError(`캐릭터 "${characterName}"를 찾을 수 없습니다.`));
    
    // 🆕 시트 연동 캐릭터면 자동으로 시트 동기화
    const sheetInfo = this.db.getCharacterSheet(serverId, userId, characterName);
    if (sheetInfo && this.sheets) {
      try {
        console.log(`🔄 [지정] 시트 연동 캐릭터 발견: ${characterName}, 시트 동기화 중...`);
        const updatedData = await this.sheets.readFullCharacter(sheetInfo.spreadsheetId, sheetInfo.sheetName);
        if (updatedData && updatedData.characterName) {
          characterData = updatedData;
          this.db.setCharacter(serverId, userId, characterName, characterData);
          console.log(`✅ [지정] 시트 동기화 완료`);
        }
      } catch (error) {
        console.error(`❌ [지정] 시트 동기화 실패:`, error.message);
        // 동기화 실패해도 기존 데이터로 진행
      }
    }
    
    this.db.setActiveCharacter(serverId, userId, characterName);
    const emoji = characterData.emoji || '✅';
    const codeName = characterData.codeName || '';
    const sheetIcon = sheetInfo ? '📊 ' : '';
    const replyMsg = await message.reply(`${emoji} **${characterName}** ${codeName ? `「${codeName}」` : ''} 활성화!${sheetInfo ? ' (시트 연동 ✨)' : ''}\n💚 HP: ${characterData.HP || 0} | 🔴 침식률: ${characterData.침식률 || 0}`);
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
    console.log(`\n🔍 [CHECK] ===== 시트확인 시작 =====`);
    const activeChar = await this.getActiveCharacterData(message);
    if (!activeChar) return message.reply(formatError('활성화된 캐릭터가 없습니다.'));
    
    const serverId = message.guild.id;
    const userId = message.author.id;
    const characterName = activeChar.name;
    
    console.log(`🔍 [CHECK] Server ID: ${serverId}`);
    console.log(`🔍 [CHECK] User ID: ${userId}`);
    console.log(`🔍 [CHECK] Character Name: ${characterName}`);
    
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
          
          // 권한 부족 시 안내 메시지
          return message.reply(
            `❌ **포럼 채널 생성 실패**\n\n` +
            `봇에게 다음 권한이 필요합니다:\n` +
            `• 채널 관리하기 (Manage Channels)\n` +
            `• 스레드 만들기 (Create Public Threads)\n` +
            `• 메시지 보내기 (Send Messages)\n\n` +
            `**해결 방법:**\n` +
            `1. 서버 설정 → 역할 → DX3bot 역할에 위 권한 부여\n` +
            `2. 또는 직접 "캐릭터-시트" 포럼 채널을 만들어주세요!\n` +
            `   (채널 만들기 → 포럼 선택)`
          );
        }
      }
    }
    
    // 포럼이 정상적으로 확보되었는지 확인
    if (!forumChannel) {
      return message.reply(formatError('포럼 채널을 찾을 수 없습니다. 서버 관리자에게 문의하세요.'));
    }
    
    const sheetContent = this.generateSheetContent(activeChar);
    const threadInfo = this.db.getCharacterSheetThread(serverId, userId, characterName);
    
    console.log(`🔍 [CHECK] 기존 스레드 정보:`, threadInfo);
    
    try {
      // 기존 스레드 업데이트
      if (threadInfo && threadInfo.threadId) {
        console.log(`🔍 [CHECK] 기존 스레드 업데이트 시도...`);
        try {
          const thread = await forumChannel.threads.fetch(threadInfo.threadId);
          if (thread) {
            // 2000자 제한 처리
            let firstMessageContent = sheetContent;
            let additionalMessages = [];
            
            if (sheetContent.length > 2000) {
              console.log(`⚠️ [CHECK] 시트 내용이 2000자 초과 (${sheetContent.length}자), 분할 중...`);
              const chunks = [];
              let currentChunk = '';
              const lines = sheetContent.split('\n');
              
              for (const line of lines) {
                if ((currentChunk + line + '\n').length > 1900) {
                  chunks.push(currentChunk);
                  currentChunk = line + '\n';
                } else {
                  currentChunk += line + '\n';
                }
              }
              if (currentChunk) chunks.push(currentChunk);
              
              firstMessageContent = chunks[0];
              additionalMessages = chunks.slice(1);
              console.log(`✅ [CHECK] ${chunks.length}개 청크로 분할 완료`);
            }
            
            // 첫 메시지 수정
            const sheetMessage = await thread.messages.fetch(threadInfo.messageId);
            await sheetMessage.edit(firstMessageContent);
            console.log(`✅ [CHECK] 첫 메시지 수정 완료`);
            
            // 기존 추가 메시지 삭제
            const allMessages = await thread.messages.fetch({ limit: 100 });
            const oldMessages = allMessages.filter(m => 
              m.author.id === message.client.user.id && m.id !== threadInfo.messageId
            );
            for (const msg of oldMessages.values()) {
              await msg.delete().catch(() => {});
            }
            console.log(`✅ [CHECK] 기존 추가 메시지 ${oldMessages.size}개 삭제 완료`);
            
            // 새 추가 메시지 전송
            for (let i = 0; i < additionalMessages.length; i++) {
              await thread.send(additionalMessages[i]);
              console.log(`✅ [CHECK] 추가 메시지 ${i + 1}/${additionalMessages.length} 전송 완료`);
            }
            
            await message.delete().catch(() => {});
            const confirmMsg = await message.channel.send(
              `${activeChar.data.emoji || '📋'} **${characterName}** 시트 업데이트!\n📍 <#${thread.id}>`
            );
            setTimeout(() => confirmMsg.delete().catch(() => {}), 5000);
            console.log(`✅ [CHECK] 기존 스레드 업데이트 완료`);
            console.log(`🔍 [CHECK] ===== 시트확인 끝 =====\n`);
            return;
          }
        } catch (error) {
          console.log(`⚠️ [CHECK] 기존 스레드 없음, 새로 생성`);
        }
      }
      
      // 새 스레드 생성
      console.log(`🔍 [CHECK] 새 스레드 생성 중...`);
      const emoji = activeChar.data.emoji || '📋';
      const codeName = activeChar.data.codeName || '';
      const threadName = `${emoji} ${characterName} ${codeName ? `「${codeName}」` : ''}`;
      
      console.log(`🔍 [CHECK] 스레드 이름: ${threadName}`);
      
      // 2000자 제한 처리
      let firstMessageContent = sheetContent;
      let additionalMessages = [];
      
      if (sheetContent.length > 2000) {
        console.log(`⚠️ [CHECK] 시트 내용이 2000자 초과 (${sheetContent.length}자), 분할 중...`);
        const chunks = [];
        let currentChunk = '';
        const lines = sheetContent.split('\n');
        
        for (const line of lines) {
          if ((currentChunk + line + '\n').length > 1900) {
            chunks.push(currentChunk);
            currentChunk = line + '\n';
          } else {
            currentChunk += line + '\n';
          }
        }
        if (currentChunk) chunks.push(currentChunk);
        
        firstMessageContent = chunks[0];
        additionalMessages = chunks.slice(1);
        console.log(`✅ [CHECK] ${chunks.length}개 청크로 분할 완료`);
      }
      
      const thread = await forumChannel.threads.create({ 
        name: threadName.substring(0, 100), 
        message: { content: firstMessageContent } 
      });
      console.log(`✅ [CHECK] 스레드 생성 완료: ${thread.id}`);
      
      // 추가 메시지 전송
      for (let i = 0; i < additionalMessages.length; i++) {
        await thread.send(additionalMessages[i]);
        console.log(`✅ [CHECK] 추가 메시지 ${i + 1}/${additionalMessages.length} 전송 완료`);
      }
      
      const messages = await thread.messages.fetch({ limit: 1 });
      const firstMessage = messages.first();
      console.log(`✅ [CHECK] 첫 메시지 ID: ${firstMessage.id}`);
      
      console.log(`🔍 [CHECK] DB에 저장 중...`);
      this.db.setCharacterSheetThread(serverId, userId, characterName, thread.id, firstMessage.id);
      console.log(`✅ [CHECK] DB 저장 완료!`);
      
      await message.delete().catch(() => {});
      const confirmMsg = await message.channel.send(
        `${emoji} **${characterName}** 시트 스레드 생성!\n📍 <#${thread.id}>`
      );
      setTimeout(() => confirmMsg.delete().catch(() => {}), 5000);
      console.log(`🔍 [CHECK] ===== 시트확인 끝 =====\n`);
      
    } catch (error) {
      console.error('❌ [CHECK] 포럼 스레드 오류:', error);
      console.log(`🔍 [CHECK] ===== 시트확인 끝 (오류) =====\n`);
      
      return message.reply(
        `❌ **포럼 스레드 생성/업데이트 실패**\n\n` +
        `오류: ${error.message}\n\n` +
        `봇에게 다음 권한이 있는지 확인해주세요:\n` +
        `• 스레드 만들기\n` +
        `• 메시지 보내기\n` +
        `• 메시지 관리하기`
      );
    }
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
      for (let l of d.lois) {
        if (l.isTitus) {
          // 타이터스: 옅은 색 + 취소선
          r += `-# ㆍ~~**${l.name}**~~ | ~~${l.pEmotion}~~ / ~~${l.nEmotion}~~ | ~~${l.description}~~\n`;
        } else {
          r += `ㆍ**${l.name}** | ${l.pEmotion} / ${l.nEmotion} | ${l.description}\n`;
        }
      }
    }
    
    if (d.memory && d.memory.length > 0) {
      r += `\n${emoji}  **메모리**\n`;
      for (let m of d.memory) r += `ㆍ**${m.name}** | ${m.emotion} | ${m.description}\n`;
    }
    
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
    
    if (d.effects && d.effects.length > 0) {
      // 이펙트 레벨 계산
      const currentErosion = d.침식률 || 0;
      const isKigenShu = d.dloisName && d.dloisName.includes('기원종');
      const { calculateEffectLevel } = require('../sheetsMapping');
      const effectLevel = calculateEffectLevel(currentErosion, isKigenShu);
      
      r += `\n${emoji}  **이펙트** (침식률 ${currentErosion}, Lv ${effectLevel}${isKigenShu ? ' 기원종' : ''})\n`;
      
      let effectLine = '';
      let effectsInLine = 0;
      const maxPerLine = 4; // 한 줄에 최대 4개
      
      for (let e of d.effects) {
        // Lv 0/0인 빈 이펙트 제외
        if (e.maxLevel === 0 && e.currentLevel === 0) continue;
        
        let effectText = '';
        if (e.currentLevel !== undefined) {
          // 시트에서 읽어온 이펙트
          effectText = `${e.name} Lv ${e.currentLevel}`;
        } else {
          // DB에 저장된 간단한 이펙트
          effectText = `${e.name}`;
        }
        
        // 4개마다 줄바꿈
        if (effectsInLine >= maxPerLine) {
          r += effectLine + '\n';
          effectLine = '';
          effectsInLine = 0;
        }
        
        if (effectsInLine > 0) {
          effectLine += ' | ';
        }
        effectLine += effectText;
        effectsInLine++;
      }
      
      // 마지막 줄 추가
      if (effectsInLine > 0) {
        r += effectLine + '\n';
      }
    }
    
    // 콤보 목록 (시트에서 읽기)
    if (activeChar.fromSheet && activeChar.spreadsheetId && d.combos && d.combos.length > 0) {
      r += `\n${emoji}  **콤보**\n`;
      
      for (let combo of d.combos) {
        r += `ㆍ**${combo}**\n`;
      }
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

  /**
   * !컬러 [HEX코드] - Embed 컬러 설정
   */
  async setEmbedColor(message, args) {
    if (args.length === 0) {
      return message.channel.send('❌ 사용법: `!컬러 [HEX코드]`\n예시: `!컬러 FF5733` 또는 `!컬러 #FF5733`');
    }

    const activeChar = await this.getActiveCharacterData(message);
    if (!activeChar) {
      return message.channel.send(formatError('활성화된 캐릭터가 없습니다. `!지정 [캐릭터 이름]` 명령어로 캐릭터를 지정해주세요.'));
    }

    let colorCode = args[0].replace('#', '').toUpperCase();
    
    // HEX 코드 검증
    if (!/^[0-9A-F]{6}$/.test(colorCode)) {
      return message.channel.send(formatError('올바른 HEX 색상 코드를 입력해주세요. (예: FF5733 또는 #FF5733)'));
    }

    activeChar.data.embedColor = colorCode;
    this.db.setCharacter(activeChar.serverId, activeChar.userId, activeChar.name, activeChar.data);

    // 미리보기 Embed 생성
    const { EmbedBuilder } = require('discord.js');
    const previewEmbed = new EmbedBuilder()
      .setColor(parseInt(colorCode, 16))
      .setTitle(`${activeChar.name}의 Embed 컬러`)
      .setDescription(`컬러 코드: #${colorCode}\n이제 콤보와 이펙트 Embed에 이 색상이 적용됩니다!`);

    return message.channel.send({ embeds: [previewEmbed] });
  }

  /**
   * !콤보확인 - 현재 캐릭터의 콤보 목록 표시
   */
  async checkCombos(message) {
    const activeChar = await this.getActiveCharacterData(message);
    if (!activeChar) {
      return message.reply(formatError('활성화된 캐릭터가 없습니다. `!지정 [캐릭터 이름]` 명령어로 캐릭터를 지정해주세요.'));
    }

    // 시트 연동 확인
    if (!activeChar.fromSheet || !activeChar.spreadsheetId || !this.sheets) {
      return message.reply(formatError('콤보 기능은 시트 연동 캐릭터만 사용할 수 있습니다. `!시트등록`을 먼저 해주세요.'));
    }

    try {
      // 시트에서 콤보 읽기
      const combos = await this.sheets.readCombos(activeChar.spreadsheetId, activeChar.sheetName);
      
      if (!combos || combos.length === 0) {
        return message.channel.send(formatError('등록된 콤보가 없습니다. 시트의 196~237행을 확인해주세요.'));
      }

      const emoji = activeChar.data.emoji || '⚔️';
      const currentErosion = activeChar.data.침식률 || 0;
      
      let response = `${emoji}  **${activeChar.name}의 콤보 목록** (침식률 ${currentErosion})\n\n`;
      
      for (let combo of combos) {
        const has99 = combo['99↓'] && combo['99↓'].effectList;
        const has100 = combo['100↑'] && combo['100↑'].effectList;
        
        if (has99 || has100) {
          response += `> **${combo.name}**\n`;
          if (has99) response += `> 　99↓ 침식 ${combo.erosion || '-'}\n`;
          if (has100) response += `> 　100↑ 침식 ${combo.erosion || '-'}\n`;
          response += `>\n`;
        }
      }
      
      response += `\n💡 콤보 사용: \`!@콤보이름\``;
      
      return message.channel.send(response);
      
    } catch (error) {
      console.error('콤보 확인 오류:', error);
      return message.channel.send(formatError('콤보를 불러오는 중 오류가 발생했습니다.'));
    }
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
    
    // 시트 자동 업데이트
    let sheetUpdated = false;
    const sheetInfo = this.db.getUserSheet(serverId, userId);
    if (this.sheets && sheetInfo) {
      try {
        const { SHEET_MAPPING } = require('../sheetsMapping');
        await this.sheets.writeCell(sheetInfo.spreadsheetId, SHEET_MAPPING.dlois.noAndNameCell, full, sheetInfo.sheetName);
        if (desc) {
          await this.sheets.writeCell(sheetInfo.spreadsheetId, SHEET_MAPPING.dlois.descCell, desc, sheetInfo.sheetName);
        }
        sheetUpdated = true;
      } catch (error) {
        console.error('시트 D로이스 업데이트 오류:', error);
      }
    }
    
    let r = formatSuccess(`**${active}**의 D로이스가 설정되었습니다!`) + `\n> **${full}**\n`;
    if (desc) r += `> \n> ${desc}\n`;
    if (sheetUpdated) r += `\n📊 시트가 자동으로 업데이트되었습니다!`;
    return message.reply(r);
  }

  async autoUpdateSheet(guild, serverId, userId, characterName) {
    console.log(`\n🔍 [AUTO] ===== autoUpdateSheet 시작 =====`);
    console.log(`   - Guild: ${guild ? guild.name : 'NULL'}`);
    console.log(`   - Server ID: ${serverId}`);
    console.log(`   - User ID: ${userId}`);
    console.log(`   - Character Name: ${characterName}`);
    console.log(`   - Database 인스턴스: ${this.db ? 'EXISTS' : 'NULL'}`);
    console.log(`   - Database cache 키: ${this.db && this.db.cache ? Object.keys(this.db.cache).join(', ') : 'NONE'}`);
    
    try {
      console.log(`🔍 [AUTO] 1. 스레드 정보 조회 중...`);
      const ti = this.db.getCharacterSheetThread(serverId, userId, characterName);
      console.log(`🔍 [AUTO] 스레드 정보:`, JSON.stringify(ti));
      
      // DB 내부 데이터 구조 확인
      console.log(`🔍 [AUTO] DB 내부 확인:`);
      console.log(`   - cache.data 존재: ${this.db.cache.data ? 'YES' : 'NO'}`);
      if (this.db.cache.data && this.db.cache.data[serverId]) {
        console.log(`   - 서버 데이터 존재: YES`);
        if (this.db.cache.data[serverId][userId]) {
          console.log(`   - 유저 데이터 존재: YES`);
          if (this.db.cache.data[serverId][userId][characterName]) {
            console.log(`   - 캐릭터 데이터 존재: YES`);
            console.log(`   - sheetThread:`, this.db.cache.data[serverId][userId][characterName].sheetThread);
          } else {
            console.log(`   - 캐릭터 데이터 존재: NO`);
            console.log(`   - 사용 가능한 캐릭터들:`, Object.keys(this.db.cache.data[serverId][userId]));
          }
        } else {
          console.log(`   - 유저 데이터 존재: NO`);
        }
      } else {
        console.log(`   - 서버 데이터 존재: NO`);
      }
      
      if (!ti || !ti.threadId) {
        console.log(`⚠️ [AUTO] 스레드 정보 없음 - 업데이트 스킵`);
        console.log(`🔍 [AUTO] ===== autoUpdateSheet 끝 (스레드 없음) =====\n`);
        return;
      }
      
      console.log(`🔍 [AUTO] 2. 포럼 채널 ID 조회 중...`);
      const fid = this.db.getSheetForumChannel(serverId);
      console.log(`🔍 [AUTO] 포럼 채널 ID: ${fid}`);
      
      if (!fid) {
        console.log(`⚠️ [AUTO] 포럼 채널 ID 없음 - 업데이트 스킵`);
        console.log(`🔍 [AUTO] ===== autoUpdateSheet 끝 (포럼 없음) =====\n`);
        return;
      }
      
      console.log(`🔍 [AUTO] 3. 포럼 채널 fetch 중...`);
      const fc = await guild.channels.fetch(fid);
      console.log(`🔍 [AUTO] 포럼 채널:`, fc ? `${fc.name} (type: ${fc.type})` : 'NULL');
      
      if (!fc || fc.type !== 15) {
        console.log(`⚠️ [AUTO] 포럼 채널 타입 불일치 - 업데이트 스킵`);
        console.log(`🔍 [AUTO] ===== autoUpdateSheet 끝 (타입 불일치) =====\n`);
        return;
      }
      
      console.log(`🔍 [AUTO] 4. 스레드 fetch 중... (ID: ${ti.threadId})`);
      const th = await fc.threads.fetch(ti.threadId);
      console.log(`🔍 [AUTO] 스레드:`, th ? `${th.name}` : 'NULL');
      
      if (!th) {
        console.log(`⚠️ [AUTO] 스레드 없음 - 업데이트 스킵`);
        console.log(`🔍 [AUTO] ===== autoUpdateSheet 끝 (스레드 fetch 실패) =====\n`);
        return;
      }
      
      console.log(`🔍 [AUTO] 5. 캐릭터 데이터 조회 중...`);
      const cd = this.db.getCharacter(serverId, userId, characterName);
      console.log(`🔍 [AUTO] 캐릭터 데이터:`, cd ? `HP: ${cd.HP}, 침식률: ${cd.침식률}` : 'NULL');
      
      if (!cd) {
        console.log(`⚠️ [AUTO] 캐릭터 데이터 없음 - 업데이트 스킵`);
        console.log(`🔍 [AUTO] ===== autoUpdateSheet 끝 (데이터 없음) =====\n`);
        return;
      }
      
      console.log(`🔍 [AUTO] 6. activeChar 객체 생성 중...`);
      const ac = { name: characterName, data: cd, fromSheet: false, serverId, userId };
      console.log(`✅ [AUTO] activeChar 객체 생성 완료`);
      
      console.log(`🔍 [AUTO] 7. 시트 내용 생성 중...`);
      const content = this.generateSheetContent(ac);
      console.log(`✅ [AUTO] 시트 내용 생성 완료 (길이: ${content.length}자)`);
      
      console.log(`🔍 [AUTO] 8. 메시지 fetch 중... (ID: ${ti.messageId})`);
      const msg = await th.messages.fetch(ti.messageId);
      console.log(`✅ [AUTO] 메시지 fetch 완료`);
      
      console.log(`🔍 [AUTO] 9. 메시지 수정 중...`);
      await msg.edit(content);
      console.log(`✅ [AUTO] 메시지 수정 완료!`);
      
      console.log(`✅ [AUTO] ${characterName} 시트 자동 업데이트 완료!`);
      console.log(`🔍 [AUTO] ===== autoUpdateSheet 끝 (성공) =====\n`);
    } catch (error) {
      console.error('❌ [AUTO] 오류 발생:', error.message);
      console.error('❌ [AUTO] 스택:', error.stack);
      console.log(`🔍 [AUTO] ===== autoUpdateSheet 끝 (오류) =====\n`);
    }
  }
}

module.exports = CharacterCommands;