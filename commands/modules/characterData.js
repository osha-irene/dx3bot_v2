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
