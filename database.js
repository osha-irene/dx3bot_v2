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
      userSheets: path.join(this.dataDir, 'userSheets.json'),
      characterSheets: path.join(this.dataDir, 'characterSheets.json') // 🆕 캐릭터별 시트
    };

    this.cache = {
      data: {},
      activeCharacter: {},
      comboData: {},
      version: { major: 1, minor: 0, patch: 0 },
      userSheets: {},
      characterSheets: {} // 🆕
    };

    this.initialize();
  }

  initialize() {
    console.log('📁 데이터베이스 초기화 중...');
    for (const [key, filePath] of Object.entries(this.files)) {
      this.cache[key] = this.load(filePath, this.cache[key]);
    }
    console.log('✅ 데이터베이스 초기화 완료');
  }

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

  save(filePath, data) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error(`❌ 파일 저장 오류 (${filePath}):`, error.message);
      return false;
    }
  }

  getCharacter(serverId, userId, characterName) {
    return this.cache.data[serverId]?.[userId]?.[characterName] || null;
  }

  setCharacter(serverId, userId, characterName, data) {
    if (!this.cache.data[serverId]) this.cache.data[serverId] = {};
    if (!this.cache.data[serverId][userId]) this.cache.data[serverId][userId] = {};
    const existingSheetThread = this.cache.data[serverId][userId]?.[characterName]?.sheetThread;
    this.cache.data[serverId][userId][characterName] = data;
    if (existingSheetThread) {
      this.cache.data[serverId][userId][characterName].sheetThread = existingSheetThread;
    }
    this.save(this.files.data, this.cache.data);
  }

  deleteCharacter(serverId, userId, characterName) {
    if (this.cache.data[serverId]?.[userId]?.[characterName]) {
      delete this.cache.data[serverId][userId][characterName];
      this.save(this.files.data, this.cache.data);
      if (this.cache.characterSheets[serverId]?.[userId]?.[characterName]) {
        delete this.cache.characterSheets[serverId][userId][characterName];
        this.save(this.files.characterSheets, this.cache.characterSheets);
      }
      return true;
    }
    return false;
  }

  getActiveCharacter(serverId, userId) {
    return this.cache.activeCharacter[serverId]?.[userId] || null;
  }

  setActiveCharacter(serverId, userId, characterName) {
    if (!this.cache.activeCharacter[serverId]) {
      this.cache.activeCharacter[serverId] = {};
    }
    this.cache.activeCharacter[serverId][userId] = characterName;
    this.save(this.files.activeCharacter, this.cache.activeCharacter);
  }

  clearActiveCharacter(serverId, userId) {
    if (this.cache.activeCharacter[serverId]?.[userId]) {
      delete this.cache.activeCharacter[serverId][userId];
      this.save(this.files.activeCharacter, this.cache.activeCharacter);
      return true;
    }
    return false;
  }

  getCombos(serverId, userId, characterName) {
    return this.cache.comboData[serverId]?.[userId]?.[characterName] || {};
  }

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

  deleteCombo(serverId, userId, characterName, comboName) {
    if (this.cache.comboData[serverId]?.[userId]?.[characterName]?.[comboName]) {
      delete this.cache.comboData[serverId][userId][characterName][comboName];
      this.save(this.files.comboData, this.cache.comboData);
      return true;
    }
    return false;
  }

  // 🆕 캐릭터별 시트 정보 가져오기
  getCharacterSheet(serverId, userId, characterName) {
    return this.cache.characterSheets[serverId]?.[userId]?.[characterName] || null;
  }

  // 🆕 캐릭터별 시트 정보 설정
  setCharacterSheet(serverId, userId, characterName, spreadsheetId, sheetName) {
    if (!this.cache.characterSheets[serverId]) this.cache.characterSheets[serverId] = {};
    if (!this.cache.characterSheets[serverId][userId]) this.cache.characterSheets[serverId][userId] = {};
    this.cache.characterSheets[serverId][userId][characterName] = { spreadsheetId, sheetName };
    this.save(this.files.characterSheets, this.cache.characterSheets);
  }

  // 🆕 유저의 모든 시트 연동 캐릭터 가져오기
  getAllCharacterSheets(serverId, userId) {
    return this.cache.characterSheets[serverId]?.[userId] || {};
  }

  // 유저 시트 URL 가져오기 (🆕 활성 캐릭터 우선)
  getUserSheet(serverId, userId) {
    const activeCharName = this.getActiveCharacter(serverId, userId);
    if (activeCharName) {
      const charSheet = this.getCharacterSheet(serverId, userId, activeCharName);
      if (charSheet) return charSheet;
    }
    const allSheets = this.getAllCharacterSheets(serverId, userId);
    const firstCharacter = Object.keys(allSheets)[0];
    if (firstCharacter) return allSheets[firstCharacter];
    const sheetInfo = this.cache.userSheets[serverId]?.[userId];
    if (!sheetInfo) return null;
    if (sheetInfo.includes('::')) {
      const [spreadsheetId, sheetName] = sheetInfo.split('::');
      return { spreadsheetId, sheetName };
    }
    return { spreadsheetId: sheetInfo, sheetName: null };
  }

  setUserSheet(serverId, userId, sheetUrl) {
    if (!this.cache.userSheets[serverId]) this.cache.userSheets[serverId] = {};
    this.cache.userSheets[serverId][userId] = sheetUrl;
    this.save(this.files.userSheets, this.cache.userSheets);
  }

  getVersion() {
    return this.cache.version;
  }

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

  getAllData() {
    return {
      data: this.cache.data,
      activeCharacter: this.cache.activeCharacter,
      comboData: this.cache.comboData,
      userSheets: this.cache.userSheets,
      characterSheets: this.cache.characterSheets,
      version: this.cache.version
    };
  }

  getAllCharacters(serverId, userId) {
    if (!this.cache.data[serverId]) return {};
    if (!this.cache.data[serverId][userId]) return {};
    return this.cache.data[serverId][userId];
  }

  getAllUsers(serverId) {
    if (!this.cache.data[serverId]) return {};
    return this.cache.data[serverId];
  }

  setStatusPanelId(serverId, messageId, channelId) {
    if (!this.cache.data[serverId]) this.cache.data[serverId] = {};
    if (!this.cache.data[serverId].__statusPanel) this.cache.data[serverId].__statusPanel = {};
    this.cache.data[serverId].__statusPanel = { messageId, channelId };
    this.save(this.files.data, this.cache.data);
  }

  getStatusPanelId(serverId) {
    return this.cache.data[serverId]?.__statusPanel?.messageId || null;
  }

  getStatusPanelInfo(serverId) {
    return this.cache.data[serverId]?.__statusPanel || null;
  }

  setCharacterSheetThread(serverId, userId, characterName, threadId, messageId) {
    console.log(`🔍 [DB] setCharacterSheetThread 호출됨`);
    console.log(`   - characterName: ${characterName}, threadId: ${threadId}`);
    if (!this.cache.data[serverId]) this.cache.data[serverId] = {};
    if (!this.cache.data[serverId][userId]) this.cache.data[serverId][userId] = {};
    if (!this.cache.data[serverId][userId][characterName]) {
      this.cache.data[serverId][userId][characterName] = {};
    }
    this.cache.data[serverId][userId][characterName].sheetThread = { threadId, messageId };
    this.save(this.files.data, this.cache.data);
    console.log(`✅ [DB] save() 호출 완료`);
  }

  getCharacterSheetThread(serverId, userId, characterName) {
    return this.cache.data[serverId]?.[userId]?.[characterName]?.sheetThread || null;
  }

  setSheetForumChannel(serverId, forumChannelId) {
    if (!this.cache.data[serverId]) this.cache.data[serverId] = {};
    if (!this.cache.data[serverId].__sheetForum) this.cache.data[serverId].__sheetForum = {};
    this.cache.data[serverId].__sheetForum.channelId = forumChannelId;
    this.save(this.files.data, this.cache.data);
  }

  getSheetForumChannel(serverId) {
    return this.cache.data[serverId]?.__sheetForum?.channelId || null;
  }
}

module.exports = Database;