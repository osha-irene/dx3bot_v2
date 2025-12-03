/**
 * 데이터베이스 모듈 (JSON 파일 기반)
 * Google Sheets를 사용하지 않는 경우의 백업용
 */

const fs = require('fs');
const path = require('path');

class Database {
  constructor() {
    this.dataDir = path.join(__dirname);
    this.files = {
      data: path.join(this.dataDir, 'data.json'),
      activeCharacter: path.join(this.dataDir, 'activeCharacter.json'),
      comboData: path.join(this.dataDir, 'comboData.json'),
      version: path.join(this.dataDir, 'version.json'),
      userSheets: path.join(this.dataDir, 'userSheets.json')
    };

    this.cache = {
      data: {},
      activeCharacter: {},
      comboData: {},
      version: { major: 1, minor: 0, patch: 0 },
      userSheets: {}
    };

    this.initialize();
  }

  /**
   * 데이터베이스 초기화
   */
  initialize() {
    console.log('📁 데이터베이스 초기화 중...');
    
    // 각 파일 로드
    for (const [key, filePath] of Object.entries(this.files)) {
      this.cache[key] = this.load(filePath, this.cache[key]);
    }

    console.log('✅ 데이터베이스 초기화 완료');
  }

  /**
   * JSON 파일 로드
   * @param {string} filePath - 파일 경로
   * @param {any} defaultValue - 기본값
   * @returns {any} - 로드된 데이터
   */
  load(filePath, defaultValue = {}) {
    try {
      if (!fs.existsSync(filePath)) {
        this.save(filePath, defaultValue);
        return defaultValue;
      }

      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return data;
    } catch (error) {
      console.error(`❌ 파일 로드 오류 (${filePath}):`, error.message);
      return defaultValue;
    }
  }

