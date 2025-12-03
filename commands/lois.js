/**
 * 로이스/타이터스 명령어
 */

const { extractName, formatError, formatSuccess } = require('../utils/helpers');

class LoisCommands {
  constructor(database, sheetsClient, characterCommands = null) {
    this.db = database;
    this.sheets = sheetsClient;
    this.charCmd = characterCommands;
  }

  async getActiveCharacterData(message) {
    const serverId = message.guild.id;
    const userId = message.author.id;
    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    if (!activeCharName) return null;

    const data = this.db.getCharacter(serverId, userId, activeCharName);
    if (!data) return null;

    return { name: activeCharName, data, serverId, userId };
  }

  /**
   * !로이스 [이름] [P감정] [N감정] [내용]
   */
  async addLois(message, args) {
    const regex = /^(?:"([^"]+)"|\[([^\]]+)\]|(\S+))\s+(\S+)\s+(\S+)\s+(.+)$/;
    const match = args.join(' ').match(regex);

    if (!match) {
      return message.channel.send(formatError('사용법: `!로이스 ["로이스 이름"] P감정 N감정 내용`\n📌 P감정이나 N감정에 `*`을 붙이면 해당 감정이 강조됩니다.'));
    }

    const loisName = match[1] || match[2] || match[3];
    const pEmotion = match[4];
    const nEmotion = match[5];
    const loisDescription = match[6];

    const activeChar = await this.getActiveCharacterData(message);
    if (!activeChar) {
      return message.reply(formatError('활성화된 캐릭터가 없습니다. `!지정 ["캐릭터 이름"]` 명령어로 캐릭터를 지정해주세요.'));
    }

    // 강조 처리 (【】 전체를 볼드)
    const formattedPEmotion = pEmotion.includes('*') ? `**【P: ${pEmotion.replace('*', '')}】**` : `P: ${pEmotion}`;
    const formattedNEmotion = nEmotion.includes('*') ? `**【N: ${nEmotion.replace('*', '')}】**` : `N: ${nEmotion}`;

    if (!activeChar.data.lois) activeChar.data.lois = [];

    const existingIndex = activeChar.data.lois.findIndex(lois => lois.name === loisName);
    if (existingIndex !== -1) {
      activeChar.data.lois[existingIndex] = {
        name: loisName,
        pEmotion: formattedPEmotion,
        nEmotion: formattedNEmotion,
        description: loisDescription
      };
    } else {
      activeChar.data.lois.push({
        name: loisName,
        pEmotion: formattedPEmotion,
        nEmotion: formattedNEmotion,
        description: loisDescription
      });
    }

    this.db.setCharacter(activeChar.serverId, activeChar.userId, activeChar.name, activeChar.data);
    return message.channel.send(formatSuccess(`**${activeChar.name}**의 로이스 **"${loisName}"**가 등록되었습니다.\n${formattedPEmotion} / ${formattedNEmotion}\n${loisDescription}`));
  }

  /**
   * !로이스삭제 [이름]
   */
  async deleteLois(message, args) {
    if (args.length < 1) {
      return message.channel.send(formatError('사용법: `!로이스삭제 ["로이스 이름"]`'));
    }

    const loisName = extractName(args.join(' '));
    const activeChar = await this.getActiveCharacterData(message);

    if (!activeChar) {
      return message.reply(formatError('활성화된 캐릭터가 없습니다.'));
    }

    if (!activeChar.data.lois) {
      return message.channel.send(formatError(`**${activeChar.name}**에게 등록된 로이스가 없습니다.`));
    }

    const index = activeChar.data.lois.findIndex(lois => lois.name === loisName);

    if (index === -1) {
      return message.channel.send(formatError(`**${activeChar.name}**에게 **"${loisName}"** 로이스가 존재하지 않습니다.`));
    }

    activeChar.data.lois.splice(index, 1);
    this.db.setCharacter(activeChar.serverId, activeChar.userId, activeChar.name, activeChar.data);

    return message.channel.send(formatSuccess(`**${activeChar.name}**의 로이스 **"${loisName}"**가 삭제되었습니다.`));
  }

  /**
   * !타이터스 [이름]
   */
  async convertToTitus(message, args) {
    if (args.length < 1) {
      return message.channel.send(formatError('사용법: `!타이터스 ["로이스 이름"]`'));
    }

    const loisName = extractName(args.join(' '));
    const activeChar = await this.getActiveCharacterData(message);

    if (!activeChar) {
      return message.reply(formatError('활성화된 캐릭터가 없습니다.'));
    }

    if (!activeChar.data.lois) {
      return message.channel.send(formatError(`**${activeChar.name}**에게 등록된 로이스가 없습니다.`));
    }

    const index = activeChar.data.lois.findIndex(lois => lois.name === loisName);

    if (index === -1) {
      return message.channel.send(formatError(`**${activeChar.name}**에게 **"${loisName}"** 로이스가 존재하지 않습니다.`));
    }

    // 로이스 삭제 대신 취소선 추가
    const targetLois = activeChar.data.lois[index];
    activeChar.data.lois[index] = {
      name: `~~${targetLois.name}~~`,
      pEmotion: `~~${targetLois.pEmotion}~~`,
      nEmotion: `~~${targetLois.nEmotion}~~`,
      description: `~~${targetLois.description}~~`,
      isTitus: true
    };

    this.db.setCharacter(activeChar.serverId, activeChar.userId, activeChar.name, activeChar.data);

    // 🔄 시트 자동 업데이트 (타이터스 체크박스)
    let sheetUpdated = false;
    const sheetInfo = this.db.getUserSheet(activeChar.serverId, activeChar.userId);
    if (this.sheets && sheetInfo) {
      try {
        const { SHEET_MAPPING } = require('../sheetsMapping');
        
        // 시트에서 해당 로이스 찾아서 타이터스 체크 (AD, AE 열에 TRUE 입력)
        for (let row = SHEET_MAPPING.lois.startRow; row <= SHEET_MAPPING.lois.endRow; row++) {
          const cellName = `${SHEET_MAPPING.lois.nameCol}${row}`;
          const currentName = await this.sheets.readCell(sheetInfo.spreadsheetId, cellName, sheetInfo.sheetName);
          
          if (currentName && currentName.trim() === loisName) {
            // AD와 AE에 TRUE 입력 (체크박스 체크)
            await this.sheets.writeCell(sheetInfo.spreadsheetId, `AD${row}`, 'TRUE', sheetInfo.sheetName);
            await this.sheets.writeCell(sheetInfo.spreadsheetId, `AE${row}`, 'TRUE', sheetInfo.sheetName);
            sheetUpdated = true;
            break;
          }
        }
      } catch (error) {
        console.error('시트 타이터스 업데이트 오류:', error);
      }
    }

    // 포럼 시트 자동 업데이트
    try {
      if (this.charCmd) {
        await this.charCmd.autoUpdateSheet(message.guild, activeChar.serverId, activeChar.userId, activeChar.name);
      } else {
        const CharacterCommands = require('./character');
        const charCmd = new CharacterCommands(this.db, this.sheets);
        await charCmd.autoUpdateSheet(message.guild, activeChar.serverId, activeChar.userId, activeChar.name);
      }
    } catch (error) {
      console.error('포럼 시트 자동 업데이트 오류:', error);
    }

    let response = formatSuccess(`**${activeChar.name}**의 로이스 **"${loisName}"**가 타이터스로 변환되었습니다!`);
    if (sheetUpdated) {
      response += `\n📊 시트가 자동으로 업데이트되었습니다!`;
    }

    return message.channel.send(response);
  }
}

module.exports = LoisCommands;