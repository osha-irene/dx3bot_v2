/**
 * 슬래시 커맨드 핸들러
 * 
 * 현재 지원하는 슬래시 명령어:
 * - /시트등록, /시트동기화, /시트푸시, /시트해제
 * - /지정, /지정해제, /시트확인
 * - /내캐릭터, /이모지, /캐릭터삭제
 * - /로이스, /타이터스
 * - /리셋, /도움
 */

const { formatError, formatSuccess } = require('../utils/helpers');

class SlashCommandHandler {
  constructor(database, sheetsClient, characterCmd, sheetCmd, combatCmd, loisCmd, forumCmd) {
    this.db = database;
    this.sheets = sheetsClient;
    this.characterCmd = characterCmd;
    this.sheetCmd = sheetCmd;
    this.combatCmd = combatCmd;
    this.loisCmd = loisCmd;
    this.forumCmd = forumCmd;  // 🔥 포럼 명령어 추가
  }

  /**
   * 🔥 포럼 첫 번째 청크 업데이트 (경량)
   */
  async updateForumFirstChunk(guild, serverId, userId, characterName) {
    if (!this.forumCmd) return;
    
    try {
      const characterData = this.db.getCharacter(serverId, userId, characterName);
      if (!characterData) return;
      
      if (this.forumCmd.updateFirstChunk) {
        await this.forumCmd.updateFirstChunk(guild, serverId, userId, {
          characterName: characterName,
          ...characterData,
          serverId: serverId,
          userId: userId
        });
        console.log(`✅ [SLASH] ${characterName} 포럼 업데이트 완료`);
      }
    } catch (error) {
      console.error(`❌ [SLASH] 포럼 업데이트 실패:`, error.message);
    }
  }

