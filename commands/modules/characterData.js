/**
 * 캐릭터 데이터 조회 및 관리 모듈
 */

class CharacterDataModule {
  constructor(database, sheetsClient) {
    this.db = database;
    this.sheets = sheetsClient;
  }

  /**
   * 활성 캐릭터 데이터 가져오기
   */
  async getActiveCharacterData(message) {
    const serverId = message.guild.id;
    const userId = message.author.id;
    
    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    if (!activeCharName) return null;
    
    const sheetInfo = this.db.getCharacterSheet(serverId, userId, activeCharName);
    
    if (sheetInfo && sheetInfo.spreadsheetId && this.sheets) {
      try {
        console.log(`📊 [getActiveCharacterData] 시트에서 ${activeCharName} 읽기 중...`);
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
          
          console.log(`✅ [getActiveCharacterData] ${data.characterName} 시트 읽기 완료`);
          console.log(`   - 콤보: ${data.combos.length}개 (타입: ${typeof data.combos[0]})`);
          console.log(`   - 이펙트: ${data.effects.length}개`);
          
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
    
    console.log(`💾 [getActiveCharacterData] ${activeCharName} DB에서 읽기`);
    return { name: activeCharName, data, fromSheet: false, serverId, userId };
  }

  /**
   * 시트 입력 (DB 전용)
   */
  async inputSheet(message, args, formatError, formatSuccess) {
    const serverId = message.guild.id;
    const userId = message.author.id;
    const regex = /^(?:"([^"]+)"|\[([^\]]+)\]|(\S+))\s+(.+)$/;
    const match = args.join(' ').match(regex);
    
    if (!match) {
      return message.channel.send(formatError('사용법: `!시트입력 "캐릭터 이름" [항목1] [값1]`'));
    }
    
    const characterName = match[1] || match[2] || match[3];
    const attributeArgs = match[4].split(/\s+/);
    
    if (attributeArgs.length < 2 || attributeArgs.length % 2 !== 0) {
      return message.channel.send(formatError('속성과 값은 짝수여야 합니다.'));
    }
    
    let characterData = this.db.getCharacter(serverId, userId, characterName) || {};
    
    for (let i = 0; i < attributeArgs.length; i += 2) {
      const attribute = attributeArgs[i];
      const value = parseInt(attributeArgs[i + 1]);
      
      if (isNaN(value)) {
        return message.channel.send(formatError(`**${attributeArgs[i + 1]}**는 숫자가 아닙니다.`));
      }
      
      characterData[attribute] = value;
    }
    
    this.db.setCharacter(serverId, userId, characterName, characterData);
    return message.channel.send(formatSuccess(`**${characterName}**의 항목이 설정되었습니다.`));
  }

  /**
   * 캐릭터 지정
   */
  async setActive(message, args, formatError, updateStatusPanel) {
    const serverId = message.guild.id;
    const userId = message.author.id;
    
    if (args.length === 0) {
      return message.channel.send(formatError('사용법: `!지정 "캐릭터 이름"`'));
    }

    const { extractName } = require('../../utils/helpers');
    const characterName = extractName(args.join(' '));

    let characterData = this.db.getCharacter(serverId, userId, characterName);
    if (!characterData) {
      return message.channel.send(formatError(`캐릭터 "${characterName}"를 찾을 수 없습니다.`));
    }
    
    // 시트 연동 캐릭터면 자동 동기화
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
      }
    }
    
    this.db.setActiveCharacter(serverId, userId, characterName);
    
    const emoji = characterData.emoji || '✅';
    const codeName = characterData.codeName || '';
    const sheetIcon = sheetInfo ? ' (시트 연동 ✨)' : '';
    
    const replyMsg = await message.reply(
      `${emoji} **${characterName}** ${codeName ? `「${codeName}」` : ''} 활성화!${sheetIcon}\n` +
      `💚 HP: ${characterData.HP || 0} | 🔴 침식률: ${characterData.침식률 || 0}`
    );
    
    setTimeout(() => { 
      replyMsg.delete().catch(() => {}); 
      message.delete().catch(() => {}); 
    }, 5000);
    
    await updateStatusPanel(message.guild, serverId);
  }

  /**
   * 캐릭터 지정 해제
   */
  async unsetActive(message, formatError, updateStatusPanel) {
    const serverId = message.guild.id;
    const userId = message.author.id;
    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    
    if (!activeCharName) {
      return message.reply(formatError('활성화된 캐릭터가 없습니다.'));
    }
    
    this.db.clearActiveCharacter(serverId, userId);
    
    const replyMsg = await message.reply(`⚪ **${activeCharName}** 활성 해제`);
    setTimeout(() => { 
      replyMsg.delete().catch(() => {}); 
      message.delete().catch(() => {}); 
    }, 5000);
    
    await updateStatusPanel(message.guild, serverId);
  }

  /**
   * 캐릭터 삭제
   */
  async deleteCharacter(message, args, formatError, formatSuccess, extractName) {
    if (!message.guild) return;

    const serverId = message.guild.id;
    const userId = message.author.id;
    const regex = /^(?:"([^"]+)"|\[([^\]]+)\]|(\S+))$/;
    const match = args.join(' ').match(regex);

    if (!match) {
      return message.channel.send(formatError('사용법: `!캐릭터삭제 "캐릭터 이름"`'));
    }

    const characterName = match[1] || match[2] || match[3];

    if (!this.db.getCharacter(serverId, userId, characterName)) {
      return message.channel.send(formatError(`**"${characterName}"** 캐릭터를 찾을 수 없습니다.`));
    }

    // 캐릭터 데이터 삭제
    this.db.deleteCharacter(serverId, userId, characterName);

    // 활성 캐릭터가 삭제된 캐릭터라면 초기화
    if (this.db.getActiveCharacter(serverId, userId) === characterName) {
      this.db.clearActiveCharacter(serverId, userId);
    }

    return message.channel.send(formatSuccess(`**"${characterName}"** 캐릭터가 삭제되었습니다.`));
  }
}

module.exports = CharacterDataModule;
