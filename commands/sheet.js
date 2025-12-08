/**
 * 시트 관련 명령어
 */

const { formatError, formatSuccess, formatWarning } = require('../utils/helpers');

class SheetCommands {
  constructor(database, sheetsClient) {
    this.db = database;
    this.sheets = sheetsClient;
  }

  /**
   * !시트등록 [URL] - 시트 등록
   */
  async register(message, args) {
    if (!this.sheets) {
      return message.reply(formatError('Google Sheets 기능이 비활성화되어 있습니다.'));
    }

    if (args.length === 0) {
      return message.channel.send(formatError('사용법: `!시트등록 [시트 URL]` 또는 `!시트등록 [시트 URL] [탭이름]`'));
    }

    const sheetUrl = args[0];
    const sheetTabName = args.slice(1).join(' '); // 탭 이름이 있으면 사용
    const spreadsheetId = this.sheets.extractSpreadsheetId(sheetUrl);
    const serverId = message.guild.id;
    const userId = message.author.id;

    // 🔄 로딩 메시지
    const loadingMsg = await message.reply('🔄 시트에 접근 중...');

    // 서비스 계정 이메일 가져오기
    const serviceAccountEmail = await this.sheets.getServiceAccountEmail();

    // 접근 권한 확인
    const hasAccess = await this.sheets.testAccess(spreadsheetId);
    if (!hasAccess) {
      await loadingMsg.edit(
        formatError('시트에 접근할 수 없습니다.') + '\n\n' +
        '📌 **시트 공유 방법 (1분 소요):**\n\n' +
        `1️⃣ 자신의 시트를 열고 우측 상단 **"공유"** 버튼 클릭\n\n` +
        `2️⃣ 아래 이메일을 **복사해서 붙여넣기**:\n\`\`\`\n${serviceAccountEmail}\n\`\`\`\n\n` +
        `3️⃣ 권한을 **"편집자"**로 선택 → **"전송"** 클릭\n\n` +
        `4️⃣ 완료되면 다시 \`!시트등록 ${sheetUrl}\` 입력!\n\n` +
        `💡 이 작업은 **단 한 번만** 하면 됩니다.`
      );
      return;
    }

    // 🔄 시트 탭 스캔 중
    await loadingMsg.edit('🔄 시트 탭 목록을 확인하는 중...');

    // 시트 탭 목록 가져오기
    const sheetList = await this.sheets.getSheetList(spreadsheetId);
    
    if (!sheetList || sheetList.length === 0) {
      await loadingMsg.edit(formatError('시트의 탭 목록을 가져올 수 없습니다.'));
      return;
    }

    // 탭이 하나만 있으면 자동 선택
    if (sheetList.length === 1) {
      await loadingMsg.edit('🔄 캐릭터 데이터를 읽어오는 중...');
      const selectedSheet = sheetList[0].title;
      return await this.completeRegistration(message, spreadsheetId, selectedSheet, serverId, userId, loadingMsg);
    }

    // 탭 이름이 지정된 경우
    if (sheetTabName) {
      const foundSheet = sheetList.find(sheet => 
        sheet.title.toLowerCase() === sheetTabName.toLowerCase()
      );

      if (!foundSheet) {
        await loadingMsg.edit(
          formatError(`"${sheetTabName}" 탭을 찾을 수 없습니다.`) + '\n\n' +
          '사용 가능한 탭:\n' +
          sheetList.map((sheet, idx) => `${idx + 1}. **${sheet.title}**`).join('\n')
        );
        return;
      }

      await loadingMsg.edit('🔄 캐릭터 데이터를 읽어오는 중...');
      return await this.completeRegistration(message, spreadsheetId, foundSheet.title, serverId, userId, loadingMsg);
    }

    // 탭이 여러 개인 경우 - 선택하게 함
    let response = '📊 **시트에 여러 탭이 있습니다. 어느 탭을 사용하시겠어요?**\n\n';
    response += sheetList.map((sheet, idx) => `${idx + 1}. **${sheet.title}**`).join('\n');
    response += '\n\n사용할 탭을 선택하세요:\n';
    response += `\`!시트등록 ${sheetUrl} [탭이름]\`\n\n`;
    response += '**예시:**\n';
    response += `\`!시트등록 ${sheetUrl} ${sheetList[0].title}\``;

    await loadingMsg.edit(response);
  }

