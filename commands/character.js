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
  constructor(database, sheetsClient) {
    this.db = database;
    this.sheets = sheetsClient;
    
    // 서브 모듈 초기화
    this.statusPanelModule = new StatusPanelModule(database);
    this.dataModule = new CharacterDataModule(database, sheetsClient);
    this.sheetModule = new CharacterSheetModule(database, sheetsClient);
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
   * !캐릭터이미지 [URL] - 캐릭터 이미지 설정
   */
  async SetCharacterImage(message, args) {
    const activeChar = await this.getActiveCharacterData(message);
    
    if (!activeChar) {
      return message.reply(formatError('활성화된 캐릭터가 없습니다.'));
    }

    if (args.length === 0) {
      return message.channel.send(
        formatError('사용법: `!캐릭터이미지 [이미지 URL]`') + '\n\n' +
        '**예시:**\n' +
        '`!캐릭터이미지 https://example.com/character.png`\n' +
        '`!캐릭터이미지 제거` - 이미지 제거'
      );
    }

    const imageUrl = args[0];

    if (imageUrl === '제거' || imageUrl === '삭제') {
      delete activeChar.data.imageUrl;
      this.db.saveCharacter(activeChar.serverId, activeChar.userId, activeChar.name, activeChar.data);
      return message.reply(formatSuccess('캐릭터 이미지가 제거되었습니다.'));
    }

    // URL 유효성 검사 (간단)
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      return message.reply(formatError('올바른 URL 형식이 아닙니다. http:// 또는 https://로 시작해야 합니다.'));
    }

    activeChar.data.imageUrl = imageUrl;
    this.db.saveCharacter(activeChar.serverId, activeChar.userId, activeChar.name, activeChar.data);

    return message.reply(
      formatSuccess('캐릭터 이미지가 설정되었습니다!') + '\n' +
      `🖼️ ${imageUrl}\n\n` +
      '`!시트등록` 명령어로 포럼에 업데이트하세요.'
    );
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