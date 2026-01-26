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