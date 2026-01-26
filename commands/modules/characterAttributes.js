/**
 * 캐릭터 속성 설정 모듈
 */

const { formatError, formatSuccess, convertSyndromeToEnglish } = require('../../utils/helpers');
const config = require('../../config');

class CharacterAttributesModule {
  constructor(database, sheetsClient) {
    this.db = database;
    this.sheets = sheetsClient;
  }

  /**
   * 공통 속성 업데이트
   */
  async updateAttribute(message, attribute, value, getActiveCharacterData) {
    const activeChar = await getActiveCharacterData(message);
    if (!activeChar) {
      return message.channel.send(formatError('활성화된 캐릭터가 없습니다.'));
    }

    activeChar.data[attribute] = value;
    this.db.setCharacter(activeChar.serverId, activeChar.userId, activeChar.name, activeChar.data);

    return message.channel.send(
      formatSuccess(`**${activeChar.name}**의 **${attribute}**이(가) **"${value}"**(으)로 설정되었습니다.`)
    );
  }

  /**
   * 코드네임 설정
   */
  async setCodeName(message, args, getActiveCharacterData) {
    if (args.length === 0) {
      return message.channel.send(formatError('사용법: `!코드네임 "코드네임"`'));
    }
    
    const { extractName } = require('../../utils/helpers');
    const codeName = extractName(args.join(' '));
    return await this.updateAttribute(message, 'codeName', codeName, getActiveCharacterData);
  }

  /**
   * 이모지 설정
   */
  async setEmoji(message, args, getActiveCharacterData) {
    if (args.length === 0) {
      return message.channel.send(formatError('사용법: `!이모지 [이모지]`'));
    }
    return await this.updateAttribute(message, 'emoji', args[0], getActiveCharacterData);
  }

  /**
   * 컬러 설정
   */
  async setColor(message, args, getActiveCharacterData) {
    if (args.length === 0) {
      return message.channel.send(formatError('사용법: `!컬러 #RRGGBB`'));
    }

    const colorInput = args[0].replace('#', '');
    const colorCode = colorInput.toUpperCase();

    if (!/^[0-9A-F]{6}$/.test(colorCode)) {
      return message.channel.send(formatError('올바른 16진수 컬러 코드를 입력하세요. (예: #FF5733)'));
    }

    const activeChar = await getActiveCharacterData(message);
    if (!activeChar) {
      return message.channel.send(formatError('활성화된 캐릭터가 없습니다.'));
    }

    activeChar.data.embedColor = colorCode;
    this.db.setCharacter(activeChar.serverId, activeChar.userId, activeChar.name, activeChar.data);

    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder()
      .setColor(parseInt(colorCode, 16))
      .setTitle(`${activeChar.data.emoji || '🎨'} ${activeChar.name}`)
      .setDescription(`컬러 코드: #${colorCode}\n이제 콤보와 이펙트 Embed에 이 색상이 적용됩니다!`);

    return message.channel.send({ embeds: [embed] });
  }

  /**
   * 커버 설정
   */
  async setCover(message, args, getActiveCharacterData) {
    if (args.length === 0) {
      return message.channel.send(formatError('사용법: `!커버 [이름]`'));
    }
    return await this.updateAttribute(message, 'cover', args.join(' '), getActiveCharacterData);
  }

  /**
   * 웍스 설정
   */
  async setWorks(message, args, getActiveCharacterData) {
    if (args.length === 0) {
      return message.channel.send(formatError('사용법: `!웍스 [이름]`'));
    }
    return await this.updateAttribute(message, 'works', args.join(' '), getActiveCharacterData);
  }

  /**
   * 브리드 설정
   */
  async setBreed(message, args, getActiveCharacterData) {
    if (args.length === 0) {
      return message.channel.send(formatError('사용법: `!브리드 [퓨어/크로스/트라이]`'));
    }
    return await this.updateAttribute(message, 'breed', args.join(' '), getActiveCharacterData);
  }

