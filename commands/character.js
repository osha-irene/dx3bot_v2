/**
 * 캐릭터 관리 명령어 (모듈화 버전)
 */

const { EmbedBuilder } = require('discord.js');
const { extractName, formatError, formatSuccess, convertSyndromeToEnglish } = require('../utils/helpers');
const config = require('../config');

// 상태 패널 모듈 import
const StatusPanelModule = require('./modules/statusPanel');

class CharacterCommands {
  constructor(database, sheetsClient) {
    this.db = database;
    this.sheets = sheetsClient;
    
    // 상태 패널 모듈 초기화
    this.statusPanel = new StatusPanelModule(database);
  }

  /**
   * 활성 캐릭터 정보 가져오기 (시트 우선)
   */
  async getActiveCharacterData(message) {
    const serverId = message.guild.id;
    const userId = message.author.id;

    // 시트 연동 확인
    const sheetInfo = this.db.getUserSheet(serverId, userId);
    
    if (sheetInfo && sheetInfo.spreadsheetId && this.sheets) {
      // 시트에서 직접 읽기
      try {
        const data = await this.sheets.readFullCharacter(sheetInfo.spreadsheetId, sheetInfo.sheetName);
        if (data && data.characterName) {
          return {
            name: data.characterName,
            data,
            fromSheet: true,
            spreadsheetId: sheetInfo.spreadsheetId,
            sheetName: sheetInfo.sheetName,
            serverId,
            userId
          };
        }
      } catch (error) {
        console.error('시트 읽기 오류:', error);
        // 시트 실패 시 DB로 폴백
      }
    }

    // DB에서 가져오기
    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    if (!activeCharName) return null;

    const data = this.db.getCharacter(serverId, userId, activeCharName);
    if (!data) return null;

    return {
      name: activeCharName,
      data,
      fromSheet: false,
      serverId,
      userId
    };
  }

  /**
   * !상태패널
   */
  async statusPanel(message) {
    return await this.statusPanel.createOrUpdatePanel(message);
  }

  /**
   * 상태 패널 자동 업데이트 (다른 명령어에서 호출)
   */
  async updateStatusPanel(guild, serverId) {
    return await this.statusPanel.autoUpdate(guild, serverId);
  }

  /**
   * !시트입력 [캐릭터 이름] [항목] [값] ...
   */
  async sheetInput(message, args) {
    const serverId = message.guild.id;
    const userId = message.author.id;

    const regex = /^(?:"([^"]+)"|\[([^\]]+)\]|(\S+))\s+(.+)$/;
    const match = args.join(' ').match(regex);

    if (!match) {
      return message.channel.send(formatError('사용법: `!시트입력 "캐릭터 이름" [항목1] [값1] [항목2] [값2] ...`'));
    }

    const characterName = match[1] || match[2] || match[3];
    const attributeArgs = match[4].split(/\s+/);

    if (attributeArgs.length < 2 || attributeArgs.length % 2 !== 0) {
      return message.channel.send(formatError('속성은 최소한 하나 이상 입력해야 하며, 속성과 값은 짝수여야 합니다.'));
    }

    // 캐릭터 데이터 가져오기 (없으면 생성)
    let characterData = this.db.getCharacter(serverId, userId, characterName) || {};

    // 속성 저장
    for (let i = 0; i < attributeArgs.length; i += 2) {
      const attribute = attributeArgs[i];
      const value = parseInt(attributeArgs[i + 1]);

      if (isNaN(value)) {
        return message.channel.send(formatError(`**${attributeArgs[i + 1]}**는 숫자가 아닙니다. 숫자 값만 입력해주세요.`));
      }

      characterData[attribute] = value;
    }

