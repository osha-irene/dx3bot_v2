/**
 * 전투/판정 명령어
 */

const { formatError, formatSuccess, formatWarning, getMainAttribute, findBestCombo, mentionUser } = require('../utils/helpers');
const { calculateErosionD, detectErosionDChange, getErosionDChangeMessage } = require('../utils/erosion');
const config = require('../config');

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

    // 시트 연동 체크
    const sheetInfo = this.db.getUserSheet(serverId, userId);
    
    if (sheetInfo && this.sheets) {
      try {
        const data = await this.sheets.readFullCharacter(sheetInfo.spreadsheetId, sheetInfo.sheetName);
        if (data && data.characterName) {
          return {
            name: data.characterName,
            data,
            fromSheet: true,
            serverId,
            userId,
            spreadsheetId: sheetInfo.spreadsheetId,
            sheetName: sheetInfo.sheetName
          };
        }
      } catch (error) {
        console.error('시트 읽기 오류:', error);
      }
    }

    // DB 캐릭터 폴백
    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    if (!activeCharName) return null;

    const data = this.db.getCharacter(serverId, userId, activeCharName);
    if (!data) return null;

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
    const activeChar = await this.getActiveCharacterData(message);
    if (!activeChar) {
      return message.reply(formatError('활성화된 캐릭터가 없습니다. `!지정 [캐릭터 이름]` 명령어로 캐릭터를 지정해주세요.'));
    }

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

    return message.channel.send(`1d10 등장침식 ${mentionUser(message.author.id)}`);
  }

  /**
   * 주사위 봇 결과 처리
   */
  async handleDiceResult(diceMessage) {
    const diceResultMatch = diceMessage.content.match(/(?:\(\d+D\d+\)|＞.*?)\s*＞\s*(\d+)/);
    if (!diceResultMatch) return;

    const diceResult = parseInt(diceResultMatch[1]);
    const serverId = diceMessage.guild?.id;

    if (!serverId || !this.erosionRequesters[serverId]) return;

    const userId = Object.keys(this.erosionRequesters[serverId])[0];
    if (!userId) return;

    const requester = this.erosionRequesters[serverId][userId];
    delete this.erosionRequesters[serverId][userId];

    // 시트 연동 캐릭터인 경우
    if (requester.fromSheet && requester.spreadsheetId && this.sheets) {
      try {
        // 🚀 배치 읽기로 현재 침식률 가져오기
        const currentData = await this.sheets.readFullCharacter(requester.spreadsheetId, requester.sheetName);
        const oldErosion = currentData.침식률 || 0;
        const newErosion = oldErosion + diceResult;

        // 시트 업데이트
        await this.sheets.updateStat(requester.spreadsheetId, '침식률', newErosion, requester.sheetName);

        // 침식D 변화 감지
        const change = detectErosionDChange(oldErosion, newErosion);
        const newErosionD = calculateErosionD(newErosion);

        let responseMessage = `${requester.characterName} 등장침식 +${diceResult} → 현재 침식률: ${newErosion}`;

        if (change.changed) {
          responseMessage += `\n${getErosionDChangeMessage(newErosion, change)}`;
        }

        responseMessage += `\n📊 시트가 자동으로 업데이트되었습니다!`;
        responseMessage += `\n${mentionUser(userId)}`;

        return diceMessage.channel.send(responseMessage);
      } catch (error) {
        console.error('시트 침식률 업데이트 오류:', error);
        // 오류 시 DB로 폴백
      }
    }

    // DB 캐릭터 처리
    const characterData = this.db.getCharacter(serverId, userId, requester.characterName);
    if (!characterData) return;

    const oldErosion = characterData.침식률 || 0;
    const newErosion = oldErosion + diceResult;
    characterData.침식률 = newErosion;

    // 침식D 업데이트
    const change = detectErosionDChange(oldErosion, newErosion);
    characterData.침식D = calculateErosionD(newErosion);

    this.db.setCharacter(serverId, userId, requester.characterName, characterData);

    let responseMessage = `${requester.characterName} 등장침식 +${diceResult} → 현재 침식률: ${newErosion}`;

    if (change.changed) {
      responseMessage += `\n${getErosionDChangeMessage(newErosion, change)}`;
    }

    responseMessage += `\n${mentionUser(userId)}`;

    // 포럼 시트 자동 업데이트
    this.autoUpdateCharacterSheet(diceMessage.guild, serverId, userId, requester.characterName);

    return diceMessage.channel.send(responseMessage);
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
      return message.reply(formatWarning('\'로이스\'는 이 명령어로 조정할 수 없습니다. `!로이스` 명령어를 사용하세요.'));
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
    // CharacterCommands 인스턴스 필요
    const CharacterCommands = require('./character');
    const charCmd = new CharacterCommands(this.db, this.sheets);
    await charCmd.autoUpdateSheet(guild, serverId, userId, characterName);
  }

  /**
   * !콤보 [콤보 이름] [침식률 조건] [콤보 데이터]
   */
  async setCombo(message, comboName, condition, description) {
    const activeChar = await this.getActiveCharacterData(message);
    if (!activeChar) {
      return message.reply(formatError('활성화된 캐릭터가 없습니다. `!지정 [캐릭터 이름]` 명령어로 캐릭터를 지정해주세요.'));
    }

    this.db.setCombo(activeChar.serverId, activeChar.userId, activeChar.name, comboName, condition, description);

    return message.channel.send(formatSuccess(`**${activeChar.name}**의 콤보 **"${comboName}"**가 저장되었습니다.`));
  }

  /**
   * !@[콤보 이름] - 콤보 호출
   */
  async callCombo(message, comboName) {
    const activeChar = await this.getActiveCharacterData(message);
    if (!activeChar) {
      return message.reply(formatError('활성화된 캐릭터가 없습니다. `!지정 ["캐릭터 이름"]` 명령어로 캐릭터를 지정해주세요.'));
    }

    const combos = this.db.getCombos(activeChar.serverId, activeChar.userId, activeChar.name);
    
    if (!combos[comboName]) {
      return message.channel.send(formatError(`**${activeChar.name}**의 콤보 '${comboName}'를 찾을 수 없습니다.`));
    }

    const currentErosion = activeChar.data.침식률 || 0;
    const bestCombo = findBestCombo(currentErosion, combos[comboName]);

    if (bestCombo) {
      return message.channel.send(`> **${bestCombo.condition} 【${comboName}】**\n> ${bestCombo.description}`);
    } else {
      return message.channel.send(formatError(`침식률 조건에 맞는 '${comboName}' 콤보를 찾을 수 없습니다.`));
    }
  }

  /**
   * !콤보삭제 [콤보 이름]
   */
  async deleteCombo(message, comboName) {
    const activeChar = await this.getActiveCharacterData(message);
    if (!activeChar) {
      return message.reply(formatError('활성화된 캐릭터가 없습니다. `!지정 ["캐릭터 이름"]` 명령어로 캐릭터를 지정해주세요.'));
    }

    const deleted = this.db.deleteCombo(activeChar.serverId, activeChar.userId, activeChar.name, comboName);

    if (deleted) {
      return message.channel.send(formatSuccess(`**${activeChar.name}**의 콤보 **"${comboName}"**가 삭제되었습니다.`));
    } else {
      return message.channel.send(formatError(`**${activeChar.name}**에게 **"${comboName}"** 콤보가 존재하지 않습니다.`));
    }
  }
}

module.exports = CombatCommands;