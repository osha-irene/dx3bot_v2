/**
 * 캐릭터 시트 확인 및 포럼 게시 모듈
 * 
 * 🔥 수정: DB의 실시간 값(침식률, HP, 침식D)을 시트 데이터보다 우선
 */

const { convertSyndromeToEnglish } = require('../../utils/helpers');
const config = require('../../config/config');
const { calculateEffectLevel } = require('../../lib/sheetsMapping');

class CharacterSheetModule {
  constructor(database, forumCmd = null, sheetsClient = null) {
    this.db = database;
    this.forumCmd = forumCmd;
    this.sheets = sheetsClient;
  }

  /**
   * 시트 확인 및 포럼 게시 (실시간 동기화 포함)
   * 🔥 수정: 시트 연동된 캐릭터 기준으로 업데이트 (활성 캐릭터 아님!)
   */
  async checkSheet(message, getActiveCharacterData, formatError) {
    console.log(`\n🔍 [CHECK] ===== 시트확인 시작 =====`);
    
    const serverId = message.guild.id;
    const userId = message.author.id;

    // 🔥 시트 연동 정보 먼저 확인
    const sheetInfo = this.db.getUserSheet(serverId, userId);
    
    if (!sheetInfo || !this.sheets) {
      // 시트 연동이 없으면 활성 캐릭터 기준
      const activeChar = await getActiveCharacterData(message);
      if (!activeChar) {
        return message.reply(formatError('활성화된 캐릭터가 없습니다.\n`!시트등록 [URL]`로 시트를 등록하거나\n`!지정 "캐릭터 이름"`으로 캐릭터를 지정하세요.'));
      }
      
      // 포럼만 업데이트 (시트 동기화 없이)
      if (this.forumCmd && message.guild) {
        const characterData = {
          characterName: activeChar.name,
          ...activeChar.data,
          serverId: serverId,
          userId: userId
        };
        
        await this.forumCmd.createCharacterSheetThread(
          message.guild, serverId, userId, characterData
        );
        
        const emoji = activeChar.data.emoji || '';
        const confirmMsg = await message.channel.send(
          `${emoji} **${activeChar.name}** 시트가 업데이트되었습니다!`
        );
        setTimeout(() => confirmMsg.delete().catch(() => {}), 5000);
      }
      return;
    }

    // 🔥 시트에서 캐릭터 이름 읽기 (시트 연동된 캐릭터가 대상!)
    console.log('🔄 [CHECK] Google Sheets에서 최신 데이터 읽는 중...');
    const loadingMsg = await message.reply('🔄 시트에서 최신 데이터를 가져오는 중...');
    
    let sheetData;
    let characterName;
    
    try {
      sheetData = await this.sheets.readFullCharacter(
        sheetInfo.spreadsheetId, 
        sheetInfo.sheetName
      );
      
      if (!sheetData || !sheetData.characterName) {
        await loadingMsg.edit('❌ 시트에서 캐릭터 데이터를 읽을 수 없습니다.');
        setTimeout(() => loadingMsg.delete().catch(() => {}), 3000);
        return;
      }
      
      characterName = sheetData.characterName;
      console.log(`🔍 [CHECK] 시트 캐릭터: ${characterName}`);
      
    } catch (error) {
      console.error('❌ [CHECK] 시트 읽기 오류:', error);
      await loadingMsg.edit('❌ 시트 동기화 실패: ' + error.message);
      setTimeout(() => loadingMsg.delete().catch(() => {}), 3000);
      return;
    }

    // 🔥 해당 캐릭터의 DB 데이터 가져오기 (실시간 값 보존용)
    const currentDbData = this.db.getCharacter(serverId, userId, characterName);
    
    // 🔥 DB에 저장된 실시간 값 보존 (침식률, HP, 침식D는 봇에서 관리)
    if (currentDbData) {
      if (currentDbData.침식률 !== undefined) {
        console.log(`🔄 [CHECK] DB 침식률 보존: ${currentDbData.침식률} (시트: ${sheetData.침식률})`);
        sheetData.침식률 = currentDbData.침식률;
      }
      if (currentDbData.HP !== undefined) {
        console.log(`🔄 [CHECK] DB HP 보존: ${currentDbData.HP} (시트: ${sheetData.HP})`);
        sheetData.HP = currentDbData.HP;
      }
      if (currentDbData.침식D !== undefined) {
        sheetData.침식D = currentDbData.침식D;
      }
      if (currentDbData.emoji) {
        sheetData.emoji = currentDbData.emoji;
      }
      if (currentDbData.imageUrl) {
        sheetData.imageUrl = currentDbData.imageUrl;
        console.log(`✅ [CHECK] 기존 이미지 URL 보존:`, currentDbData.imageUrl);
      }
    }
    
    // 기존 스레드 정보 보존
    const existingThread = this.db.getCharacterSheetThread(serverId, userId, characterName);
    if (existingThread) {
      sheetData.sheetThread = existingThread;
    }
    
    // DB 업데이트
    this.db.setCharacter(serverId, userId, characterName, sheetData);
    
    console.log('✅ [CHECK] Google Sheets 데이터 동기화 완료');
    await loadingMsg.delete().catch(() => {});
    
    // 🔥 포럼 업데이트 (시트 연동된 캐릭터 기준!)
    if (this.forumCmd && message.guild) {
      const loadingMsg2 = await message.channel.send('🔄 포럼 게시물 업데이트 중...');
      
      try {
        const characterData = {
          characterName: characterName,
          ...sheetData,
          serverId: serverId,
          userId: userId
        };
        
        await this.forumCmd.createCharacterSheetThread(
          message.guild,
          serverId,
          userId,
          characterData
        );
        
        const emoji = sheetData.emoji || '';
        await loadingMsg2.delete().catch(() => {});
        
        const confirmMsg = await message.channel.send(
          `${emoji} **${characterName}** 시트가 업데이트되었습니다!`
        );
        setTimeout(() => confirmMsg.delete().catch(() => {}), 5000);
        
      } catch (error) {
        console.error('❌ [CHECK] 포럼 업데이트 오류:', error);
        await loadingMsg2.edit('❌ 포럼 업데이트 실패');
        setTimeout(() => loadingMsg2.delete().catch(() => {}), 3000);
      }
    } else {
      return message.reply(formatError('포럼 기능이 비활성화되어 있습니다.'));
    }
  }