  /**
   * 신드롬 설정
   */
  async setSyndrome(message, args, getActiveCharacterData) {
    if (args.length < 1 || args.length > 3) {
      return message.channel.send(formatError('사용법: `!신드롬 [신드롬1] [신드롬2] [신드롬3]` (최대 3개)'));
    }

    const translatedSyndromes = args.map(s => convertSyndromeToEnglish(s, config.syndromeTranslation)).join(" × ");
    return await this.updateAttribute(message, 'syndromes', translatedSyndromes, getActiveCharacterData);
  }

  /**
   * 각성 설정
   */
  async setAwakening(message, args, getActiveCharacterData) {
    if (args.length === 0) {
      return message.channel.send(formatError('사용법: `!각성 [이름]`'));
    }
    return await this.updateAttribute(message, 'awakening', args.join(' '), getActiveCharacterData);
  }

  /**
   * 충동 설정
   */
  async setImpulse(message, args, getActiveCharacterData) {
    if (args.length === 0) {
      return message.channel.send(formatError('사용법: `!충동 [이름]`'));
    }
    return await this.updateAttribute(message, 'impulse', args.join(' '), getActiveCharacterData);
  }

  /**
   * D로이스 설정
   */
  async setDLois(message, args, getActiveCharacterData) {
    const activeChar = await getActiveCharacterData(message);
    if (!activeChar) {
      return message.reply(formatError('활성 캐릭터가 없습니다.'));
    }

    if (args.length === 0) {
      // D로이스 확인
      if (!activeChar.data.dloisFull) {
        return message.reply('📋 D로이스가 설정되지 않았습니다.');
      }
      
      let response = `📋 **${activeChar.name}의 D로이스**\n> **${activeChar.data.dloisFull}**\n`;
      if (activeChar.data.dloisDesc) {
        response += `> \n> ${activeChar.data.dloisDesc}`;
      }
      return message.reply(response);
    }

    // D로이스 설정
    const text = args.join(' ');
    const match = text.match(/^(No\.\s*\d+)\s+(.+)$/i);
    
    if (!match) {
      return message.reply(formatError('사용법: `!D로 No. 번호 이름`'));
    }

    const no = match[1];
    const rest = match[2].trim();
    let name = rest;
    let desc = '';
    
    if (rest.length > 100) {
      name = rest.substring(0, 50).trim();
      desc = rest.substring(50).trim();
    }

    const full = `${no} ${name}`;
    activeChar.data.dloisFull = full;
    activeChar.data.dloisDesc = desc;
    
    this.db.setCharacter(activeChar.serverId, activeChar.userId, activeChar.name, activeChar.data);

    // 시트 자동 업데이트
    let sheetUpdated = false;
    const sheetInfo = this.db.getUserSheet(activeChar.serverId, activeChar.userId);
    
    if (this.sheets && sheetInfo) {
      try {
        const { SHEET_MAPPING } = require('../../sheetsMapping');
        await this.sheets.writeCell(sheetInfo.spreadsheetId, SHEET_MAPPING.dlois.noAndNameCell, full, sheetInfo.sheetName);
        
        if (desc) {
          await this.sheets.writeCell(sheetInfo.spreadsheetId, SHEET_MAPPING.dlois.descCell, desc, sheetInfo.sheetName);
        }
        
        sheetUpdated = true;
      } catch (error) {
        console.error('시트 D로이스 업데이트 오류:', error);
      }
    }

    let response = formatSuccess(`**${activeChar.name}**의 D로이스가 설정되었습니다!`) + `\n> **${full}**\n`;
    if (desc) response += `> \n> ${desc}\n`;
    if (sheetUpdated) response += `\n📊 시트가 자동으로 업데이트되었습니다!`;
    
    return message.reply(response);
  }
}

module.exports = CharacterAttributesModule;
