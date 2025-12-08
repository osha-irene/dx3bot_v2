/**
 * 슬래시 커맨드 핸들러
 */

const { formatError, formatSuccess } = require('./utils/helpers');

class SlashCommandHandler {
  constructor(database, sheetsClient, characterCmd, sheetCmd, combatCmd) {
    this.db = database;
    this.sheets = sheetsClient;
    this.characterCmd = characterCmd;
    this.sheetCmd = sheetCmd;
    this.combatCmd = combatCmd;
  }

  async handle(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
      switch (commandName) {
        case '시트등록':
          await this.handleSheetRegister(interaction);
          break;
        case '시트동기화':
          await this.handleSheetSync(interaction);
          break;
        case '지정':
          await this.handleSetActive(interaction);
          break;
        case '지정해제':
          await this.handleUnsetActive(interaction);
          break;
        case '시트확인':
          await this.handleCheckSheet(interaction);
          break;
        case '이모지':
          await this.handleEmoji(interaction);
          break;
        case '캐릭터삭제':
          await this.handleDeleteCharacter(interaction);
          break;
        case '리셋':
          await this.handleReset(interaction);
          break;
        case '로이스':
          await this.handleLois(interaction);
          break;
        case '타이터스':
          await this.handleTitus(interaction);
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

  async handleSheetRegister(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const url = interaction.options.getString('url');
    
    // 기존 sheetCmd의 registerSheet 함수 활용
    // 하지만 포럼 자동 생성 + 시트 자동 생성 추가
    const result = await this.sheetCmd.registerSheet(interaction, url);
    
    if (result.success) {
      // 자동으로 시트확인 실행 (포럼 생성 + 스레드 생성)
      try {
        await this.characterCmd.checkSheet(interaction);
        await interaction.editReply(formatSuccess('✅ 시트 등록 완료!\n📊 포럼 스레드가 자동으로 생성되었습니다.'));
      } catch (error) {
        await interaction.editReply(formatSuccess('✅ 시트는 등록되었지만 포럼 생성에 실패했습니다.\n수동으로 `/시트확인`을 실행해주세요.'));
      }
    } else {
      await interaction.editReply(formatError(result.message));
    }
  }

  async handleSheetSync(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const result = await this.sheetCmd.syncSheet(interaction);
    await interaction.editReply(result.success ? formatSuccess(result.message) : formatError(result.message));
  }

  async handleSetActive(interaction) {
    const characterName = interaction.options.getString('캐릭터이름');
    
    const serverId = interaction.guild.id;
    const userId = interaction.user.id;
    
    const characterData = this.db.getCharacter(serverId, userId, characterName);
    
    if (!characterData) {
      return interaction.reply({ 
        content: formatError(`캐릭터 "${characterName}"를 찾을 수 없습니다. 먼저 \`/시트등록\`을 해주세요.`), 
        ephemeral: true 
      });
    }
    
    this.db.setActiveCharacter(serverId, userId, characterName);
    
    const emoji = characterData.emoji || '✅';
    const codeName = characterData.codeName || '';
    
    await interaction.reply({ 
      content: `${emoji} **${characterName}** ${codeName ? `「${codeName}」` : ''} 활성화!`, 
      ephemeral: false 
    });
  }

  async handleUnsetActive(interaction) {
    const serverId = interaction.guild.id;
    const userId = interaction.user.id;
    
    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    
    if (!activeCharName) {
      return interaction.reply({ 
        content: formatError('활성화된 캐릭터가 없습니다.'), 
        ephemeral: true 
      });
    }
    
    this.db.setActiveCharacter(serverId, userId, null);
    
    await interaction.reply({ 
      content: formatSuccess(`**${activeCharName}** 캐릭터 지정 해제!`), 
      ephemeral: false 
    });
  }

  async handleCheckSheet(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      await this.characterCmd.checkSheet(interaction);
      await interaction.editReply({ content: '✅ 시트가 업데이트되었습니다!', ephemeral: true });
    } catch (error) {
      await interaction.editReply({ content: formatError(`시트 확인 실패: ${error.message}`), ephemeral: true });
    }
  }

  async handleEmoji(interaction) {
    const emoji = interaction.options.getString('이모지');
    
    const serverId = interaction.guild.id;
    const userId = interaction.user.id;
    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    
    if (!activeCharName) {
      return interaction.reply({ 
        content: formatError('활성화된 캐릭터가 없습니다.'), 
        ephemeral: true 
      });
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
      return interaction.reply({ 
        content: formatError(`캐릭터 "${characterName}"를 찾을 수 없습니다.`), 
        ephemeral: true 
      });
    }
    
    this.db.deleteCharacter(serverId, userId, characterName);
    
    await interaction.reply({ 
      content: formatSuccess(`**${characterName}** 캐릭터가 삭제되었습니다.`), 
      ephemeral: false 
    });
  }

  async handleReset(interaction) {
    const item = interaction.options.getString('항목') || '전체';
    
    const serverId = interaction.guild.id;
    const userId = interaction.user.id;
    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    
    if (!activeCharName) {
      return interaction.reply({ 
        content: formatError('활성화된 캐릭터가 없습니다.'), 
        ephemeral: true 
      });
    }
    
    const characterData = this.db.getCharacter(serverId, userId, activeCharName);
    
    if (item === '전체') {
      this.db.setCharacter(serverId, userId, activeCharName, {});
      await interaction.reply({ 
        content: formatSuccess(`**${activeCharName}**의 모든 데이터가 초기화되었습니다.`), 
        ephemeral: false 
      });
    } else if (item === '로이스') {
      characterData.lois = [];
      this.db.setCharacter(serverId, userId, activeCharName, characterData);
      await interaction.reply({ 
        content: formatSuccess(`**${activeCharName}**의 로이스가 초기화되었습니다.`), 
        ephemeral: false 
      });
    } else if (item === '이펙트') {
      characterData.effects = [];
      this.db.setCharacter(serverId, userId, activeCharName, characterData);
      await interaction.reply({ 
        content: formatSuccess(`**${activeCharName}**의 이펙트가 초기화되었습니다.`), 
        ephemeral: false 
      });
    }
  }

  async handleLois(interaction) {
    const name = interaction.options.getString('이름');
    const pEmotion = interaction.options.getString('p감정');
    const nEmotion = interaction.options.getString('n감정');
    const description = interaction.options.getString('내용');
    
    const serverId = interaction.guild.id;
    const userId = interaction.user.id;
    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    
    if (!activeCharName) {
      return interaction.reply({ 
        content: formatError('활성화된 캐릭터가 없습니다.'), 
        ephemeral: true 
      });
    }
    
    const characterData = this.db.getCharacter(serverId, userId, activeCharName);
    if (!characterData.lois) characterData.lois = [];
    
    // 메인 감정 강조
    const formattedP = pEmotion.includes('*') ? `【P: ${pEmotion.replace('*', '')}】` : `P: ${pEmotion}`;
    const formattedN = nEmotion.includes('*') ? `【N: ${nEmotion.replace('*', '')}】` : `N: ${nEmotion}`;
    
    characterData.lois.push({
      name,
      pEmotion: formattedP,
      nEmotion: formattedN,
      description
    });
    
    this.db.setCharacter(serverId, userId, activeCharName, characterData);
    
    await interaction.reply({ 
      content: formatSuccess(`**${activeCharName}**의 로이스 **"${name}"**가 추가되었습니다.\n${formattedP} / ${formattedN}\n${description}`), 
      ephemeral: false 
    });
  }

  async handleTitus(interaction) {
    const loisName = interaction.options.getString('이름');
    
    const serverId = interaction.guild.id;
    const userId = interaction.user.id;
    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    
    if (!activeCharName) {
      return interaction.reply({ 
        content: formatError('활성화된 캐릭터가 없습니다.'), 
        ephemeral: true 
      });
    }
    
    const characterData = this.db.getCharacter(serverId, userId, activeCharName);
    
    if (!characterData.lois || characterData.lois.length === 0) {
      return interaction.reply({ 
        content: formatError('등록된 로이스가 없습니다.'), 
        ephemeral: true 
      });
    }
    
    const loisIndex = characterData.lois.findIndex(l => l.name === loisName);
    
    if (loisIndex === -1) {
      return interaction.reply({ 
        content: formatError(`로이스 "${loisName}"를 찾을 수 없습니다.`), 
        ephemeral: true 
      });
    }
    
    // 타이터스로 변환 (침식률 +5)
    characterData.침식률 = (characterData.침식률 || 0) + 5;
    
    // 로이스에 타이터스 플래그 추가 (삭제하지 않고 표시만)
    characterData.lois[loisIndex].isTitus = true;
    
    this.db.setCharacter(serverId, userId, activeCharName, characterData);
    
    await interaction.reply({ 
      content: formatSuccess(`🔥 **${activeCharName}**의 로이스 **"${loisName}"**가 타이터스로 변환되었습니다!\n침식률 +5 → 현재 침식률: ${characterData.침식률}`), 
      ephemeral: false 
    });
  }

  async handleHelp(interaction) {
    const helpText = `
📖 **DX3bot 슬래시 커맨드**

**시트 관리**
\`/시트등록 [URL]\` - Google Sheets 연동 (자동으로 포럼 생성!)
\`/시트동기화\` - 시트 ↔ 봇 동기화
\`/지정 [캐릭터이름]\` - 캐릭터 활성화
\`/지정해제\` - 캐릭터 비활성화
\`/시트확인\` - 포럼에 시트 표시

**캐릭터 설정**
\`/이모지 [이모지]\` - 이모지 설정
\`/캐릭터삭제 [이름]\` - 캐릭터 삭제
\`/리셋 [항목]\` - 데이터 초기화

**로이스**
\`/로이스 [이름] [P감정] [N감정] [내용]\` - 로이스 추가
\`/타이터스 [이름]\` - 로이스 → 타이터스 (침식률 +5)

**빠른 명령어 (! 사용)**
\`!판정 [항목]\` - 주사위 굴리기
\`!등침\` - 등장 침식
\`!침식률+10\` - 침식률 변경
\`!HP-5\` - HP 변경
\`!@콤보명\` - 콤보 호출
\`!타이터스 [이름]\` - 타이터스 변환
    `.trim();
    
    await interaction.reply({ content: helpText, ephemeral: true });
  }
}

module.exports = SlashCommandHandler;