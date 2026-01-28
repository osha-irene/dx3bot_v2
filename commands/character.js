/**
 * 캐릭터 관리 명령어 (메인 컨트롤러)
 */

const { formatError, formatSuccess, extractName } = require('../utils/helpers');
const StatusPanelModule = require('./modules/statusPanel');
const CharacterDataModule = require('./modules/characterData');
const CharacterSheetModule = require('./modules/characterSheet');
const CharacterAttributesModule = require('./modules/characterAttributes');
const CharacterListModule = require('./modules/characterList');


class CharacterCommands {
  constructor(database, sheetsClient = null, forumCmd = null, client = null) { 
    this.db = database;
    this.sheets = sheetsClient;
    this.forumCmd = forumCmd;
    this.client = client;
    
    // 서브 모듈 초기화
    this.statusPanelModule = new StatusPanelModule(database);
    this.dataModule = new CharacterDataModule(database, sheetsClient);
    this.sheetModule = new CharacterSheetModule(database, forumCmd, sheetsClient);
    this.attributesModule = new CharacterAttributesModule(database, sheetsClient);
    this.listModule = new CharacterListModule(database);
  }

  // ============================================
  // 데이터 조회 (위임)
  // ============================================

  async getActiveCharacterData(message) {
    return await this.dataModule.getActiveCharacterData(message);
  }

  // ============================================
  // 상태 패널
  // ============================================

  async statusPanel(message) {
    return await this.statusPanelModule.createOrUpdatePanel(message);
  }

  async updateStatusPanel(guild, serverId) {
    return await this.statusPanelModule.autoUpdate(guild, serverId);
  }

  // ============================================
  // 캐릭터 기본 관리
  // ============================================

  async inputSheet(message, args) {
    return await this.dataModule.inputSheet(message, args, formatError, formatSuccess);
  }

  async setActive(message, args) {
    return await this.dataModule.setActive(
      message, 
      args, 
      formatError, 
      this.updateStatusPanel.bind(this)
    );
  }

  async unsetActive(message) {
    return await this.dataModule.unsetActive(
      message, 
      formatError, 
      this.updateStatusPanel.bind(this)
    );
  }

  async deleteCharacter(message, args) {
    return await this.dataModule.deleteCharacter(
      message, 
      args, 
      formatError, 
      formatSuccess, 
      extractName
    );
  }

  // ============================================
  // 시트 확인 및 포럼
  // ============================================

  async checkSheet(message) {
    return await this.sheetModule.checkSheet(
      message,
      this.getActiveCharacterData.bind(this),
      formatError
    );
  }

  async autoUpdateSheet(guild, serverId, userId, characterName) {
    return await this.sheetModule.autoUpdateSheet(guild, serverId, userId, characterName);
  }

  // ============================================
  // 캐릭터 속성 설정
  // ============================================

  /**
   * 캐릭터 이미지 설정 (인장)
   * 명령어: !인장 [URL] 또는 !인장 (이미지 첨부)
   */
  async handleSetCharacterImage(message, args) {
    const activeChar = await this.getActiveCharacterData(message);
    if (!activeChar) return message.reply(formatError('활성화된 캐릭터가 없습니다.'));

    const serverId = message.guild.id;
    const userId = message.author.id;
    const characterName = activeChar.name;

    let imageUrl = args[0];

    // ✅ 이미지 첨부 확인 (URL보다 우선)
    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
      if (attachment.contentType && attachment.contentType.startsWith('image/')) {
        imageUrl = attachment.url;
        console.log(`📎 [IMAGE] 첨부 이미지 감지:`, imageUrl);
      }
    }

    // 제거 로직
    if (imageUrl === '제거' || imageUrl === '삭제') {
      activeChar.data.imageUrl = null;
      await this.db.setCharacter(serverId, userId, characterName, activeChar.data);
      
      // 포럼 업데이트 (이미지 제거)
      if (this.forumCmd) {
        const characterData = {
          characterName: characterName,
          ...activeChar.data,
          serverId: serverId,
          userId: userId
        };
        await this.forumCmd.createCharacterSheetThread(
          message.guild, serverId, userId, characterData
        );
      }
      
      return message.reply(formatSuccess('캐릭터 이미지가 제거되었습니다.'));
    }