    this.db.setCharacter(serverId, userId, characterName, characterData);
    return message.channel.send(formatSuccess(`**${characterName}**의 항목이 설정되었습니다.`));
  }

  /**
   * !지정 [캐릭터 이름]
   * 자동 알림 (5초 삭제) + 상태 패널 업데이트
   */
  async setActive(message, args) {
    const serverId = message.guild.id;
    const userId = message.author.id;

    if (args.length === 0) {
      return message.channel.send(formatError('사용법: `!지정 "캐릭터 이름"`'));
    }

    const characterName = extractName(args.join(' '));

    // DB에 캐릭터가 있는지 확인
    const characterData = this.db.getCharacter(serverId, userId, characterName);
    if (!characterData) {
      return message.channel.send(
        formatError(`캐릭터 "${characterName}"의 데이터를 찾을 수 없습니다.`) + '\n' +
        '먼저 `!시트입력`을 사용하여 캐릭터를 등록하거나 `!시트동기화`로 시트에서 가져오세요.'
      );
    }

    this.db.setActiveCharacter(serverId, userId, characterName);
    
    // 자동 알림 (5초 후 삭제)
    const emoji = characterData.emoji || '✅';
    const codeName = characterData.codeName || '';
    const replyMsg = await message.reply(
      `${emoji} **${characterName}** ${codeName ? `「${codeName}」` : ''} 활성화!\n` +
      `💚 HP: ${characterData.HP || 0}  |  🔴 침식률: ${characterData.침식률 || 0}`
    );
    
    setTimeout(() => {
      replyMsg.delete().catch(() => {});
      message.delete().catch(() => {});
    }, 5000);

    // 상태 패널 자동 업데이트
    await this.updateStatusPanel(message.guild, serverId);
  }

  /**
   * !지정해제
   * 자동 알림 (5초 삭제) + 상태 패널 업데이트
   */
  async unsetActive(message) {
    const serverId = message.guild.id;
    const userId = message.author.id;

    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    if (!activeCharName) {
      return message.reply(formatError('현재 활성화된 캐릭터가 없습니다.'));
    }

    this.db.clearActiveCharacter(serverId, userId);
    
    // 자동 알림 (5초 후 삭제)
    const replyMsg = await message.reply(`⚪ **${activeCharName}** 활성 해제`);
    
    setTimeout(() => {
      replyMsg.delete().catch(() => {});
      message.delete().catch(() => {});
    }, 5000);

    // 상태 패널 자동 업데이트
    await this.updateStatusPanel(message.guild, serverId);
  }

  /**
   * !시트확인 (포럼 스레드 방식)
   */
  async checkSheet(message) {
    console.log('🔍 [DEBUG] checkSheet 호출됨');
    
    const activeChar = await this.getActiveCharacterData(message);
    if (!activeChar) {
      return message.reply(formatError('활성화된 캐릭터가 없습니다. `!지정 [캐릭터 이름]` 명령어로 캐릭터를 지정해주세요.'));
    }

    console.log('🔍 [DEBUG] 활성 캐릭터:', activeChar.name);

    const serverId = message.guild.id;
    const userId = message.author.id;
    const characterName = activeChar.name;

    // 포럼 채널 확인
    let forumChannelId = this.db.getSheetForumChannel(serverId);
    console.log('🔍 [DEBUG] 저장된 포럼 채널 ID:', forumChannelId);
    
    let forumChannel = null;

    if (forumChannelId) {
      try {
        forumChannel = await message.guild.channels.fetch(forumChannelId);
        // 포럼 채널이 아니면 null
        if (forumChannel.type !== 15) { // 15 = GUILD_FORUM
          forumChannel = null;
          forumChannelId = null;
        }
      } catch (error) {
        forumChannel = null;
        forumChannelId = null;
      }
    }

    // 포럼 채널이 없으면 생성 또는 찾기
    if (!forumChannel) {
      console.log('🔍 [DEBUG] 포럼 채널 없음, 찾거나 생성 시도');
      
      // 서버의 포럼 채널 찾기
      const existingForum = message.guild.channels.cache.find(
        ch => ch.type === 15 && (ch.name === '캐릭터-시트' || ch.name === 'character-sheets')
      );

      if (existingForum) {
        console.log('🔍 [DEBUG] 기존 포럼 찾음:', existingForum.name);
        forumChannel = existingForum;
        this.db.setSheetForumChannel(serverId, existingForum.id);
      } else {
        console.log('🔍 [DEBUG] 포럼 생성 시도');
        // 포럼 채널 생성
        try {
          forumChannel = await message.guild.channels.create({
            name: '캐릭터-시트',
            type: 15, // GUILD_FORUM
            topic: '캐릭터 시트가 자동으로 관리됩니다'
          });
          console.log('✅ [DEBUG] 포럼 생성 완료:', forumChannel.id);
          this.db.setSheetForumChannel(serverId, forumChannel.id);
          await message.channel.send('포럼 채널 "캐릭터-시트"를 생성했습니다!');
        } catch (error) {
          console.error('❌ [DEBUG] 포럼 채널 생성 오류:', error);
          // 포럼 생성 실패 시 일반 메시지로 폴백
          return await this.checkSheetNormal(message, activeChar);
        }
      }
    }

    // 시트 내용 생성
    const sheetContent = this.generateSheetContent(activeChar);

    // 기존 스레드 확인
    const threadInfo = this.db.getCharacterSheetThread(serverId, userId, characterName);

    try {
      if (threadInfo && threadInfo.threadId) {
        // 기존 스레드 찾기
        try {
          const thread = await forumChannel.threads.fetch(threadInfo.threadId);
          
          if (thread) {
            // 스레드 내 메시지 수정
            const sheetMessage = await thread.messages.fetch(threadInfo.messageId);
            await sheetMessage.edit(sheetContent);
            
            // 명령어 메시지 삭제
            await message.delete().catch(() => {});
            
            // 확인 메시지 (5초 후 삭제)
            const confirmMsg = await message.channel.send(
              `${activeChar.data.emoji || '📋'} **${characterName}** 시트가 업데이트되었습니다!\n` +
              `📍 <#${thread.id}>`
            );
            setTimeout(() => confirmMsg.delete().catch(() => {}), 5000);
            return;
          }
        } catch (error) {
          // 스레드를 찾을 수 없으면 새로 생성
        }
      }

      // 새 스레드 생성
      const emoji = activeChar.data.emoji || '📋';
      const codeName = activeChar.data.codeName || '';
      const threadName = `${emoji} ${characterName} ${codeName ? `「${codeName}」` : ''}`;

      const thread = await forumChannel.threads.create({
        name: threadName.substring(0, 100), // 최대 100자
        message: sheetContent
      });

      // 첫 메시지 ID 가져오기
      const messages = await thread.messages.fetch({ limit: 1 });
      const firstMessage = messages.first();

      // 스레드 정보 저장
      this.db.setCharacterSheetThread(serverId, userId, characterName, thread.id, firstMessage.id);

      // 명령어 메시지 삭제
      await message.delete().catch(() => {});

      // 확인 메시지 (5초 후 삭제)
      const confirmMsg = await message.channel.send(
        `${emoji} **${characterName}** 시트 스레드가 생성되었습니다!\n` +
        `📍 <#${thread.id}>`
      );
      setTimeout(() => confirmMsg.delete().catch(() => {}), 5000);

    } catch (error) {
      console.error('포럼 스레드 생성/업데이트 오류:', error);
      // 오류 시 일반 메시지로 폴백
      return await this.checkSheetNormal(message, activeChar);
    }
  }

  /**
   * 일반 메시지 방식 시트 확인 (폴백용)
   */
  async checkSheetNormal(message, activeChar) {
    const sheetContent = this.generateSheetContent(activeChar);
    return message.reply(sheetContent);
  }

  /**
   * 시트 내용 생성
   */
  generateSheetContent(activeChar) {
    const characterData = activeChar.data;
    const characterCodeName = characterData.codeName || '코드네임 없음';
    const characterEmoji = characterData.emoji || '❌';

    

    // 로이스 배열 확인
    if (!Array.isArray(characterData.lois)) {
      characterData.lois = [];
    }

    // 브리드 타입 결정
    let breedType = "브리드 없음";
    if (characterData.breed) {
      const breed = characterData.breed.toLowerCase();
      if (breed === "퓨어" || breed === "pure") breedType = "PURE";
      else if (breed === "크로스" || breed === "cross") breedType = "CROSS";
      else if (breed === "트라이" || breed === "tri") breedType = "TRI";
    }

    // 신드롬 변환
    let syndromeList = characterData.syndromes ? characterData.syndromes.split(" × ") : ["신드롬 없음"];
    syndromeList = syndromeList.map(s => convertSyndromeToEnglish(s, config.syndromeTranslation));

    // 상단 캐릭터 정보
    let response = `${characterEmoji}  **${activeChar.name}** :: **「${characterCodeName}」**\n`;
    response += `> ${characterData.cover || "커버 없음"}｜${characterData.works || "웍스 없음"}\n`;
    response += `> ${breedType}｜${syndromeList.join(" × ")}\n`;
    response += `> ${characterData.awakening || "각성 없음"}｜${characterData.impulse || "충동 없음"}\n`;
    response += `> D-Lois｜No.${characterData.dloisNo || "00"} ${characterData.dloisName || "D로이스 없음"}\n\n`;

    response += `> **HP** ${characterData.HP || 0}  |  **침식률** ${characterData.침식률 || 0}  |  **침식D** ${characterData.침식D || 0}  |  **로이스** ${characterData.lois.length}\n`;

    // 각 상위 항목에 대해 하위 항목을 찾고 출력
    for (let mainAttr of config.mainAttributes) {
      let subAttributes = [];
      let mainAttrValue = characterData[mainAttr] || 0;

      for (let [key, value] of Object.entries(characterData)) {
        if (config.subToMainMapping[key] === mainAttr) {
          subAttributes.push(`${key}: ${value}`);
        } else {
          for (let prefix in config.dynamicMappingRules) {
            if (key.startsWith(prefix) && config.dynamicMappingRules[prefix] === mainAttr) {
              subAttributes.push(`${key}: ${value}`);
            }
          }
        }
      }

      if (subAttributes.length > 0 || mainAttrValue !== 0) {
        response += `>     **【${mainAttr}】**  ${mainAttrValue}   ` + subAttributes.join(' ') + '\n';
      }
    }

    // 콤보 출력
    const combos = this.db.getCombos(activeChar.serverId, activeChar.userId, activeChar.name);
    if (Object.keys(combos).length > 0) {
      response += `\n${characterEmoji}  **콤보**\n`;
      for (let comboName in combos) {
        response += `> ㆍ **${comboName}**\n`;
      }
    }

    // 로이스 출력
    if (characterData.lois && characterData.lois.length > 0) {
      response += `\n${characterEmoji}  **로이스**\n`;
      for (let lois of characterData.lois) {
        response += `> ㆍ **${lois.name}** | ${lois.pEmotion} / ${lois.nEmotion} | ${lois.description}\n`;
      }
    }

    // 메모리 출력
    if (characterData.memory && characterData.memory.length > 0) {
      response += `\n${characterEmoji}  **메모리**\n`;
      for (let mem of characterData.memory) {
        response += `> ㆍ **${mem.name}** | ${mem.emotion} | ${mem.description}\n`;
      }
    }

    // 무기 출력
    if (characterData.weapons && characterData.weapons.length > 0) {
      response += `\n${characterEmoji}  **무기**\n`;
      for (let weapon of characterData.weapons) {
        let weaponInfo = `> ㆍ **${weapon.name}**`;
        if (weapon.type) weaponInfo += ` (${weapon.type})`;
        if (weapon.ability) weaponInfo += ` | 기능: ${weapon.ability}`;
        if (weapon.range) weaponInfo += ` | 사정거리: ${weapon.range}`;
        if (weapon.accuracy) weaponInfo += ` | 명중: ${weapon.accuracy}`;
        if (weapon.attack) weaponInfo += ` | 공격력: ${weapon.attack}`;
        if (weapon.guard) weaponInfo += ` | 가드: ${weapon.guard}`;
        weaponInfo += '\n';
        if (weapon.description) weaponInfo += `>   ${weapon.description}\n`;
        response += weaponInfo;
      }
    }

    // 방어구 출력
    if (characterData.armor && characterData.armor.length > 0) {
      response += `\n${characterEmoji}  **방어구**\n`;
      for (let armor of characterData.armor) {
        let armorInfo = `> ㆍ **${armor.name}**`;
        if (armor.type) armorInfo += ` (${armor.type})`;
        if (armor.dodge) armorInfo += ` | 닷지: ${armor.dodge}`;
        if (armor.action) armorInfo += ` | 행동치: ${armor.action}`;
        if (armor.defense) armorInfo += ` | 장갑: ${armor.defense}`;
        armorInfo += '\n';
        if (armor.description) armorInfo += `>   ${armor.description}\n`;
        response += armorInfo;
      }
    }

    // 비클 출력
    if (characterData.vehicles && characterData.vehicles.length > 0) {
      response += `\n${characterEmoji}  **비클**\n`;
      for (let vehicle of characterData.vehicles) {
        let vehicleInfo = `> ㆍ **${vehicle.name}**`;
        if (vehicle.type) vehicleInfo += ` (${vehicle.type})`;
        if (vehicle.ability) vehicleInfo += ` | 기능: ${vehicle.ability}`;
        if (vehicle.attack) vehicleInfo += ` | 공격력: ${vehicle.attack}`;
        if (vehicle.action) vehicleInfo += ` | 행동치: ${vehicle.action}`;
        if (vehicle.defense) vehicleInfo += ` | 장갑: ${vehicle.defense}`;
        if (vehicle.move) vehicleInfo += ` | 이동: ${vehicle.move}`;
        vehicleInfo += '\n';
        if (vehicle.description) vehicleInfo += `>   ${vehicle.description}\n`;
        response += vehicleInfo;
      }
    }

    // 아이템 출력
    if (characterData.items && characterData.items.length > 0) {
      response += `\n${characterEmoji}  **아이템**\n`;
      for (let item of characterData.items) {
        let itemInfo = `> ㆍ **${item.name}**`;
        if (item.type) itemInfo += ` (${item.type})`;
        if (item.ability) itemInfo += ` | 기능: ${item.ability}`;
        itemInfo += '\n';
        if (item.description) itemInfo += `>   ${item.description}\n`;
        response += itemInfo;
      }
    }

    // 이펙트 출력
    if (characterData.effects && characterData.effects.length > 0) {
      response += `\n${characterEmoji}  **이펙트**\n`;
      for (let effect of characterData.effects) {
        response += `> ㆍ **${effect.name}** | ${effect.description}\n`;
      }
    }

    // 시트 연동 상태 표시
    if (activeChar.fromSheet) {
      response += `\n📊 *Google Sheets 연동 중*`;
      if (activeChar.sheetName) {
        response += ` (탭: ${activeChar.sheetName})`;
      }
    }

    return response;
  }

  /**
   * 포럼 시트 자동 업데이트 (다른 명령어에서 호출)
   */
  async autoUpdateSheet(guild, serverId, userId, characterName) {
    try {
      // 스레드 정보 확인
      const threadInfo = this.db.getCharacterSheetThread(serverId, userId, characterName);
      if (!threadInfo || !threadInfo.threadId) return;

      // 포럼 채널 확인
      const forumChannelId = this.db.getSheetForumChannel(serverId);
      if (!forumChannelId) return;

      const forumChannel = await guild.channels.fetch(forumChannelId);
      if (!forumChannel || forumChannel.type !== 15) return;

      // 스레드 찾기
      const thread = await forumChannel.threads.fetch(threadInfo.threadId);
      if (!thread) return;

      // 캐릭터 데이터 가져오기
      const characterData = this.db.getCharacter(serverId, userId, characterName);
      if (!characterData) return;

      const activeChar = {
        name: characterName,
        data: characterData,
        fromSheet: false,
        serverId,
        userId
      };

      // 시트 내용 생성
      const sheetContent = this.generateSheetContent(activeChar);

      // 메시지 수정
      const sheetMessage = await thread.messages.fetch(threadInfo.messageId);
      await sheetMessage.edit(sheetContent);

      console.log(`✅ [AUTO] ${characterName} 시트 자동 업데이트 완료`);
    } catch (error) {
      console.error('포럼 시트 자동 업데이트 오류:', error);
      // 에러는 무시 (스레드가 삭제됐을 수도 있음)
    }
  }


  /**
   * !내캐릭터
   */
  async myCharacters(message) {
    const serverId = message.guild.id;
    const userId = message.author.id;

    const allCharacters = this.db.getAllCharacters(serverId, userId);
    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    const sheetInfo = this.db.getUserSheet(serverId, userId);

    if (!allCharacters || Object.keys(allCharacters).length === 0) {
      return message.reply('📋 등록된 캐릭터가 없습니다.\n`!시트등록` 또는 `!시트입력`으로 캐릭터를 만들어보세요!');
    }

    let response = `📋 **${message.author.username}님의 캐릭터 목록**\n\n`;
    
    for (const [charName, charData] of Object.entries(allCharacters)) {
      const isActive = charName === activeCharName;
      const emoji = charData.emoji || '❌';
      const codeName = charData.codeName || '코드네임 없음';
      
      if (isActive) {
        response += `✅ ${emoji} **${charName}** 「${codeName}」 ← 현재 활성\n`;
      } else {
        response += `⚪ ${emoji} **${charName}** 「${codeName}」\n`;
      }
      
      response += `   💚 HP: ${charData.HP || 0} | 🔴 침식률: ${charData.침식률 || 0}\n`;
    }

    if (sheetInfo && sheetInfo.spreadsheetId) {
      response += `\n📊 Google Sheets 연동 중`;
      if (sheetInfo.sheetName) {
        response += ` (탭: ${sheetInfo.sheetName})`;
      }
    }

    if (!activeCharName) {
      response += `\n\n💡 \`!지정 "캐릭터이름"\`으로 캐릭터를 활성화하세요!`;
    }

    return message.reply(response);
  }

  /**
   * !서버캐릭터
   */
  async serverCharacters(message) {
    const serverId = message.guild.id;
    const allUsers = this.db.getAllUsers(serverId);

    if (!allUsers || Object.keys(allUsers).length === 0) {
      return message.reply('📋 이 서버에 등록된 캐릭터가 없습니다.');
    }

    let response = `📋 **${message.guild.name} 서버의 캐릭터 목록**\n\n`;
    let totalCharacters = 0;

    for (const [userId, userData] of Object.entries(allUsers)) {
      try {
        const user = await message.guild.members.fetch(userId);
        const userName = user.user.username;
        const activeCharName = this.db.getActiveCharacter(serverId, userId);
        
        if (userData && typeof userData === 'object') {
          const characterNames = Object.keys(userData).filter(key => 
            typeof userData[key] === 'object' && !key.startsWith('__')
          );
          
          if (characterNames.length > 0) {
            response += `👤 **${userName}**\n`;
            
            for (const charName of characterNames) {
              const charData = userData[charName];
              const emoji = charData.emoji || '❌';
              const isActive = charName === activeCharName;
              
              if (isActive) {
                response += `   ✅ ${emoji} **${charName}** ← 활성\n`;
              } else {
                response += `   ⚪ ${emoji} ${charName}\n`;
              }
              totalCharacters++;
            }
            response += '\n';
          }
        }
      } catch (error) {
        console.error(`유저 ${userId}를 찾을 수 없음:`, error);
      }
    }

    response += `📊 총 **${totalCharacters}명**의 캐릭터가 있습니다.`;

    return message.reply(response);
  }

  /**
   * !캐릭터삭제 [이름]
   */
  async deleteCharacter(message, args) {
    const serverId = message.guild.id;
    const userId = message.author.id;

    const regex = /^(?:"([^"]+)"|\[([^\]]+)\]|(\S+))$/;
    const match = args.join(' ').match(regex);

    if (!match) {
      return message.channel.send(formatError('사용법: `!캐릭터삭제 "캐릭터 이름"` 또는 `!캐릭터삭제 [캐릭터 이름]`'));
    }

    const characterName = match[1] || match[2] || match[3];

    if (!this.db.getCharacter(serverId, userId, characterName)) {
      return message.channel.send(formatError(`**"${characterName}"** 캐릭터를 찾을 수 없습니다.`));
    }

    // 캐릭터 삭제
    this.db.deleteCharacter(serverId, userId, characterName);

    // 콤보도 삭제
    const combos = this.db.getCombos(serverId, userId, characterName);
    if (Object.keys(combos).length > 0) {
      for (const comboName of Object.keys(combos)) {
        this.db.deleteCombo(serverId, userId, characterName, comboName);
      }
    }

    // 활성 캐릭터였다면 해제
    if (this.db.getActiveCharacter(serverId, userId) === characterName) {
      this.db.clearActiveCharacter(serverId, userId);
    }

    // 상태 패널 업데이트
    await this.updateStatusPanel(message.guild, serverId);

    return message.channel.send(formatSuccess(`**"${characterName}"** 캐릭터가 삭제되었습니다.`));
  }

  /**
   * 캐릭터 속성 설정 공통 함수
   */
  async updateAttribute(message, attribute, value) {
    const activeChar = await this.getActiveCharacterData(message);
    if (!activeChar) {
      return message.channel.send(formatError('활성화된 캐릭터가 없습니다. `!지정 [캐릭터 이름]` 명령어로 캐릭터를 지정해주세요.'));
    }

    activeChar.data[attribute] = value;
    this.db.setCharacter(activeChar.serverId, activeChar.userId, activeChar.name, activeChar.data);

    return message.channel.send(formatSuccess(`**${activeChar.name}**의 **${attribute}**이(가) **"${value}"**(으)로 설정되었습니다.`));
  }

  /**
   * !D로 - D로이스 확인 또는 설정
   */
  async dlois(message, args) {
    const serverId = message.guild.id;
    const userId = message.author.id;
    const activeCharName = this.db.getActiveCharacter(serverId, userId);

    if (!activeCharName) {
      return message.reply(formatError('활성 캐릭터가 없습니다. `!지정 [캐릭터 이름]`으로 캐릭터를 지정하세요.'));
    }

    const characterData = this.db.getCharacter(serverId, userId, activeCharName);
    if (!characterData) {
      return message.reply(formatError('캐릭터 데이터를 찾을 수 없습니다.'));
    }

    // 인자가 없으면 현재 D로이스 표시
    if (args.length === 0) {
      if (!characterData.dloisFull) {
        return message.reply('📋 D로이스가 설정되지 않았습니다.\n사용법: `!D로 No. 번호 이름 [내용]`\n예시: `!D로 No. 17 기묘한 이웃 Strange Neighbour`');
      }

      let response = `📋 **${activeCharName}의 D로이스**\n`;
      response += `> **${characterData.dloisFull}**\n`;
      if (characterData.dloisDesc) {
        response += `> \n> ${characterData.dloisDesc}`;
      }

      return message.reply(response);
    }

    // D로이스 설정
    const fullText = args.join(' ');
    
    // 번호 추출
    const numberMatch = fullText.match(/^(No\.\s*\d+)\s+(.+)$/i);
    
    if (!numberMatch) {
      return message.reply(formatError('사용법: `!D로 No. 번호 이름 [내용]`\n예시: `!D로 No. 17 기묘한 이웃 Strange Neighbour`'));
    }

    const dloisNo = numberMatch[1];
    const restText = numberMatch[2].trim();

    // 이름과 내용 구분
    let dloisName = restText;
    let dloisDesc = '';

    if (restText.length > 100) {
      const splitIndex = 50;
      dloisName = restText.substring(0, splitIndex).trim();
      dloisDesc = restText.substring(splitIndex).trim();
    }

    const dloisFull = `${dloisNo} ${dloisName}`;

    // 봇 DB에 저장
    characterData.dloisFull = dloisFull;
    characterData.dloisDesc = dloisDesc;
    this.db.setCharacter(serverId, userId, activeCharName, characterData);

    // 시트 자동 업데이트
    let sheetUpdated = false;
    const sheetInfo = this.db.getUserSheet(serverId, userId);
    if (this.sheets && sheetInfo) {
      try {
        const { SHEET_MAPPING } = require('../sheetsMapping');
        
        await this.sheets.writeCell(sheetInfo.spreadsheetId, SHEET_MAPPING.dlois.noAndNameCell, dloisFull, sheetInfo.sheetName);
        
        if (dloisDesc) {
          await this.sheets.writeCell(sheetInfo.spreadsheetId, SHEET_MAPPING.dlois.descCell, dloisDesc, sheetInfo.sheetName);
        }
        
        sheetUpdated = true;
      } catch (error) {
        console.error('시트 D로이스 업데이트 오류:', error);
      }
    }

    let response = formatSuccess(`**${activeCharName}**의 D로이스가 설정되었습니다!`) + '\n';
    response += `> **${dloisFull}**\n`;
    if (dloisDesc) {
      response += `> \n> ${dloisDesc}\n`;
    }
    if (sheetUpdated) {
      response += `\n📊 시트가 자동으로 업데이트되었습니다!`;
    }

    return message.reply(response);
  }
}

module.exports = CharacterCommands;