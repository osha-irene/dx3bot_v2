/**
 * 캐릭터 데이터 조회 및 관리 모듈
 * 
 * 🔥 수정: DB의 실시간 값(침식률, HP, 침식D)을 시트 데이터보다 우선
 */

class CharacterDataModule {
  constructor(database, sheetsClient) {
    this.db = database;
    this.sheets = sheetsClient;
  }

  /**
   * 활성 캐릭터 데이터 가져오기
   * 🔥 수정: DB의 실시간 값(침식률, HP, 침식D) 보존
   */
  async getActiveCharacterData(message) {
    const serverId = message.guild.id;
    const userId = message.author.id;
    
    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    if (!activeCharName) return null;
    
    // 🔥 먼저 DB 데이터 가져오기 (실시간 값 보존용)
    const dbData = this.db.getCharacter(serverId, userId, activeCharName);
    
    const sheetInfo = this.db.getCharacterSheet(serverId, userId, activeCharName);
    
    if (sheetInfo && sheetInfo.spreadsheetId && this.sheets) {
      try {
        console.log(`📊 [getActiveCharacterData] 시트에서 ${activeCharName} 읽기 중...`);
        const data = await this.sheets.readFullCharacter(sheetInfo.spreadsheetId, sheetInfo.sheetName);
        
        if (data && data.characterName) {
          // 🔥 DB에 저장된 실시간 값 보존 (침식률, HP, 침식D는 봇에서 관리)
          if (dbData) {
            if (dbData.침식률 !== undefined) {
              console.log(`🔄 [charData] DB 침식률 보존: ${dbData.침식률} (시트: ${data.침식률})`);
              data.침식률 = dbData.침식률;
            }
            if (dbData.HP !== undefined) {
              console.log(`🔄 [charData] DB HP 보존: ${dbData.HP} (시트: ${data.HP})`);
              data.HP = dbData.HP;
            }
            if (dbData.침식D !== undefined) {
              data.침식D = dbData.침식D;
            }
            if (dbData.emoji) {
              data.emoji = dbData.emoji;
            }
            if (dbData.imageUrl) {
              data.imageUrl = dbData.imageUrl;
            }
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
    if (!dbData) return null;
    
    console.log(`💾 [getActiveCharacterData] ${activeCharName} DB에서 읽기`);
    return { name: activeCharName, data: dbData, fromSheet: false, serverId, userId };
  }

  /**
   * 시트 입력 (DB 전용) - 제거됨
   * 이 기능은 시트 중심 워크플로우로 대체되었습니다.
   */
  // async inputSheet() { ... }

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

    // 🔥 먼저 DB에서 캐릭터 데이터 가져오기
    let characterData = this.db.getCharacter(serverId, userId, characterName);
    if (!characterData) {
      return message.channel.send(formatError(`캐릭터 "${characterName}"를 찾을 수 없습니다.`));
    }
    
    // 시트 연동 캐릭터면 자동 동기화 (DB 값 보존)
    const sheetInfo = this.db.getCharacterSheet(serverId, userId, characterName);
    if (sheetInfo && this.sheets) {
      try {
        console.log(`🔄 [지정] 시트 연동 캐릭터 발견: ${characterName}, 시트 동기화 중...`);
        const sheetData = await this.sheets.readFullCharacter(sheetInfo.spreadsheetId, sheetInfo.sheetName);
        
        if (sheetData && sheetData.characterName) {
          // 🔥 DB 실시간 값 보존
          if (characterData.침식률 !== undefined) {
            sheetData.침식률 = characterData.침식률;
          }
          if (characterData.HP !== undefined) {
            sheetData.HP = characterData.HP;
          }
          if (characterData.침식D !== undefined) {
            sheetData.침식D = characterData.침식D;
          }
          if (characterData.emoji) {
            sheetData.emoji = characterData.emoji;
          }
          if (characterData.imageUrl) {
            sheetData.imageUrl = characterData.imageUrl;
          }
          
          characterData = sheetData;
          this.db.setCharacter(serverId, userId, characterName, characterData);
          console.log(`✅ [지정] 시트 동기화 완료 (DB 값 보존)`);
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
    if (args.length < 1) {
      return message.channel.send(formatError('사용법: `!캐릭터삭제 ["캐릭터 이름"]`'));
    }

    const characterName = extractName(args.join(' '));
    const serverId = message.guild.id;
    const userId = message.author.id;

    const deleted = this.db.deleteCharacter(serverId, userId, characterName);

    if (deleted) {
      // 활성 캐릭터 해제
      const activeCharName = this.db.getActiveCharacter(serverId, userId);
      if (activeCharName === characterName) {
        this.db.clearActiveCharacter(serverId, userId);
      }
      return message.channel.send(formatSuccess(`**${characterName}** 캐릭터가 삭제되었습니다.`));
    } else {
      return message.channel.send(formatError(`**${characterName}** 캐릭터를 찾을 수 없습니다.`));
    }
  }
}

module.exports = CharacterDataModule;