  async handle(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
      switch (commandName) {
        // 시트 명령어
        case '시트등록':
          await this.handleSheetRegister(interaction);
          break;
        case '시트동기화':
          await this.handleSheetSync(interaction);
          break;
        case '시트푸시':
          await this.handleSheetPush(interaction);
          break;
        case '시트해제':
          await this.handleSheetUnregister(interaction);
          break;
          
        // 캐릭터 명령어
        case '지정':
          await this.handleSetActive(interaction);
          break;
        case '지정해제':
          await this.handleUnsetActive(interaction);
          break;
        case '시트확인':
          await this.handleCheckSheet(interaction);
          break;
        case '내캐릭터':
          await this.handleMyCharacters(interaction);
          break;
        case '이모지':
          await this.handleEmoji(interaction);
          break;
        case '캐릭터삭제':
          await this.handleDeleteCharacter(interaction);
          break;
          
        // 로이스 명령어
        case '로이스':
          await this.handleLois(interaction);
          break;
        case '타이터스':
          await this.handleTitus(interaction);
          break;
          
        // 관리 명령어
        case '리셋':
          await this.handleReset(interaction);
          break;
        case '도움':
          await this.handleHelp(interaction);
          break;
          
        default:
          await interaction.reply({ content: '❌ 알 수 없는 명령어입니다.', ephemeral: true });
      }
    } catch (error) {
      console.error(`슬래시 커맨드 오류 (/${commandName}):`, error);
      
      const errorMsg = formatError(`명령어 처리 중 오류가 발생했습니다: ${error.message}`);
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: errorMsg, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMsg, ephemeral: true });
      }
    }
  }

  // ============================================
  // 시트 명령어
  // ============================================

  async handleSheetRegister(interaction) {
    await interaction.deferReply();
    
    const url = interaction.options.getString('url');
    const tabName = interaction.options.getString('탭이름');
    
    const result = await this.sheetCmd.registerSheet(interaction, url, tabName);
    
    if (result.success) {
      await interaction.editReply(formatSuccess(result.message));
    } else {
      await interaction.editReply(formatError(result.message));
    }
  }

  async handleSheetSync(interaction) {
    await interaction.deferReply();
    
    const result = await this.sheetCmd.syncSheet(interaction);
    await interaction.editReply(result.success ? formatSuccess(result.message) : formatError(result.message));
  }

  async handleSheetPush(interaction) {
    await interaction.deferReply();
    
    const mockMessage = this.createMockMessage(interaction);
    await this.sheetCmd.push(mockMessage);
  }

  async handleSheetUnregister(interaction) {
    await interaction.deferReply();
    
    const serverId = interaction.guild.id;
    const userId = interaction.user.id;
    const sheetInfo = this.db.getUserSheet(serverId, userId);

    if (!sheetInfo) {
      return await interaction.editReply(formatError('등록된 시트가 없습니다.'));
    }

    this.db.setUserSheet(serverId, userId, null);
    await interaction.editReply(formatSuccess('시트 연동이 해제되었습니다.'));
  }

  // ============================================
  // 캐릭터 명령어
  // ============================================

  async handleSetActive(interaction) {
    await interaction.deferReply();
    
    const characterName = interaction.options.getString('캐릭터이름');
    const serverId = interaction.guild.id;
    const userId = interaction.user.id;
    
    let characterData = this.db.getCharacter(serverId, userId, characterName);
    
    if (!characterData) {
      return await interaction.editReply(formatError(`캐릭터 "${characterName}"를 찾을 수 없습니다. 먼저 \`/시트등록\`을 해주세요.`));
    }
    
    // 🔥 시트 연동 캐릭터면 자동 동기화 (DB 값 보존)
    const sheetInfo = this.db.getCharacterSheet(serverId, userId, characterName);
    if (sheetInfo && this.sheets) {
      try {
        console.log(`🔄 [지정] 시트 연동 캐릭터 발견: ${characterName}`);
        const sheetData = await this.sheets.readFullCharacter(sheetInfo.spreadsheetId, sheetInfo.sheetName);
        
        if (sheetData && sheetData.characterName) {
          // DB 실시간 값 보존
          if (characterData.침식률 !== undefined) sheetData.침식률 = characterData.침식률;
          if (characterData.HP !== undefined) sheetData.HP = characterData.HP;
          if (characterData.침식D !== undefined) sheetData.침식D = characterData.침식D;
          if (characterData.emoji) sheetData.emoji = characterData.emoji;
          if (characterData.imageUrl) sheetData.imageUrl = characterData.imageUrl;
          
          characterData = sheetData;
          this.db.setCharacter(serverId, userId, characterName, characterData);
        }
      } catch (error) {
        console.error(`❌ [지정] 시트 동기화 실패:`, error.message);
      }
    }
    
    this.db.setActiveCharacter(serverId, userId, characterName);
    
    const emoji = characterData.emoji || '✅';
    const codeName = characterData.codeName || '';
    const sheetIcon = sheetInfo ? ' (시트 연동 ✨)' : '';
    
    await interaction.editReply(
      `${emoji} **${characterName}** ${codeName ? `「${codeName}」` : ''} 활성화!${sheetIcon}\n` +
      `💚 HP: ${characterData.HP || 0} | 🔴 침식률: ${characterData.침식률 || 0}`
    );
  }

  async handleUnsetActive(interaction) {
    const serverId = interaction.guild.id;
    const userId = interaction.user.id;
    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    
    if (!activeCharName) {
      return interaction.reply({ content: formatError('활성화된 캐릭터가 없습니다.'), ephemeral: true });
    }
    
    this.db.clearActiveCharacter(serverId, userId);
    
    await interaction.reply({ content: `⚪ **${activeCharName}** 활성 해제`, ephemeral: false });
  }

  async handleCheckSheet(interaction) {
    await interaction.deferReply();
    
    const mockMessage = this.createMockMessage(interaction);
    
    try {
      await this.characterCmd.checkSheet(mockMessage);
    } catch (error) {
      await interaction.editReply(formatError(`시트 확인 실패: ${error.message}`));
    }
  }

  async handleMyCharacters(interaction) {
    await interaction.deferReply();
    
    const mockMessage = this.createMockMessage(interaction);
    await this.characterCmd.listMyCharacters(mockMessage);
  }

  async handleEmoji(interaction) {
    const emoji = interaction.options.getString('이모지');
    
    const serverId = interaction.guild.id;
    const userId = interaction.user.id;
    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    
    if (!activeCharName) {
      return interaction.reply({ content: formatError('활성화된 캐릭터가 없습니다.'), ephemeral: true });
    }
    
    const characterData = this.db.getCharacter(serverId, userId, activeCharName);
    characterData.emoji = emoji;
    this.db.setCharacter(serverId, userId, activeCharName, characterData);
    
    await interaction.reply({ 
      content: formatSuccess(`${emoji} **${activeCharName}**의 이모지가 설정되었습니다!`), 
      ephemeral: false 
    });
  }

  async handleDeleteCharacter(interaction) {
    const characterName = interaction.options.getString('이름');
    
    const serverId = interaction.guild.id;
    const userId = interaction.user.id;
    
    const characterData = this.db.getCharacter(serverId, userId, characterName);
    
    if (!characterData) {
      return interaction.reply({ content: formatError(`캐릭터 "${characterName}"를 찾을 수 없습니다.`), ephemeral: true });
    }
    
    this.db.deleteCharacter(serverId, userId, characterName);
    
    // 활성 캐릭터였다면 해제
    if (this.db.getActiveCharacter(serverId, userId) === characterName) {
      this.db.clearActiveCharacter(serverId, userId);
    }
    
    await interaction.reply({ 
      content: formatSuccess(`**${characterName}** 캐릭터가 삭제되었습니다.`), 
      ephemeral: false 
    });
  }

  // ============================================
  // 로이스 명령어
  // ============================================

  async handleLois(interaction) {
    const name = interaction.options.getString('이름');
    const pEmotion = interaction.options.getString('p감정');
    const nEmotion = interaction.options.getString('n감정');
    const description = interaction.options.getString('내용') || '';
    
    const serverId = interaction.guild.id;
    const userId = interaction.user.id;
    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    
    if (!activeCharName) {
      return interaction.reply({ content: formatError('활성화된 캐릭터가 없습니다.'), ephemeral: true });
    }
    
    const characterData = this.db.getCharacter(serverId, userId, activeCharName);
    if (!characterData.lois) characterData.lois = [];
    
    // 메인 감정 강조 처리
    let formattedP = pEmotion;
    let formattedN = nEmotion;
    let pMain = false, nMain = false;
    
    if (pEmotion.includes('*')) {
      formattedP = pEmotion.replace('*', '');
      pMain = true;
    }
    if (nEmotion.includes('*')) {
      formattedN = nEmotion.replace('*', '');
      nMain = true;
    }
    
    characterData.lois.push({
      name,
      pEmotion: formattedP,
      nEmotion: formattedN,
      pMain,
      nMain,
      description,
      isTitus: false
    });
    
    this.db.setCharacter(serverId, userId, activeCharName, characterData);
    
    // 표시용 포맷
    const displayP = pMain ? `【${formattedP}】` : formattedP;
    const displayN = nMain ? `【${formattedN}】` : formattedN;
    
    await interaction.reply({ 
      content: formatSuccess(`**${activeCharName}**의 로이스 **"${name}"** 추가!\n> ${displayP} / ${displayN}\n> ${description}`), 
      ephemeral: false 
    });
    
    // 🔥 포럼 업데이트
    await this.updateForumFirstChunk(interaction.guild, serverId, userId, activeCharName);
  }

  async handleTitus(interaction) {
    await interaction.deferReply();
    
    const loisName = interaction.options.getString('이름');
    const serverId = interaction.guild.id;
    const userId = interaction.user.id;
    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    
    if (!activeCharName) {
      return await interaction.editReply(formatError('활성화된 캐릭터가 없습니다.'));
    }
    
    const characterData = this.db.getCharacter(serverId, userId, activeCharName);
    
    if (!characterData.lois || characterData.lois.length === 0) {
      return await interaction.editReply(formatError('등록된 로이스가 없습니다.'));
    }
    
    // 띄어쓰기 무시하고 검색
    const normalizedInput = loisName.replace(/\s+/g, '');
    const loisIndex = characterData.lois.findIndex(l => 
      l.name.replace(/\s+/g, '') === normalizedInput
    );
    
    if (loisIndex === -1) {
      return await interaction.editReply(formatError(`로이스 "${loisName}"를 찾을 수 없습니다.`));
    }
    
    const lois = characterData.lois[loisIndex];
    
    if (lois.isTitus) {
      return await interaction.editReply(formatError(`"${lois.name}"는 이미 타이터스입니다.`));
    }
    
    // 타이터스로 변환
    characterData.lois[loisIndex].isTitus = true;
    this.db.setCharacter(serverId, userId, activeCharName, characterData);
    
    const emoji = characterData.emoji || '🔥';
    
    await interaction.editReply(
      `${emoji} **${activeCharName}**의 로이스 **"${lois.name}"**이(가) 타이터스로 승화되었습니다!\n` +
      `> ~~${lois.pEmotion} / ${lois.nEmotion}~~\n` +
      `💡 타이터스 효과를 사용하면 로이스가 소멸합니다.`
    );
    
    // 🔥 포럼 업데이트
    await this.updateForumFirstChunk(interaction.guild, serverId, userId, activeCharName);
  }

  // ============================================
  // 관리 명령어
  // ============================================

  async handleReset(interaction) {
    const item = interaction.options.getString('항목') || '전체';
    
    const serverId = interaction.guild.id;
    const userId = interaction.user.id;
    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    
    if (!activeCharName) {
      return interaction.reply({ content: formatError('활성화된 캐릭터가 없습니다.'), ephemeral: true });
    }
    
    const characterData = this.db.getCharacter(serverId, userId, activeCharName);
    
    switch (item) {
      case '전체':
        this.db.setCharacter(serverId, userId, activeCharName, {});
        await interaction.reply({ 
          content: formatSuccess(`**${activeCharName}**의 모든 데이터가 초기화되었습니다.`), 
          ephemeral: false 
        });
        break;
        
      case '로이스':
        characterData.lois = [];
        this.db.setCharacter(serverId, userId, activeCharName, characterData);
        await interaction.reply({ 
          content: formatSuccess(`**${activeCharName}**의 로이스가 초기화되었습니다.`), 
          ephemeral: false 
        });
        break;
        
      case '콤보':
        characterData.combos = [];
        this.db.setCharacter(serverId, userId, activeCharName, characterData);
        await interaction.reply({ 
          content: formatSuccess(`**${activeCharName}**의 콤보가 초기화되었습니다.`), 
          ephemeral: false 
        });
        break;
        
      case '이펙트':
        characterData.effects = [];
        this.db.setCharacter(serverId, userId, activeCharName, characterData);
        await interaction.reply({ 
          content: formatSuccess(`**${activeCharName}**의 이펙트가 초기화되었습니다.`), 
          ephemeral: false 
        });
        break;
        
      default:
        await interaction.reply({ 
          content: formatError('유효한 항목: 전체, 로이스, 콤보, 이펙트'), 
          ephemeral: true 
        });
    }
  }

  async handleHelp(interaction) {
    const helpText = `
📖 **DX3bot 슬래시 명령어**

**📊 시트 관리**
\`/시트등록 [URL]\` - Google Sheets 등록
\`/시트동기화\` - 시트 → 봇 동기화
\`/시트푸시\` - 봇 → 시트 업로드
\`/시트해제\` - 시트 연동 해제

**👤 캐릭터**
\`/지정 [캐릭터이름]\` - 캐릭터 활성화
\`/지정해제\` - 캐릭터 비활성화
\`/시트확인\` - 시트 확인 & 포럼 업데이트
\`/내캐릭터\` - 내 캐릭터 목록
\`/이모지 [이모지]\` - 이모지 설정
\`/캐릭터삭제 [이름]\` - 캐릭터 삭제

**💔 로이스**
\`/로이스 [이름] [P감정] [N감정] [내용]\` - 로이스 추가
\`/타이터스 [이름]\` - 타이터스 변환

**🔧 관리**
\`/리셋 [항목]\` - 데이터 초기화

**⚡ 빠른 명령어 (!)**
\`!침식률+10\` \`!HP-5\` - 상태 변경
\`!판정 백병\` - 판정 굴림
\`!등침\` - 등장 침식
\`!@콤보명\` - 콤보/이펙트 호출
    `.trim();
    
    await interaction.reply({ content: helpText, ephemeral: true });
  }

  // ============================================
  // 유틸리티
  // ============================================

  /**
   * Interaction을 Message 객체로 변환
   */
  createMockMessage(interaction) {
    return {
      guild: interaction.guild,
      author: interaction.user,
      channel: {
        ...interaction.channel,
        send: async (content) => {
          if (interaction.deferred || interaction.replied) {
            return await interaction.followUp(content);
          } else {
            return await interaction.reply(content);
          }
        }
      },
      reply: async (content) => {
        try {
          if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(typeof content === 'string' ? content : content);
          } else {
            return await interaction.reply(content);
          }
        } catch (error) {
          console.error('mockMessage.reply 오류:', error);
          return await interaction.followUp(content);
        }
      },
      delete: async () => Promise.resolve(),
      attachments: { size: 0 }
    };
  }
}

module.exports = SlashCommandHandler;