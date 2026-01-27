/**
 * 슬래시 커맨드 핸들러
 * Discord의 / 명령어 처리
 */

class SlashCommandHandler {
  constructor(database, sheetsClient, charCmd, sheetCmd, combatCmd) {
    this.db = database;
    this.sheets = sheetsClient;
    this.charCmd = charCmd;
    this.sheetCmd = sheetCmd;
    this.combatCmd = combatCmd;
  }

  /**
   * 슬래시 커맨드 처리
   */
  async handle(interaction) {
    const { commandName } = interaction;

    try {
      switch (commandName) {
        // 시트 명령어
        case '시트등록':
          return await this.handleSheetRegister(interaction);
        case '시트동기화':
          return await this.handleSheetSync(interaction);
        case '시트푸시':
          return await this.handleSheetPush(interaction);
        case '시트해제':
          return await this.handleSheetUnregister(interaction);

        // 캐릭터 명령어
        case '지정':
          return await this.handleSetActive(interaction);
        case '지정해제':
          return await this.handleUnsetActive(interaction);
        case '시트확인':
          return await this.handleCheckSheet(interaction);
        case '내캐릭터':
          return await this.handleMyCharacters(interaction);

        // 전투 명령어
        case '판정':
          return await this.handleRoll(interaction);
        case '등침':
          return await this.handleEntryErosion(interaction);

        default:
          return await interaction.reply({ 
            content: '❌ 알 수 없는 명령어입니다.', 
            ephemeral: true 
          });
      }
    } catch (error) {
      console.error('슬래시 커맨드 처리 오류:', error);
      
      if (interaction.deferred || interaction.replied) {
        return await interaction.editReply({ 
          content: `❌ 명령어 처리 중 오류가 발생했습니다: ${error.message}` 
        });
      } else {
        return await interaction.reply({ 
          content: `❌ 명령어 처리 중 오류가 발생했습니다: ${error.message}`, 
          ephemeral: true 
        });
      }
    }
  }

  /**
   * /시트등록
   */
  async handleSheetRegister(interaction) {
    await interaction.deferReply();
    
    const url = interaction.options.getString('url');
    const tabName = interaction.options.getString('탭이름');
    
    // message 객체 변환
    const mockMessage = this.createMockMessage(interaction);
    const params = tabName ? [url, tabName] : [url];
    
    await this.sheetCmd.register(mockMessage, params);
  }

  /**
   * /시트동기화
   */
  async handleSheetSync(interaction) {
    await interaction.deferReply();
    
    const mockMessage = this.createMockMessage(interaction);
    await this.sheetCmd.sync(mockMessage);
  }

  /**
   * /시트푸시
   */
  async handleSheetPush(interaction) {
    await interaction.deferReply();
    
    const mockMessage = this.createMockMessage(interaction);
    await this.sheetCmd.push(mockMessage);
  }

  /**
   * /시트해제
   */
  async handleSheetUnregister(interaction) {
    await interaction.deferReply();
    
    const mockMessage = this.createMockMessage(interaction);
    await this.sheetCmd.unregister(mockMessage);
  }

  /**
   * /지정
   */
  async handleSetActive(interaction) {
    const characterName = interaction.options.getString('캐릭터');
    
    const mockMessage = this.createMockMessage(interaction);
    await this.charCmd.setActive(mockMessage, [characterName]);
  }

  /**
   * /지정해제
   */
  async handleUnsetActive(interaction) {
    const mockMessage = this.createMockMessage(interaction);
    await this.charCmd.unsetActive(mockMessage);
  }

  /**
   * /시트확인
   */
  async handleCheckSheet(interaction) {
    const mockMessage = this.createMockMessage(interaction);
    await this.charCmd.checkSheet(mockMessage);
  }

  /**
   * /내캐릭터
   */
  async handleMyCharacters(interaction) {
    const mockMessage = this.createMockMessage(interaction);
    await this.charCmd.myCharacters(mockMessage);
  }

  /**
   * /판정
   */
  async handleRoll(interaction) {
    const skill = interaction.options.getString('항목');
    
    const mockMessage = this.createMockMessage(interaction);
    await this.combatCmd.roll(mockMessage, [skill]);
  }

  /**
   * /등침
   */
  async handleEntryErosion(interaction) {
    const mockMessage = this.createMockMessage(interaction);
    await this.combatCmd.entryErosion(mockMessage);
  }

  /**
   * Interaction을 Message 객체로 변환
   */
  createMockMessage(interaction) {
    return {
      guild: interaction.guild,
      author: interaction.user,
      channel: interaction.channel,
      reply: async (content) => {
        if (typeof content === 'string') {
          return await interaction.editReply(content);
        } else {
          return await interaction.editReply(content);
        }
      }
    };
  }
}

module.exports = SlashCommandHandler;