    // ✅ URL도 없고 첨부도 없으면 안내 메시지
    if (!imageUrl) {
      return message.reply(
        formatError('이미지 URL을 입력하거나 이미지 파일을 첨부해주세요.') + '\n\n' +
        '**사용법:**\n' +
        '`!인장 https://i.imgur.com/example.png` (URL 입력)\n' +
        '`!인장` + 이미지 첨부 (파일 첨부)\n' +
        '`!인장 제거` (이미지 제거)'
      );
    }

    // URL 유효성 검사
    if (!imageUrl.startsWith('http')) {
      return message.reply(formatError('올바른 URL 형식이 아닙니다.'));
    }

    // 데이터 반영
    activeChar.data.imageUrl = imageUrl;
    
    // 데이터베이스 저장
    await this.db.setCharacter(serverId, userId, characterName, activeChar.data);
    
    console.log(`🖼️ [IMAGE] 이미지 설정됨:`, imageUrl);
    console.log(`  - characterName:`, characterName);

    // ✅ 포럼 즉시 업데이트
    if (this.forumCmd) {
      const characterData = {
        characterName: characterName,
        ...activeChar.data,
        serverId: serverId,
        userId: userId
      };
      
      await this.forumCmd.createCharacterSheetThread(
        message.guild,
        serverId,
        userId,
        characterData
      );
      
      console.log(`✅ [IMAGE] 포럼 업데이트 완료`);
    }

    return message.reply(formatSuccess('인장이 설정되었습니다! 포럼에서 확인해보세요.'));
  }
  
  async setCodeName(message, args) {
    return await this.attributesModule.setCodeName(
      message, 
      args, 
      this.getActiveCharacterData.bind(this)
    );
  }

  async setEmoji(message, args) {
    return await this.attributesModule.setEmoji(
      message, 
      args, 
      this.getActiveCharacterData.bind(this)
    );
  }

  async setColor(message, args) {
    return await this.attributesModule.setColor(
      message, 
      args, 
      this.getActiveCharacterData.bind(this)
    );
  }

  async setCover(message, args) {
    return await this.attributesModule.setCover(
      message, 
      args, 
      this.getActiveCharacterData.bind(this)
    );
  }

  async setWorks(message, args) {
    return await this.attributesModule.setWorks(
      message, 
      args, 
      this.getActiveCharacterData.bind(this)
    );
  }

  async setBreed(message, args) {
    return await this.attributesModule.setBreed(
      message, 
      args, 
      this.getActiveCharacterData.bind(this)
    );
  }

  async setSyndrome(message, args) {
    return await this.attributesModule.setSyndrome(
      message, 
      args, 
      this.getActiveCharacterData.bind(this)
    );
  }

  async setAwakening(message, args) {
    return await this.attributesModule.setAwakening(
      message, 
      args, 
      this.getActiveCharacterData.bind(this)
    );
  }

  async setImpulse(message, args) {
    return await this.attributesModule.setImpulse(
      message, 
      args, 
      this.getActiveCharacterData.bind(this)
    );
  }

  async setDLois(message, args) {
    return await this.attributesModule.setDLois(
      message, 
      args, 
      this.getActiveCharacterData.bind(this)
    );
  }

  // ============================================
  // 캐릭터 목록
  // ============================================

  async listMyCharacters(message) {
    return await this.listModule.listMyCharacters(message);
  }

  async listServerCharacters(message) {
    return await this.listModule.listServerCharacters(message);
  }

  async checkCombos(message) {
    return await this.listModule.checkCombos(
      message,
      this.getActiveCharacterData.bind(this)
    );
  }

  // ============================================
  // 하위 호환성 (기존 코드와의 호환)
  // ============================================

  async sheetInput(message, args) {
    return await this.inputSheet(message, args);
  }

  async myCharacters(message) {
    return await this.listMyCharacters(message);
  }

  async serverCharacters(message) {
    return await this.listServerCharacters(message);
  }

  // handleAtCall은 combat.js에서 처리하므로 여기서는 제거
}

module.exports = CharacterCommands;