  /**
   * 시트 등록 완료 처리
   */
  async completeRegistration(message, spreadsheetId, sheetName, serverId, userId, loadingMsg = null) {
    try {
      // 시트 URL 및 탭 이름 저장
      this.db.setUserSheet(serverId, userId, `${spreadsheetId}::${sheetName}`);

      // 시트에서 캐릭터 정보 읽기
      const characterData = await this.sheets.readFullCharacter(spreadsheetId, sheetName);
      
      if (!characterData || !characterData.characterName) {
        const errorMsg = formatWarning('시트에 접근할 수 있지만 캐릭터 데이터를 읽을 수 없습니다.') + '\n' +
          `시트 탭 "${sheetName}"이(가) 올바른 템플릿인지 확인하세요.`;
        
        if (loadingMsg) {
          return await loadingMsg.edit(errorMsg);
        } else {
          return message.reply(errorMsg);
        }
      }

      // 🔥 기존 DB 데이터에서 emoji 보존
      const existingData = this.db.getCharacter(serverId, userId, characterData.characterName);
      if (existingData && existingData.emoji) {
        characterData.emoji = existingData.emoji;
      }

      // 🔥 중요: 봇 DB에 캐릭터 데이터 저장
      this.db.setCharacter(serverId, userId, characterData.characterName, characterData);
      
      // 🔥 자동으로 활성 캐릭터 지정
      this.db.setActiveCharacter(serverId, userId, characterData.characterName);

      const successMsg = formatSuccess(`시트가 등록되었습니다!`) + '\n' +
        `📊 시트 탭: **${sheetName}**\n` +
        `📝 캐릭터: **${characterData.characterName}**\n` +
        `💚 HP: ${characterData.HP} | 🔴 침식률: ${characterData.침식률}\n` +
        `⚡ 침식D: ${characterData.침식D} | 💙 로이스: ${characterData.로이스}개\n\n` +
        `✅ **${characterData.characterName}** 캐릭터가 자동으로 활성화되었습니다!\n` +
        `이제 봇 명령어를 사용하면 자동으로 시트가 업데이트됩니다!`;

      if (loadingMsg) {
        return await loadingMsg.edit(successMsg);
      } else {
        return message.reply(successMsg);
      }
    } catch (error) {
      console.error('시트 데이터 읽기 오류:', error);
      const errorMsg = formatWarning('시트는 등록되었지만 데이터를 읽는 중 오류가 발생했습니다.') + '\n' +
        '나중에 `!시트동기화` 명령어로 다시 시도해보세요.';
      
      if (loadingMsg) {
        return await loadingMsg.edit(errorMsg);
      } else {
        return message.reply(errorMsg);
      }
    }
  }

  /**
   * !시트동기화 - 시트에서 봇으로 데이터 가져오기
   */
  async sync(message) {
    if (!this.sheets) {
      return message.reply(formatError('Google Sheets 기능이 비활성화되어 있습니다.'));
    }

    const serverId = message.guild.id;
    const userId = message.author.id;
    const sheetInfo = this.db.getUserSheet(serverId, userId);

    if (!sheetInfo) {
      return message.reply(
        formatError('등록된 시트가 없습니다.') + '\n' +
        '먼저 `!시트등록 [URL]` 명령어로 시트를 등록하세요.'
      );
    }

    // 🔄 로딩 메시지
    const loadingMsg = await message.reply('🔄 시트에서 데이터를 읽어오는 중...');

    try {
      const characterData = await this.sheets.readFullCharacter(sheetInfo.spreadsheetId, sheetInfo.sheetName);
      
      if (!characterData || !characterData.characterName) {
        await loadingMsg.edit(formatError('시트에서 캐릭터 데이터를 읽을 수 없습니다.'));
        return;
      }

      // 봇 DB에 저장
      this.db.setCharacter(serverId, userId, characterData.characterName, characterData);
      this.db.setActiveCharacter(serverId, userId, characterData.characterName);

      let response = formatSuccess('시트에서 데이터를 가져왔습니다!') + '\n';
      if (sheetInfo.sheetName) {
        response += `📊 시트 탭: **${sheetInfo.sheetName}**\n`;
      }
      response += `📝 캐릭터: **${characterData.characterName}** (${characterData.codeName || '코드네임 없음'})\n`;
      response += `💚 HP: ${characterData.HP} | 🔴 침식률: ${characterData.침식률} | ⚡ 침식D: ${characterData.침식D}\n`;
      response += `💙 로이스: ${characterData.로이스}개`;

      await loadingMsg.edit(response);
    } catch (error) {
      console.error('시트 동기화 오류:', error);
      await loadingMsg.edit(formatError('시트 동기화 중 오류가 발생했습니다: ' + error.message));
    }
  }