  /**
   * JSON 파일 저장
   * @param {string} filePath - 파일 경로
   * @param {any} data - 저장할 데이터
   */
  save(filePath, data) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error(`❌ 파일 저장 오류 (${filePath}):`, error.message);
      return false;
    }
  }

  /**
   * 캐릭터 데이터 가져오기
   * @param {string} serverId - 서버 ID
   * @param {string} userId - 유저 ID
   * @param {string} characterName - 캐릭터 이름
   * @returns {Object|null} - 캐릭터 데이터
   */
  getCharacter(serverId, userId, characterName) {
    return this.cache.data[serverId]?.[userId]?.[characterName] || null;
  }

  /**
   * 캐릭터 데이터 설정
   * @param {string} serverId - 서버 ID
   * @param {string} userId - 유저 ID
   * @param {string} characterName - 캐릭터 이름
   * @param {Object} data - 캐릭터 데이터
   */
  setCharacter(serverId, userId, characterName, data) {
    if (!this.cache.data[serverId]) this.cache.data[serverId] = {};
    if (!this.cache.data[serverId][userId]) this.cache.data[serverId][userId] = {};
    
    // 기존 sheetThread 보존
    const existingSheetThread = this.cache.data[serverId][userId]?.[characterName]?.sheetThread;
    
    this.cache.data[serverId][userId][characterName] = data;
    
    // sheetThread 복원
    if (existingSheetThread) {
      this.cache.data[serverId][userId][characterName].sheetThread = existingSheetThread;
    }
    
    this.save(this.files.data, this.cache.data);
  }

  /**
   * 캐릭터 삭제
   * @param {string} serverId - 서버 ID
   * @param {string} userId - 유저 ID
   * @param {string} characterName - 캐릭터 이름
   */
  deleteCharacter(serverId, userId, characterName) {
    if (this.cache.data[serverId]?.[userId]?.[characterName]) {
      delete this.cache.data[serverId][userId][characterName];
      this.save(this.files.data, this.cache.data);
      return true;
    }
    return false;
  }

  /**
   * 활성 캐릭터 가져오기
   * @param {string} serverId - 서버 ID
   * @param {string} userId - 유저 ID
   * @returns {string|null} - 활성 캐릭터 이름
   */
  getActiveCharacter(serverId, userId) {
    return this.cache.activeCharacter[serverId]?.[userId] || null;
  }

  /**
   * 활성 캐릭터 설정
   * @param {string} serverId - 서버 ID
   * @param {string} userId - 유저 ID
   * @param {string} characterName - 캐릭터 이름
   */
  setActiveCharacter(serverId, userId, characterName) {
    if (!this.cache.activeCharacter[serverId]) {
      this.cache.activeCharacter[serverId] = {};
    }
    
    this.cache.activeCharacter[serverId][userId] = characterName;
    this.save(this.files.activeCharacter, this.cache.activeCharacter);
  }

  /**
   * 활성 캐릭터 해제
   * @param {string} serverId - 서버 ID
   * @param {string} userId - 유저 ID
   */
  clearActiveCharacter(serverId, userId) {
    if (this.cache.activeCharacter[serverId]?.[userId]) {
      delete this.cache.activeCharacter[serverId][userId];
      this.save(this.files.activeCharacter, this.cache.activeCharacter);
      return true;
    }
    return false;
  }

  /**
   * 콤보 데이터 가져오기
   * @param {string} serverId - 서버 ID
   * @param {string} userId - 유저 ID
   * @param {string} characterName - 캐릭터 이름
   * @returns {Object} - 콤보 데이터
   */
  getCombos(serverId, userId, characterName) {
    return this.cache.comboData[serverId]?.[userId]?.[characterName] || {};
  }

  /**
   * 콤보 설정
   * @param {string} serverId - 서버 ID
   * @param {string} userId - 유저 ID
   * @param {string} characterName - 캐릭터 이름
   * @param {string} comboName - 콤보 이름
   * @param {string} condition - 침식률 조건
   * @param {string} description - 콤보 설명
   */
  setCombo(serverId, userId, characterName, comboName, condition, description) {
    if (!this.cache.comboData[serverId]) this.cache.comboData[serverId] = {};
    if (!this.cache.comboData[serverId][userId]) this.cache.comboData[serverId][userId] = {};
    if (!this.cache.comboData[serverId][userId][characterName]) {
      this.cache.comboData[serverId][userId][characterName] = {};
    }
    if (!this.cache.comboData[serverId][userId][characterName][comboName]) {
      this.cache.comboData[serverId][userId][characterName][comboName] = {};
    }

    this.cache.comboData[serverId][userId][characterName][comboName][condition] = description;
    this.save(this.files.comboData, this.cache.comboData);
  }

  /**
   * 콤보 삭제
   * @param {string} serverId - 서버 ID
   * @param {string} userId - 유저 ID
   * @param {string} characterName - 캐릭터 이름
   * @param {string} comboName - 콤보 이름
   */
  deleteCombo(serverId, userId, characterName, comboName) {
    if (this.cache.comboData[serverId]?.[userId]?.[characterName]?.[comboName]) {
      delete this.cache.comboData[serverId][userId][characterName][comboName];
      this.save(this.files.comboData, this.cache.comboData);
      return true;
    }
    return false;
  }

  /**
   * 유저 시트 URL 가져오기
   * @param {string} serverId - 서버 ID
   * @param {string} userId - 유저 ID
   * @returns {Object|null} - { spreadsheetId, sheetName } 또는 null
   */
  getUserSheet(serverId, userId) {
    const sheetInfo = this.cache.userSheets[serverId]?.[userId];
    if (!sheetInfo) return null;

    // 새 형식: spreadsheetId::sheetName
    if (sheetInfo.includes('::')) {
      const [spreadsheetId, sheetName] = sheetInfo.split('::');
      return { spreadsheetId, sheetName };
    }

    // 구 형식: spreadsheetId만 (하위 호환)
    return { spreadsheetId: sheetInfo, sheetName: null };
  }

  /**
   * 유저 시트 URL 설정
   * @param {string} serverId - 서버 ID
   * @param {string} userId - 유저 ID
   * @param {string} sheetUrl - 시트 URL
   */
  setUserSheet(serverId, userId, sheetUrl) {
    if (!this.cache.userSheets[serverId]) {
      this.cache.userSheets[serverId] = {};
    }

    this.cache.userSheets[serverId][userId] = sheetUrl;
    this.save(this.files.userSheets, this.cache.userSheets);
  }

  /**
   * 버전 정보 가져오기
   * @returns {Object} - 버전 정보
   */
  getVersion() {
    return this.cache.version;
  }

  /**
   * 버전 업데이트
   * @param {string} type - 'major', 'minor', 'patch'
   */
  updateVersion(type = 'patch') {
    if (type === 'major') {
      this.cache.version.major += 1;
      this.cache.version.minor = 0;
      this.cache.version.patch = 0;
    } else if (type === 'minor') {
      this.cache.version.minor += 1;
      this.cache.version.patch = 0;
    } else {
      this.cache.version.patch += 1;
    }

    this.save(this.files.version, this.cache.version);
    return this.cache.version;
  }

  /**
   * 전체 데이터 가져오기 (백업용)
   * @returns {Object} - 모든 데이터
   */
  getAllData() {
    return {
      data: this.cache.data,
      activeCharacter: this.cache.activeCharacter,
      comboData: this.cache.comboData,
      userSheets: this.cache.userSheets,
      version: this.cache.version
    };
  }

  /**
   * 특정 유저의 모든 캐릭터 가져오기
   * @param {string} serverId - 서버 ID
   * @param {string} userId - 유저 ID
   * @returns {Object} - 캐릭터 목록 객체
   */
  getAllCharacters(serverId, userId) {
    if (!this.cache.data[serverId]) return {};
    if (!this.cache.data[serverId][userId]) return {};
    return this.cache.data[serverId][userId];
  }

  /**
   * 서버의 모든 유저 데이터 가져오기
   * @param {string} serverId - 서버 ID
   * @returns {Object} - 유저별 캐릭터 데이터
   */
  getAllUsers(serverId) {
    if (!this.cache.data[serverId]) return {};
    return this.cache.data[serverId];
  }

  /**
   * 상태 패널 정보 저장
   * @param {string} serverId - 서버 ID
   * @param {string} messageId - 패널 메시지 ID
   * @param {string} channelId - 채널 ID
   */
  setStatusPanelId(serverId, messageId, channelId) {
    if (!this.cache.data[serverId]) this.cache.data[serverId] = {};
    if (!this.cache.data[serverId].__statusPanel) {
      this.cache.data[serverId].__statusPanel = {};
    }
    this.cache.data[serverId].__statusPanel = { messageId, channelId };
    this.save(this.files.data, this.cache.data);
  }

  /**
   * 상태 패널 메시지 ID 가져오기
   * @param {string} serverId - 서버 ID
   * @returns {string|null} - 패널 메시지 ID
   */
  getStatusPanelId(serverId) {
    if (!this.cache.data[serverId]) return null;
    if (!this.cache.data[serverId].__statusPanel) return null;
    return this.cache.data[serverId].__statusPanel.messageId;
  }

  /**
   * 상태 패널 정보 가져오기
   * @param {string} serverId - 서버 ID
   * @returns {Object|null} - { messageId, channelId }
   */
  getStatusPanelInfo(serverId) {
    if (!this.cache.data[serverId]) return null;
    if (!this.cache.data[serverId].__statusPanel) return null;
    return this.cache.data[serverId].__statusPanel;
  }

  /**
   * 캐릭터 시트 스레드 정보 저장
   * @param {string} serverId - 서버 ID
   * @param {string} userId - 유저 ID
   * @param {string} characterName - 캐릭터 이름
   * @param {string} threadId - 스레드 ID
   * @param {string} messageId - 메시지 ID
   */
  setCharacterSheetThread(serverId, userId, characterName, threadId, messageId) {
    console.log(`🔍 [DB] setCharacterSheetThread 호출됨`);
    console.log(`   - serverId: ${serverId}`);
    console.log(`   - userId: ${userId}`);
    console.log(`   - characterName: ${characterName}`);
    console.log(`   - threadId: ${threadId}`);
    console.log(`   - messageId: ${messageId}`);
    
    if (!this.cache.data[serverId]) this.cache.data[serverId] = {};
    if (!this.cache.data[serverId][userId]) this.cache.data[serverId][userId] = {};
    if (!this.cache.data[serverId][userId][characterName]) {
      this.cache.data[serverId][userId][characterName] = {};
    }
    
    console.log(`🔍 [DB] 저장 전 캐릭터 데이터:`, Object.keys(this.cache.data[serverId][userId][characterName]));
    
    this.cache.data[serverId][userId][characterName].sheetThread = {
      threadId,
      messageId
    };
    
    console.log(`🔍 [DB] 저장 후 sheetThread:`, this.cache.data[serverId][userId][characterName].sheetThread);
    console.log(`🔍 [DB] 저장 후 캐릭터 데이터:`, Object.keys(this.cache.data[serverId][userId][characterName]));
    
    this.save(this.files.data, this.cache.data);
    console.log(`✅ [DB] save() 호출 완료`);
  }

  /**
   * 캐릭터 시트 스레드 정보 가져오기
   * @param {string} serverId - 서버 ID
   * @param {string} userId - 유저 ID
   * @param {string} characterName - 캐릭터 이름
   * @returns {Object|null} - { threadId, messageId }
   */
  getCharacterSheetThread(serverId, userId, characterName) {
    console.log(`🔍 [DB] getCharacterSheetThread 호출됨`);
    console.log(`   - serverId: ${serverId}`);
    console.log(`   - userId: ${userId}`);
    console.log(`   - characterName: ${characterName}`);
    
    const result = this.cache.data[serverId]?.[userId]?.[characterName]?.sheetThread || null;
    console.log(`🔍 [DB] 조회 결과:`, result);
    
    if (!result && this.cache.data[serverId]?.[userId]?.[characterName]) {
      console.log(`🔍 [DB] 캐릭터 데이터 내용:`, Object.keys(this.cache.data[serverId][userId][characterName]));
    }
    
    return result;
  }

  /**
   * 포럼 채널 ID 저장
   * @param {string} serverId - 서버 ID
   * @param {string} forumChannelId - 포럼 채널 ID
   */
  setSheetForumChannel(serverId, forumChannelId) {
    if (!this.cache.data[serverId]) this.cache.data[serverId] = {};
    if (!this.cache.data[serverId].__sheetForum) {
      this.cache.data[serverId].__sheetForum = {};
    }
    this.cache.data[serverId].__sheetForum.channelId = forumChannelId;
    this.save(this.files.data, this.cache.data);
  }

  /**
   * 포럼 채널 ID 가져오기
   * @param {string} serverId - 서버 ID
   * @returns {string|null} - 포럼 채널 ID
   */
  getSheetForumChannel(serverId) {
    return this.cache.data[serverId]?.__sheetForum?.channelId || null;
  }
}

module.exports = Database;