  /**
   * 포럼 시트 자동 업데이트 (경량 버전)
   * 🔥 첫 번째 청크만 수정 - HP/침식률 변경 시 빠른 업데이트
   */
  async autoUpdateSheet(guild, serverId, userId, characterName) {
    try {
      const characterData = this.db.getCharacter(serverId, userId, characterName);
      if (!characterData) {
        console.log(`⚠️ [AUTO] ${characterName} 캐릭터 데이터 없음`);
        return;
      }
      
      // 🔥 경량 업데이트: 첫 번째 청크만 수정
      if (this.forumCmd && this.forumCmd.updateFirstChunk) {
        console.log(`⚡ [AUTO] ${characterName} 경량 업데이트 시작...`);
        await this.forumCmd.updateFirstChunk(
          guild,
          serverId,
          userId,
          {
            characterName: characterName,
            ...characterData,
            serverId: serverId,
            userId: userId
          }
        );
        console.log(`✅ [AUTO] ${characterName} 첫 번째 청크 업데이트 완료!`);
      } else if (this.forumCmd) {
        // 폴백: 전체 업데이트
        console.log(`🔄 [AUTO] ${characterName} 전체 업데이트...`);
        await this.forumCmd.createCharacterSheetThread(
          guild,
          serverId,
          userId,
          {
            characterName: characterName,
            ...characterData,
            serverId: serverId,
            userId: userId
          }
        );
      } else {
        console.log(`⚠️ [AUTO] forumCmd가 없어서 포럼 업데이트 불가`);
      }
    } catch (error) {
      console.error('❌ [AUTO] 오류 발생:', error.message);
    }
  }
}

module.exports = CharacterSheetModule;