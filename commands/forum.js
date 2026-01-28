/**
 * 포럼 관련 명령어
 * 캐릭터 시트 포럼 게시판 관리
 */

const { ChannelType } = require('discord.js');
const { formatError, formatSuccess, formatWarning } = require('../utils/helpers');

class ForumCommands {
  constructor(database, client) {
    this.db = database;
    this.client = client;
  }

  /**
   * !포럼설정 [채널멘션 또는 ID] - 캐릭터 시트 포럼 채널 설정
   */
    /**
   * !포럼 [채널] - 포럼 설정
   * !포럼 해제 - 포럼 해제
   * !포럼 - 현재 포럼 확인
   */
  async handleForum(message, args) {
    if (args.length === 0) {
      // 현재 포럼 확인
      return await this.checkForumChannel(message);
    }
    
    if (args[0] === '해제') {
      // 포럼 해제
      return await this.clearForumChannel(message);
    }
    
    // 포럼 설정
    return await this.setForumChannel(message, args);
  }

  async setForumChannel(message, args) {
    const serverId = message.guild.id;

    // 채널 멘션 또는 ID 파싱
    let channelId = null;
    
    if (args.length > 0) {
      // <#123456789> 형태의 멘션에서 ID 추출
      const mention = args[0].match(/^<#(\d+)>$/);
      if (mention) {
        channelId = mention[1];
      } else if (/^\d+$/.test(args[0])) {
        // 숫자만 있으면 ID로 간주
        channelId = args[0];
      }
    }

    if (!channelId) {
      return message.channel.send(
        formatError('사용법: `!포럼설정 #채널` 또는 `!포럼설정 [채널ID]`') + '\n\n' +
        '**예시:**\n' +
        '`!포럼설정 #캐릭터-시트`\n' +
        '`!포럼설정 1234567890123456789`'
      );
    }

    // 채널 가져오기
    const channel = message.guild.channels.cache.get(channelId);

    if (!channel) {
      return message.channel.send(formatError('해당 채널을 찾을 수 없습니다.'));
    }

    // 포럼 채널인지 확인
    if (channel.type !== ChannelType.GuildForum) {
      return message.channel.send(
        formatError(`<#${channelId}>는 포럼 채널이 아닙니다.`) + '\n\n' +
        '💡 Discord에서 포럼 채널을 만든 후 다시 시도하세요.'
      );
    }

    // DB에 저장
    this.db.setSheetForumChannel(serverId, channelId);

    return message.channel.send(
      formatSuccess('캐릭터 시트 포럼 채널이 설정되었습니다!') + '\n' +
      `📋 포럼 채널: <#${channelId}>\n\n` +
      '이제 `!시트등록` 명령어를 사용하면 자동으로 포럼에 캐릭터 시트 게시물이 생성됩니다!'
    );
  }

  /**
   * !포럼확인 - 현재 설정된 포럼 채널 확인
   */
  async checkForumChannel(message) {
    const serverId = message.guild.id;
    const forumChannelId = this.db.getSheetForumChannel(serverId);

    if (!forumChannelId) {
      return message.channel.send(
        formatWarning('아직 포럼 채널이 설정되지 않았습니다.') + '\n\n' +
        '`!포럼설정 #채널` 명령어로 포럼 채널을 설정하세요.'
      );
    }

    const channel = message.guild.channels.cache.get(forumChannelId);

    if (!channel) {
      return message.channel.send(
        formatWarning('설정된 포럼 채널을 찾을 수 없습니다.') + '\n' +
        '채널이 삭제되었을 수 있습니다. `!포럼설정`으로 다시 설정하세요.'
      );
    }

    return message.channel.send(
      formatSuccess('현재 설정된 포럼 채널') + '\n' +
      `📋 <#${forumChannelId}>\n\n` +
      '`!시트등록` 명령어 사용 시 이 포럼에 게시물이 생성됩니다.'
    );
  }

  /**
   * !포럼해제 - 포럼 채널 설정 해제
   */
  async clearForumChannel(message) {
    const serverId = message.guild.id;
    const forumChannelId = this.db.getSheetForumChannel(serverId);

    if (!forumChannelId) {
      return message.channel.send(formatWarning('설정된 포럼 채널이 없습니다.'));
    }

    this.db.setSheetForumChannel(serverId, null);

    return message.channel.send(
      formatSuccess('포럼 채널 설정이 해제되었습니다.') + '\n' +
      '이제 `!시트등록` 사용 시 포럼에 게시물이 생성되지 않습니다.'
    );
  }

    /**
   * 캐릭터 시트 텍스트 생성 (character.js의 generateSheetContent와 100% 동일)
   */
  createCharacterSheetText(characterData, userId) {
    // activeChar 형식으로 변환 (character.js와 호환)
    const activeChar = {
      name: characterData.name || characterData.characterName,
      data: characterData.data || characterData,
      serverId: characterData.serverId,
      userId: characterData.userId || userId,
      fromSheet: characterData.fromSheet,
      spreadsheetId: characterData.spreadsheetId,
      sheetName: characterData.sheetName
    };
    const d = activeChar.data;
    
    // helper 함수들 import
    const { convertSyndromeToEnglish } = require('../utils/helpers');
    const config = require('../config/config');
    
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
        if (config.subToMainMapping[k] === mainAttr) sub.push(`${k} ${v}`);
        else {
          for (let p in config.dynamicMappingRules) {
            if (k.startsWith(p) && config.dynamicMappingRules[p] === mainAttr) sub.push(`${k} ${v}`);
          }
        }
      }
      if (sub.length > 0 || mainVal !== 0) r += `>     **【${mainAttr}】**  ${mainVal}　` + sub.join('　') + '\n';
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
      const { calculateEffectLevel } = require('../lib/sheetsMapping');
      const effectLevel = calculateEffectLevel(currentErosion, isKigenShu);
      
      r += `\n${emoji}  **이펙트** \n`;
      
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
       
    // 콤보 (시트에서 읽은 combos 배열)
    if (d.combos && Array.isArray(d.combos) && d.combos.length > 0) {
      r += `\n${emoji}  **콤보**\n`;
      
      const currentErosion = d['침식률'] || 0;  // 현재 침식률
      
      for (let combo of d.combos) {
        // 빈 콤보 제외
        if (!combo.name || combo.name === '콤보명' || combo.name.trim() === '') continue;
        
        r += `ㆍ**${combo.name}**\n`;
        
        // 기본 정보
        let info = [];
        if (combo.timing) info.push(combo.timing);
        if (combo.skill) info.push(combo.skill);
        if (combo.difficulty) info.push(combo.difficulty);
        if (combo.target && combo.target !== '-') info.push(combo.target);
        if (combo.range && combo.range !== '-') info.push(combo.range);
        if (combo.restriction && combo.restriction !== '-') info.push(combo.restriction);
        if (combo.erosion) info.push(`침식 ${combo.erosion}`);
        
        if (info.length > 0) {
          r += `${info.join(' | ')}\n`;
        }
        
        // 침식률에 따라 조건별로 표시
        if (currentErosion < 100) {
          // 99↓ 조건만 표시
          if (combo.effectList99 || combo.content99) {
            r += `-# > **99↓**: ${combo.effectList99 || ''}\n`;
            
            if (combo.content99) {
              const lines = combo.content99.split('\n');
              for (const line of lines) {
                if (line.trim()) {
                  r += `-# > ${line.trim()}\n`;
                }
              }
            }
            
            let stats = [];
            if (combo.dice99) stats.push(`+${combo.dice99}dx`);
            if (combo.critical99 && combo.critical99 !== 10) stats.push(`크리 ${combo.critical99}`);
            if (combo.attack99) stats.push(`공격 ${combo.attack99}`);
            
            if (stats.length > 0) {
              r += `-# > ${stats.join(' | ')}\n`;
            }
          }
        } else {
          // 100↑ 조건만 표시
          if (combo.effectList100 || combo.content100) {
            r += `-# > **100↑**: ${combo.effectList100 || ''}\n`;
            
            if (combo.content100) {
              const lines = combo.content100.split('\n');
              for (const line of lines) {
                if (line.trim()) {
                  r += `-# > ${line.trim()}\n`;
                }
              }
            }
            
            let stats = [];
            if (combo.dice100) stats.push(`+${combo.dice100}dx`);
            if (combo.critical100 && combo.critical100 !== 10) stats.push(`크리 ${combo.critical100}`);
            if (combo.attack100) stats.push(`공격 ${combo.attack100}`);
            
            if (stats.length > 0) {
              r += `-# > ${stats.join(' | ')}\n`;
            }
          }
        }
        
        r += '\n'; // 콤보 사이 간격
      }
    }
	
	   
    return r;
  }


/**
   * 스마트 메시지 분할: 의미 있는 섹션별로 분할
   */
  splitMessage(text) {
    const MAX_LENGTH = 1900;
    
    if (text.length <= MAX_LENGTH) {
      return [text];
    }
    
    console.log(`📝 [SPLIT] 메시지가 ${text.length}자로 길어서 분할 시작...`);
    
    // 이모지를 포함한 섹션 헤더 패턴 (이모지 + "**무기**" 형태)
    const emojiPattern = /[\p{Emoji}\p{Emoji_Component}]\s+\*\*/u;
    
    // 각 섹션의 시작 위치 찾기
    const findSectionStart = (keyword) => {
      // 이모지 포함 패턴으로 찾기
      const regex = new RegExp(`[\\s\\S]{0,10}\\*\\*${keyword}\\*\\*`, 'u');
      const match = text.match(regex);
      if (match) {
        const fullMatch = match[0];
        const index = text.indexOf(fullMatch);
        // 이모지가 있다면 이모지부터 시작
        const emojiMatch = fullMatch.match(/[\p{Emoji}\p{Emoji_Component}]/u);
        if (emojiMatch) {
          const emojiIndex = fullMatch.indexOf(emojiMatch[0]);
          return index + emojiIndex;
        }
        return index;
      }
      return -1;
    };
    
    const weaponsStart = findSectionStart('무기');
    const effectsStart = findSectionStart('이펙트');
    const combosStart = findSectionStart('콤보');
    
    const chunks = [];
    
    // === 청크 1: 캐릭터 정보 + 로이스 + 메모리 ===
    let chunk1End = weaponsStart !== -1 ? weaponsStart : text.length;
    const chunk1 = text.substring(0, chunk1End).trim();
    if (chunk1) chunks.push(chunk1);
    
    // === 청크 2: 무기 + 방어구 + 비클 + 아이템 ===
    if (weaponsStart !== -1) {
      let chunk2End = effectsStart !== -1 ? effectsStart : 
                       combosStart !== -1 ? combosStart : text.length;
      const chunk2 = text.substring(weaponsStart, chunk2End).trim();
      
      if (chunk2.length > MAX_LENGTH) {
        const lines = chunk2.split('\n');
        let tempChunk = '';
        
        for (const line of lines) {
          if ((tempChunk + line + '\n').length > MAX_LENGTH) {
            if (tempChunk.trim()) chunks.push(tempChunk.trim());
            tempChunk = line + '\n';
          } else {
            tempChunk += line + '\n';
          }
        }
        
        if (tempChunk.trim()) chunks.push(tempChunk.trim());
      } else if (chunk2) {
        chunks.push(chunk2);
      }
    }
    
    // === 청크 3: 이펙트 + 콤보 ===
    if (effectsStart !== -1) {
      const chunk3 = text.substring(effectsStart).trim();
      
      if (chunk3.length > MAX_LENGTH) {
        const lines = chunk3.split('\n');
        let tempChunk = '';
        
        for (const line of lines) {
          if ((tempChunk + line + '\n').length > MAX_LENGTH) {
            if (tempChunk.trim()) chunks.push(tempChunk.trim());
            tempChunk = line + '\n';
          } else {
            tempChunk += line + '\n';
          }
        }
        
        if (tempChunk.trim()) chunks.push(tempChunk.trim());
      } else if (chunk3) {
        chunks.push(chunk3);
      }
    } else if (combosStart !== -1) {
      const chunk3 = text.substring(combosStart).trim();
      
      if (chunk3.length > MAX_LENGTH) {
        const lines = chunk3.split('\n');
        let tempChunk = '';
        
        for (const line of lines) {
          if ((tempChunk + line + '\n').length > MAX_LENGTH) {
            if (tempChunk.trim()) chunks.push(tempChunk.trim());
            tempChunk = line + '\n';
          } else {
            tempChunk += line + '\n';
          }
        }
        
        if (tempChunk.trim()) chunks.push(tempChunk.trim());
      } else if (chunk3) {
        chunks.push(chunk3);
      }
    }
    
    // 마지막 부분: chunks 반환 전에 처리
    console.log(`📝 [SPLIT] ${chunks.length}개의 청크로 분할 완료`);
    chunks.forEach((chunk, i) => {
      console.log(`   [청크 ${i + 1}] ${chunk.length}자`);
    });
    
    // ✅ 마지막 청크를 제외한 모든 청크 끝에 줄바꿈 + 구분선 추가
    return chunks.map((chunk, i) => {
      if (i < chunks.length - 1) {
        return chunk + '\n　​';
      }
      return chunk;
    });
  }