  /**
   * !시트푸시 - 봇에서 시트로 데이터 업로드
   */
  async push(message) {
    if (!this.sheets) {
      return message.reply(formatError('Google Sheets 기능이 비활성화되어 있습니다.'));
    }

    const serverId = message.guild.id;
    const userId = message.author.id;
    const sheetInfo = this.db.getUserSheet(serverId, userId);

    if (!sheetInfo) {
      return message.reply(
        formatError('등록된 시트가 없습니다.') + '\n' +
        '먼저 `!시트등록 [URL]` 명령어로 시트를 등록하세요.'
      );
    }

    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    if (!activeCharName) {
      return message.reply(formatError('활성 캐릭터가 없습니다. `!지정 [캐릭터 이름]`으로 캐릭터를 지정하세요.'));
    }

    const characterData = this.db.getCharacter(serverId, userId, activeCharName);
    if (!characterData) {
      return message.reply(formatError('캐릭터 데이터를 찾을 수 없습니다.'));
    }

    try {
      // HP와 침식률만 업데이트 (PbP에서 자주 변하는 값들)
      if (characterData.HP !== undefined) {
        await this.sheets.updateStat(sheetInfo.spreadsheetId, 'HP', characterData.HP, sheetInfo.sheetName);
      }
      if (characterData.침식률 !== undefined) {
        await this.sheets.updateStat(sheetInfo.spreadsheetId, '침식률', characterData.침식률, sheetInfo.sheetName);
      }

      return message.reply(
        formatSuccess('봇 데이터를 시트로 업로드했습니다!') + '\n' +
        `💚 HP: ${characterData.HP} | 🔴 침식률: ${characterData.침식률}`
      );
    } catch (error) {
      console.error('시트 푸시 오류:', error);
      return message.reply(formatError('시트 업로드 중 오류가 발생했습니다: ' + error.message));
    }
  }

  /**
   * !시트해제 - 시트 연동 해제
   */
  async unregister(message) {
    const serverId = message.guild.id;
    const userId = message.author.id;
    const spreadsheetId = this.db.getUserSheet(serverId, userId);

    if (!spreadsheetId) {
      return message.reply(formatError('등록된 시트가 없습니다.'));
    }

    this.db.setUserSheet(serverId, userId, null);
    return message.reply(formatSuccess('시트 연동이 해제되었습니다.'));
  }

  /**
   * 슬래시 커맨드용 래퍼 함수들
   */
  async registerSheet(interaction, url) {
    const serverId = interaction.guild.id;
    const userId = interaction.user.id;
    
    const urlMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!urlMatch) {
      return { success: false, message: '올바른 Google Sheets URL이 아닙니다.' };
    }
    
    const spreadsheetId = urlMatch[1];
    
    if (!this.sheets) {
      return { success: false, message: 'Google Sheets 기능이 비활성화되어 있습니다.' };
    }
    
    try {
      // 시트 탭 선택
      const tabs = await this.sheets.listTabs(spreadsheetId);
      
      if (tabs.length === 0) {
        return { success: false, message: '시트에 탭이 없습니다.' };
      }
      
      let sheetName = tabs[0].title;
      
      if (tabs.length > 1) {
        console.log(`여러 탭 발견, 첫 번째 탭 사용: ${sheetName}`);
      }
      
      // 캐릭터 데이터 읽기
      const characterData = await this.sheets.readFullCharacter(spreadsheetId, sheetName);
      
      if (!characterData || !characterData.characterName) {
        return { success: false, message: '시트에서 캐릭터 데이터를 읽을 수 없습니다.' };
      }
      
      // 🆕 캐릭터별로 시트 정보 저장
      this.db.setCharacterSheet(serverId, userId, characterData.characterName, spreadsheetId, sheetName);
      this.db.setCharacter(serverId, userId, characterData.characterName, characterData);
      this.db.setActiveCharacter(serverId, userId, characterData.characterName);
      
      // 하위 호환 (기존 방식도 유지)
      this.db.setUserSheet(serverId, userId, `${spreadsheetId}::${sheetName}`);
      
      return { 
        success: true, 
        message: `✅ ${characterData.characterName} 시트 등록 완료!\n이제 \`!지정 "${characterData.characterName}"\` 명령어로 언제든 이 캐릭터로 전환할 수 있습니다.`,
        characterName: characterData.characterName
      };
      
    } catch (error) {
      console.error('시트 등록 오류:', error);
      return { success: false, message: `시트 등록 실패: ${error.message}` };
    }
  }

  async syncSheet(interaction) {
    const serverId = interaction.guild.id;
    const userId = interaction.user.id;
    
    const sheetInfo = this.db.getUserSheet(serverId, userId);
    
    if (!sheetInfo) {
      return { success: false, message: '등록된 시트가 없습니다.' };
    }
    
    try {
      const characterData = await this.sheets.readFullCharacter(sheetInfo.spreadsheetId, sheetInfo.sheetName);
      
      if (!characterData || !characterData.characterName) {
        return { success: false, message: '시트에서 데이터를 읽을 수 없습니다.' };
      }
      
      this.db.setCharacter(serverId, userId, characterData.characterName, characterData);
      this.db.setActiveCharacter(serverId, userId, characterData.characterName);
      
      return { 
        success: true, 
        message: `✅ ${characterData.characterName} 시트 동기화 완료!`
      };
      
    } catch (error) {
      console.error('시트 동기화 오류:', error);
      return { success: false, message: `동기화 실패: ${error.message}` };
    }
  }
}

module.exports = SheetCommands;