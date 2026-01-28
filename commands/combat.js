/**
 * 전투/판정 명령어
 * 
 * ❌ 제거된 함수 (시트 동기화로 대체):
 *    - setCombo() → 시트에서 직접 추가
 *    - deleteCombo() → 시트에서 직접 삭제
 * 
 * ✅ 유지된 함수:
 *    - callCombo() → !@콤보명 호출용
 *    - callEffect() → !@이펙트명 호출용
 *    - roll(), entryErosion(), updateStat() → 게임 진행용
 */

const { formatError, formatSuccess, formatWarning, getMainAttribute, findBestCombo, mentionUser } = require('../utils/helpers');
const { calculateErosionD, detectErosionDChange, getErosionDChangeMessage } = require('../utils/erosion');
const config = require('../config/config');

class CombatCommands {
  constructor(database, sheetsClient) {
    this.db = database;
    this.sheets = sheetsClient;
    this.erosionRequesters = {}; // 등장침식 요청자 추적
  }

  /**
   * 활성 캐릭터 정보 가져오기
   */
  async getActiveCharacterData(message) {
    const serverId = message.guild.id;
    const userId = message.author.id;

    // 먼저 활성 캐릭터 확인
    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    if (!activeCharName) return null;

    // 활성 캐릭터의 시트 정보 확인
    const sheetInfo = this.db.getCharacterSheet(serverId, userId, activeCharName);
    
    if (sheetInfo && sheetInfo.spreadsheetId && this.sheets) {
      try {
        console.log(`📊 [combat/getActiveCharacterData] 시트에서 ${activeCharName} 읽기 중...`);
        const data = await this.sheets.readFullCharacter(sheetInfo.spreadsheetId, sheetInfo.sheetName);
        
        if (data && data.characterName) {
          // DB에 저장된 emoji 보존
          const dbData = this.db.getCharacter(serverId, userId, data.characterName);
          if (dbData && dbData.emoji) {
            data.emoji = dbData.emoji;
          }
          
          // readFullCharacter가 이미 모든 것을 읽었으므로 추가 읽기 불필요
          if (!data.effects) data.effects = [];
          if (!data.combos) data.combos = [];
          
          console.log(`✅ [combat/getActiveCharacterData] ${data.characterName} 시트 읽기 완료`);
          console.log(`   - 콤보: ${data.combos.length}개 (타입: ${typeof data.combos[0]})`);
          
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
      }
    }

    // 시트 연동이 안 되어 있으면 DB에서 가져오기
    const data = this.db.getCharacter(serverId, userId, activeCharName);
    if (!data) return null;

    console.log(`💾 [combat/getActiveCharacterData] ${activeCharName} DB에서 읽기`);
    return {
      name: activeCharName,
      data,
      fromSheet: false,
      serverId,
      userId,
      spreadsheetId: null,
      sheetName: null
    };
  }

  /**
   * !판정 [항목]
   */
  async roll(message, args) {
    if (args.length < 1) {
      return message.channel.send(formatError('사용법: `!판정 [항목]`'));
    }

    const activeChar = await this.getActiveCharacterData(message);
    if (!activeChar) {
      return message.reply(formatError('활성화된 캐릭터가 없습니다. `!지정 [캐릭터 이름]` 명령어로 캐릭터를 지정해주세요.'));
    }

    const attribute = args[0];
    const characterData = activeChar.data;

    // 동적 항목의 상위 항목 찾기
    const mainAttr = getMainAttribute(attribute, config.subToMainMapping, config.dynamicMappingRules);

    const mainValue = characterData[mainAttr] || 0;
    const subValue = characterData[attribute] || 0;
    const erosionD = characterData.침식D || 0;

    const finalMainValue = `(${mainValue}+${erosionD})dx`;
    const finalResult = `${finalMainValue}+${subValue}`;

    return message.channel.send(`${finalResult}  ${attribute} 판정 ${mentionUser(message.author.id)}`);
  }

  /**
   * !등침 또는 !등장침식
   */
  async entryErosion(message) {
    console.log(`\n🎲 [등장침식 1] ===== 명령어 시작 =====`);
    console.log(`   - 유저: ${message.author.tag}`);
    console.log(`   - 시간: ${new Date().toLocaleTimeString('ko-KR')}`);
    
    const activeChar = await this.getActiveCharacterData(message);
    if (!activeChar) {
      return message.reply(formatError('활성화된 캐릭터가 없습니다. `!지정 [캐릭터 이름]` 명령어로 캐릭터를 지정해주세요.'));
    }

    console.log(`   - 활성 캐릭터: ${activeChar.name}`);
    const serverId = message.guild.id;
    const userId = message.author.id;

    // 등장침식 요청자 추적
    if (!this.erosionRequesters[serverId]) {
      this.erosionRequesters[serverId] = {};
    }
    this.erosionRequesters[serverId][userId] = {
      characterName: activeChar.name,
      fromSheet: activeChar.fromSheet,
      spreadsheetId: activeChar.spreadsheetId,
      sheetName: activeChar.sheetName
    };

    console.log(`✅ [등장침식 1] 요청자 등록 완료`);
    console.log(`🎲 [등장침식 1] ===== 명령어 끝 (주사위 대기) =====\n`);

    return message.channel.send(`1d10 등장침식 ${mentionUser(message.author.id)}`);
  }

  /**
   * 주사위 봇 결과 처리
   */
  async handleDiceResult(diceMessage) {
    const diceResultMatch = diceMessage.content.match(/(?:\(\d+D\d+\)|＞.*?)\s*＞\s*(\d+)/);
    if (!diceResultMatch) {
      return;
    }
    const diceResult = parseInt(diceResultMatch[1]);
    
    const serverId = diceMessage.guild?.id;

    if (!serverId || !this.erosionRequesters[serverId]) {
      return;
    }

    const userId = Object.keys(this.erosionRequesters[serverId])[0];
    if (!userId) {
      return;
    }
    const requester = this.erosionRequesters[serverId][userId];

    delete this.erosionRequesters[serverId][userId];

    // 시트 연동 캐릭터인 경우
    if (requester.fromSheet && requester.spreadsheetId && this.sheets) {
      console.log(`📊 [등장침식 2] 시트 연동 캐릭터 처리 시작`);
      try {
        // 🚀 배치 읽기로 현재 침식률 가져오기
        const currentData = await this.sheets.readFullCharacter(requester.spreadsheetId, requester.sheetName);
        const oldErosion = currentData.침식률 || 0;
        const newErosion = oldErosion + diceResult;
        console.log(`   - 기존 침식률: ${oldErosion}`);
        console.log(`   - 새 침식률: ${newErosion}`);

        // 시트 업데이트
        await this.sheets.updateStat(requester.spreadsheetId, '침식률', newErosion, requester.sheetName);
        console.log(`✅ [등장침식 2] 시트 업데이트 완료`);

        // DB도 함께 업데이트 (포럼 반영용)
        const dbCharacterData = this.db.getCharacter(serverId, userId, requester.characterName);
        if (dbCharacterData) {
          dbCharacterData.침식률 = newErosion;
          dbCharacterData.침식D = calculateErosionD(newErosion);
          this.db.setCharacter(serverId, userId, requester.characterName, dbCharacterData);
          console.log(`✅ [등장침식 2] DB도 함께 업데이트 완료`);
        }

        // 침식D 변화 감지
        const change = detectErosionDChange(oldErosion, newErosion);
        const newErosionD = calculateErosionD(newErosion);

        let responseMessage = `${requester.characterName} 등장침식 +${diceResult} → 현재 침식률: ${newErosion}`;

        if (change.changed) {
          responseMessage += `\n${getErosionDChangeMessage(newErosion, change)}`;
        }

        responseMessage += `\n📊 시트가 자동으로 업데이트되었습니다!`;
        responseMessage += `\n${mentionUser(userId)}`;

        console.log(`📤 [등장침식 2] 응답 메시지 준비 완료`);
        console.log(`🔄 [등장침식 2] 포럼 업데이트 시작... (시간: ${new Date().toLocaleTimeString('ko-KR')})`);
        
        // 포럼 시트도 자동 업데이트
        await this.autoUpdateCharacterSheet(diceMessage.guild, serverId, userId, requester.characterName);
        
        console.log(`✅ [등장침식 2] 포럼 업데이트 완료 (시간: ${new Date().toLocaleTimeString('ko-KR')})`);
        console.log(`📤 [등장침식 2] 디스코드 메시지 전송 (시트 연동)`);
        
        await diceMessage.channel.send(responseMessage);
        
        console.log(`✅ [등장침식 2] 메시지 전송 완료`);
        console.log(`🎲 [등장침식 2] ===== 시트 연동 처리 완료 =====\n`);
        return;
      } catch (error) {
        console.error(`❌ [등장침식 2] 시트 침식률 업데이트 오류:`, error);
        console.log(`🔄 [등장침식 2] DB로 폴백합니다...`);
        // 오류 시 DB로 폴백
      }
    }

    // DB 캐릭터 처리
    console.log(`💾 [등장침식 2] DB 캐릭터 처리 시작`);
    const characterData = this.db.getCharacter(serverId, userId, requester.characterName);
    if (!characterData) {
      console.log(`❌ [등장침식 2] 캐릭터 데이터 없음\n`);
      return;
    }

    const oldErosion = characterData.침식률 || 0;
    const newErosion = oldErosion + diceResult;
    console.log(`   - 기존 침식률: ${oldErosion}`);
    console.log(`   - 새 침식률: ${newErosion}`);
    
    characterData.침식률 = newErosion;

    // 침식D 업데이트
    const change = detectErosionDChange(oldErosion, newErosion);
    characterData.침식D = calculateErosionD(newErosion);

    console.log(`💾 [등장침식 2] DB 저장 중...`);
    this.db.setCharacter(serverId, userId, requester.characterName, characterData);
    console.log(`✅ [등장침식 2] DB 저장 완료`);

    let responseMessage = `${requester.characterName} 등장침식 +${diceResult} → 현재 침식률: ${newErosion}`;

    if (change.changed) {
      responseMessage += `\n${getErosionDChangeMessage(newErosion, change)}`;
    }

    responseMessage += `\n${mentionUser(userId)}`;

    console.log(`📤 [등장침식 2] 응답 메시지 준비 완료`);
    console.log(`🔄 [등장침식 2] 포럼 업데이트 시작... (시간: ${new Date().toLocaleTimeString('ko-KR')})`);
    
    // 포럼 시트 자동 업데이트 (await 추가!)
    await this.autoUpdateCharacterSheet(diceMessage.guild, serverId, userId, requester.characterName);
    
    console.log(`✅ [등장침식 2] 포럼 업데이트 완료 (시간: ${new Date().toLocaleTimeString('ko-KR')})`);
    console.log(`📤 [등장침식 2] 디스코드 메시지 전송 중...`);
    
    const sentMessage = await diceMessage.channel.send(responseMessage);
    
    console.log(`✅ [등장침식 2] 메시지 전송 완료 (시간: ${new Date().toLocaleTimeString('ko-KR')})`);
    console.log(`🎲 [등장침식 2] ===== DB 처리 완료 =====\n`);
    
    return sentMessage;
  }

  /**
   * !침식률+N, !HP-10 등 상태 변경
   */
  async updateStat(message, statName, operator, value) {
    const activeChar = await this.getActiveCharacterData(message);
    if (!activeChar) {
      return message.reply(formatError('활성화된 캐릭터가 없습니다. `!지정 [캐릭터 이름]` 명령어로 캐릭터를 지정해주세요.'));
    }

    if (statName === "로이스") {
      return message.reply(formatWarning('\'로이스\'는 이 명령어로 조정할 수 없습니다. 시트에서 직접 수정해주세요.'));
    }

    const characterData = activeChar.data;
    let currentValue = characterData[statName] || 0;
    let newValue = currentValue;

    if (operator === '+') {
      newValue = currentValue + value;
    } else if (operator === '-') {
      newValue = currentValue - value;
    } else if (operator === '=') {
      newValue = value;
    }

    // 침식률 변경 시 침식D도 업데이트
    if (statName === '침식률') {
      const change = detectErosionDChange(currentValue, newValue);
      characterData.침식D = change.newD;

      // 🔄 시트 자동 업데이트
      let sheetUpdated = false;
      if (activeChar.fromSheet && activeChar.spreadsheetId && this.sheets) {
        try {
          await this.sheets.updateStat(activeChar.spreadsheetId, '침식률', newValue, activeChar.sheetName);
          sheetUpdated = true;
        } catch (error) {
          console.error('시트 침식률 업데이트 오류:', error);
        }
      }

      characterData[statName] = newValue;
      this.db.setCharacter(activeChar.serverId, activeChar.userId, activeChar.name, characterData);

      let response = `▶ **${activeChar.name}**\n현재 **${statName}:** ${newValue}`;
      if (change.changed) {
        response += `\n${getErosionDChangeMessage(newValue, change)}`;
      }
      if (sheetUpdated) {
        response += `\n📊 시트가 자동으로 업데이트되었습니다!`;
      }

      // 포럼 시트 자동 업데이트
      await this.autoUpdateCharacterSheet(message.guild, activeChar.serverId, activeChar.userId, activeChar.name);

      return message.reply(response);
    }

    // 🔄 HP 자동 업데이트
    let sheetUpdated = false;
    if (statName === 'HP' && activeChar.fromSheet && activeChar.spreadsheetId && this.sheets) {
      try {
        await this.sheets.updateStat(activeChar.spreadsheetId, 'HP', newValue, activeChar.sheetName);
        sheetUpdated = true;
      } catch (error) {
        console.error('시트 HP 업데이트 오류:', error);
      }
    }

    characterData[statName] = newValue;
    this.db.setCharacter(activeChar.serverId, activeChar.userId, activeChar.name, characterData);

    let response = `▶ **${activeChar.name}**\n현재 **${statName}:** ${newValue}`;
    if (sheetUpdated) {
      response += `\n📊 시트가 자동으로 업데이트되었습니다!`;
    }

    // 포럼 시트 자동 업데이트 (HP나 중요 스탯 변경 시)
    if (statName === 'HP' || statName === '침식률') {
      this.autoUpdateCharacterSheet(message.guild, activeChar.serverId, activeChar.userId, activeChar.name);
    }

    return message.reply(response);
  }

  /**
   * 캐릭터 시트 자동 업데이트 (포럼 스레드)
   */
  async autoUpdateCharacterSheet(guild, serverId, userId, characterName) {
    console.log(`🔍 [COMBAT] autoUpdateCharacterSheet 호출됨`);
    console.log(`   - Guild: ${guild.name}`);
    console.log(`   - Character: ${characterName}`);
    
    try {
      // CharacterCommands 인스턴스 필요
      const CharacterCommands = require('./character');
      const charCmd = new CharacterCommands(this.db, this.sheets);
      await charCmd.autoUpdateSheet(guild, serverId, userId, characterName);
    } catch (error) {
      console.error('❌ [COMBAT] autoUpdateCharacterSheet 오류:', error.message);
    }
  }

  /**
   * !@[콤보 이름] - 콤보 호출 (시트 기반 + Embed + 자동 굴림)
   */
  async callCombo(message, comboName) {
    const activeChar = await this.getActiveCharacterData(message);
    if (!activeChar) {
      return message.reply(formatError('활성화된 캐릭터가 없습니다. `!지정 ["캐릭터 이름"]` 명령어로 캐릭터를 지정해주세요.'));
    }

    // 콤보 데이터 확인 (시트 연동이나 DB에서 이미 로드됨)
    if (!activeChar.data.combos || activeChar.data.combos.length === 0) {
      return message.reply(formatError('등록된 콤보가 없습니다. `!시트등록`을 하거나 시트의 196~237행을 확인해주세요.'));
    }

    try {
      // 이미 로드된 콤보 데이터에서 찾기
      const combo = activeChar.data.combos.find(c => c.name === comboName);

      if (!combo) {
        return message.channel.send(formatError(`콤보 '${comboName}'를 찾을 수 없습니다.`));
      }

      const currentErosion = activeChar.data.침식률 || 0;
      
      // 침식률에 맞는 버전 선택
      let effectList, content;
      if (currentErosion >= 100) {
        effectList = combo.effectList100 || '';
        content = combo.content100 || '';
      } else {
        effectList = combo.effectList99 || '';
        content = combo.content99 || '';
      }
      
      const version = currentErosion >= 100 ? '100↑' : '99↓';

      // Embed 생성
      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      
      // 🎨 개인별 컬러코드 사용
      let embedColor;
      if (activeChar.data.embedColor) {
        console.log(`[콤보 컬러] 개인 컬러 발견: ${activeChar.data.embedColor}`);
        embedColor = parseInt(activeChar.data.embedColor, 16);
        console.log(`[콤보 컬러] 변환된 값: 0x${embedColor.toString(16).toUpperCase()}`);
      } else {
        console.log(`[콤보 컬러] 개인 컬러 없음, 기본값 사용 (침식률: ${currentErosion})`);
        // 기본: 어두운 회색, 100 이상: 짙은 빨강
        embedColor = currentErosion >= 100 ? 0x8B0000 : 0x2F3136;
      }
      
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${version} ${combo.name}`)
        .setDescription(effectList || '');

      // 상세 정보 (한 줄로)
      let detailsLine = '';
      if (combo.timing) detailsLine += `${combo.timing}`;
      if (combo.skill) detailsLine += ` / ${combo.skill}`;
      if (combo.difficulty) detailsLine += ` / ${combo.difficulty}`;
      if (combo.target) detailsLine += ` / ${combo.target}`;
      if (combo.range) detailsLine += ` / ${combo.range}`;
      if (combo.restriction) detailsLine += ` / ${combo.restriction}`;
      
      if (detailsLine) {
        embed.addFields({ 
          name: '상세', 
          value: detailsLine, 
          inline: false 
        });
      }

      // 효과 정보 (다이스, 크리티컬, 공격력, 침식)
      let effectsLine = '';
      if (combo.dice99 || combo.dice100) {
        const dice = currentErosion >= 100 ? (combo.dice100 || combo.dice99) : combo.dice99;
        if (dice) effectsLine += `다이스 ${dice}`;
      }
      if (combo.critical99 || combo.critical100) {
        const critical = currentErosion >= 100 ? (combo.critical100 || combo.critical99) : combo.critical99;
        if (critical) effectsLine += ` / 크리치 ${critical}`;
      }
      if (combo.attack99 || combo.attack100) {
        const attack = currentErosion >= 100 ? (combo.attack100 || combo.attack99) : combo.attack99;
        if (attack) effectsLine += ` / 공격력 ${attack}`;
      }
      if (combo.erosion) effectsLine += ` / 침식 ${combo.erosion}`;
      
      if (effectsLine) {
        embed.addFields({ 
          name: '효과', 
          value: effectsLine, 
          inline: false 
        });
      }

      // 내용
      if (content) {
        embed.addFields({ 
          name: '내용', 
          value: content, 
          inline: false 
        });
      }

      // 침식률 경고
      let footerText = '';
      if (currentErosion >= 220) {
        footerText = '⚠ 침식률 220↑: 더 강력한 콤보가 필요합니다! 시트의 다음 슬롯(202, 208, 214...)에 220↑ 조건을 추가하세요.';
      } else if (currentErosion >= 160) {
        footerText = '⚠ 침식률 160↑: 더 강력한 콤보가 필요할 수 있습니다! 시트의 다음 슬롯에 160↑ 조건을 추가하세요.';
      }
      
      if (footerText) {
        embed.setFooter({ text: footerText });
      }

      await message.channel.send({ embeds: [embed] });

    } catch (error) {
      console.error('콤보 호출 오류:', error);
      return message.channel.send(formatError(`콤보 호출 중 오류가 발생했습니다: ${error.message}`));
    }
  }

  /**
   * ![이펙트 이름] - 이펙트 상세 정보 표시
   */
  async callEffect(message, effectName) {
    const activeChar = await this.getActiveCharacterData(message);
    if (!activeChar) {
      return message.reply(formatError('활성화된 캐릭터가 없습니다. `!지정 ["캐릭터 이름"]` 명령어로 캐릭터를 지정해주세요.'));
    }

    // ✅ 시트 연동 확인
    const sheetInfo = this.db.getUserSheet(activeChar.serverId, activeChar.userId);
    
    if (!sheetInfo || !this.sheets) {
      return message.reply(formatError('이펙트 기능은 시트 연동 캐릭터만 사용할 수 있습니다. `!시트등록`을 먼저 해주세요.'));
    }

    try {
      // ✅ readFullCharacter로 이펙트 읽기 (이미 effects 배열 포함)
      const characterData = await this.sheets.readFullCharacter(sheetInfo.spreadsheetId, sheetInfo.sheetName);
      
      if (!characterData || !characterData.effects || characterData.effects.length === 0) {
        return message.channel.send(formatError('시트에서 이펙트를 찾을 수 없습니다. 시트의 164~193행을 확인해주세요.'));
      }
      
      const effects = characterData.effects;
      
      // 띄어쓰기 무시하고 검색 (입력값과 이펙트명 모두 띄어쓰기 제거 후 비교)
      const normalizedInput = effectName.replace(/\s+/g, '');
      const effect = effects.find(e => e.name.replace(/\s+/g, '') === normalizedInput);

      if (!effect) {
        return message.channel.send(formatError(`이펙트 '${effectName}'을 찾을 수 없습니다.`));
      }

      const currentErosion = activeChar.data.침식률 || 0;
      
      const { EmbedBuilder } = require('discord.js');
      
      // 🎨 개인별 컬러코드 사용
      let embedColor;
      if (activeChar.data.embedColor) {
        embedColor = parseInt(activeChar.data.embedColor, 16);
      } else {
        // 기본: 어두운 회색, 100 이상: 짙은 빨강
        embedColor = currentErosion >= 100 ? 0x8B0000 : 0x2F3136;
      }
      
      // 침식률에 따른 이펙트 레벨 증가
      let levelBonus = 0;
      if (currentErosion >= 220) {
        levelBonus = 3;
      } else if (currentErosion >= 160) {
        levelBonus = 2;
      } else if (currentErosion >= 100) {
        levelBonus = 1;
      }
      
      // 🔥 타이틀 표시용: 기본 레벨 + 보너스
      // 🔥 효과 계산용: 기본 레벨 + 보너스
      const displayLevel = effect.currentLevel + levelBonus;
      
      // 효과 내용에서 [LV+N] 치환 (실제 레벨 적용)
      let effectText = effect.effect || '';
      effectText = effectText.replace(/\[LV\+(\d+)\]/gi, (match, bonus) => {
        return `[${displayLevel + parseInt(bonus)}]`;
      });
      effectText = effectText.replace(/\[LV\]/gi, `[${displayLevel}]`);
      
      // 타이틀: 기본 레벨 + 보너스 표시
      let titleText = `${effect.name} Lv ${effect.currentLevel}`;
      if (levelBonus > 0) {
        titleText += `+${levelBonus}`;
      }
      
      console.log(`[이펙트 레벨] 기본 레벨: ${effect.currentLevel}, 보너스: ${levelBonus}, 타이틀: ${titleText}`);
      
      // 상세 정보를 한 줄로 (먼저 준비)
      let detailsLine = '';
      if (effect.timing) detailsLine += `${effect.timing}`;
      if (effect.ability) detailsLine += ` / ${effect.ability}`;
      if (effect.difficulty) detailsLine += ` / 난이도 ${effect.difficulty}`;
      if (effect.target) detailsLine += ` / ${effect.target}`;
      if (effect.range) detailsLine += ` / ${effect.range}`;
      if (effect.erosion) detailsLine += ` / 침식률 +${effect.erosion}`;
      if (effect.restriction && effect.restriction !== '-') {
        detailsLine += ` / 제한 ${effect.restriction}`;
      } else if (!effect.restriction || effect.restriction === '-') {
        detailsLine += ` / 제한 -`;
      }
      
      // ✨ Embed 생성 (타이틀 → 상세 정보 → 효과 설명)
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(titleText);

      // 상세 정보 먼저 추가 (작은 텍스트)
      if (detailsLine) {
        embed.addFields({ 
          name: '\u200b',
          value: `-# ${detailsLine}`, 
          inline: false 
        });
      }

      // 효과 설명 나중에 추가 (Description)
      if (effectText) {
        embed.setDescription(effectText);
      }

      return await message.channel.send({ embeds: [embed] });

    } catch (error) {
      console.error('이펙트 호출 오류:', error);
      return message.channel.send(formatError(`이펙트를 불러오는 중 오류가 발생했습니다: ${error.message}`));
    }
  }
}

module.exports = CombatCommands;