  /**
   * 포럼에 캐릭터 시트 게시물 생성
   * @param {Guild} guild - Discord 서버
   * @param {string} serverId - 서버 ID
   * @param {string} userId - 유저 ID
   * @param {Object} characterData - 캐릭터 데이터
   * @returns {Object|null} - { threadId, messageId } 또는 null
   */
// forum.js에 새로운 함수 추가:


/**
   * 포럼에 캐릭터 시트 게시물 생성 (이미지 버전)
   * 게시글: 캐릭터 이미지만 (URL 텍스트 숨김)
   * 댓글: 모든 시트 데이터
   */
async createCharacterSheetThread(guild, serverId, userId, characterData) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 [FORUM-CREATE] createCharacterSheetThread 호출됨');
    console.log('  - characterName:', characterData?.characterName);
    console.log('  - imageUrl:', characterData?.imageUrl);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      const forumChannelId = this.db.getSheetForumChannel(serverId);

      if (!forumChannelId) {
        console.log('⚠️ 포럼 채널이 설정되지 않음');
        return null;
      }

      const forumChannel = guild.channels.cache.get(forumChannelId);

      if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
        console.log('⚠️ 포럼 채널을 찾을 수 없음');
        return null;
      }

      // 기존 스레드가 있는지 확인
      const existingThread = this.db.getCharacterSheetThread(serverId, userId, characterData.characterName);
      
      if (existingThread && existingThread.threadId) {
        console.log(`♻️ 기존 스레드 업데이트: ${existingThread.threadId}`);
        
        try {
          const thread = await forumChannel.threads.fetch(existingThread.threadId);
          if (thread) {
            // 첫 메시지: 이미지만 (URL 텍스트 숨김)
            const starterMessage = await thread.fetchStarterMessage();
            if (starterMessage) {
              const emoji = characterData.emoji || '';
              const codeName = characterData.codeName || characterData.characterName;
              
              // ✅ 이미지가 있으면 임베드 형식으로 표시 (URL 텍스트 숨김)
              let imageContent;
              if (characterData.imageUrl) {
                // 이미지만 표시하고 URL 텍스트는 숨김
                imageContent = {
                  content: `${emoji}  **「${codeName}」${characterData.characterName}**`,
                  embeds: [{
                    image: { url: characterData.imageUrl }
                  }]
                };
              } else {
                // 이미지가 없으면 기본 정보만
                imageContent = {
                  content: `${emoji}  **「${codeName}」${characterData.characterName}**`
                };
              }
              
              await starterMessage.edit(imageContent);

              // 기존 댓글 삭제 (봇이 작성한 것만)
              const existingMessages = await thread.messages.fetch({ after: starterMessage.id, limit: 100 });
              const botMessages = existingMessages.filter(m => m.author.id === this.client.user.id);
              for (const msg of botMessages.values()) {
                await msg.delete();
              }

              // 새 데이터 댓글 작성
              const sheetText = this.createCharacterSheetText(characterData, userId);
              const chunks = this.splitMessage(sheetText);
              
              for (let i = 0; i < chunks.length; i++) {
                await thread.send(chunks[i]);
                console.log(`✅ 데이터 댓글 ${i + 1}/${chunks.length} 전송 완료`);
              }

              console.log(`✅ 기존 스레드 업데이트 완료`);
              return existingThread;
            }
          }
        } catch (error) {
          console.log(`⚠️ 기존 스레드 업데이트 실패, 새로 생성: ${error.message}`);
        }
      }

      // 게시물 제목
      const emoji = characterData.emoji || '';
      const codeName = characterData.codeName || characterData.characterName;
      const threadTitle = `${emoji ? emoji + ' ' : ''}「${codeName}」${characterData.characterName}`;

      // ✅ 게시글 내용: 이미지가 있으면 임베드로 표시 (URL 텍스트 숨김)
      let threadMessage;
      if (characterData.imageUrl) {
        threadMessage = {
          content: `${emoji}  **「${codeName}」${characterData.characterName}**`,
          embeds: [{
            image: { url: characterData.imageUrl }
          }]
        };
      } else {
        threadMessage = {
          content: `${emoji}  **「${codeName}」${characterData.characterName}**`
        };
      }

      // 포럼에 스레드 생성
      const thread = await forumChannel.threads.create({
        name: threadTitle,
        message: threadMessage
      });

      console.log(`✅ 포럼 스레드 생성 완료: ${thread.id}`);

      // 댓글로 시트 데이터 전송
      const sheetText = this.createCharacterSheetText(characterData, userId);
      const chunks = this.splitMessage(sheetText);
      
      for (let i = 0; i < chunks.length; i++) {
        await thread.send(chunks[i]);
        console.log(`✅ 데이터 댓글 ${i + 1}/${chunks.length} 전송 완료`);
      }

      const starterMessage = await thread.fetchStarterMessage();
      const result = {
        threadId: thread.id,
        messageId: starterMessage.id
      };

      this.db.setCharacterSheetThread(serverId, userId, characterData.characterName, thread.id, starterMessage.id);

      return result;

    } catch (error) {
      console.error('포럼 스레드 생성 오류:', error);
      return null;
    }
  }

  async updateCharacterSheetThread(guild, serverId, userId, characterData) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 [FORUM-UPDATE] updateCharacterSheetThread 호출됨');
    console.log('  - characterName:', characterData?.characterName);
    console.log('  - characterData에 combos 있음?', 'combos' in characterData);
    console.log('  - characterData.combos:', characterData?.combos);
    console.log('  - combos 길이:', characterData?.combos?.length);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    try {
      const threadInfo = this.db.getCharacterSheetThread(serverId, userId, characterData.characterName);

      if (!threadInfo || !threadInfo.threadId) {
        console.log('⚠️ 업데이트할 스레드가 없음');
        return false;
      }

      const forumChannelId = this.db.getSheetForumChannel(serverId);
      if (!forumChannelId) return false;

      const forumChannel = guild.channels.cache.get(forumChannelId);
      if (!forumChannel) return false;

      const thread = await forumChannel.threads.fetch(threadInfo.threadId);
      if (!thread) return false;

      const message = await thread.fetchStarterMessage();
      if (!message) return false;

      const text = this.createCharacterSheetText(characterData, userId);
      await message.edit({ content: text });

      console.log(`✅ 포럼 스레드 업데이트 완료: ${threadInfo.threadId}`);
      return true;

    } catch (error) {
      console.error('포럼 스레드 업데이트 오류:', error);
      return false;
    }
  }
}

module.exports = ForumCommands;