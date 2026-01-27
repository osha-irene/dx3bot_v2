const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class SheetsClient {
  constructor() {
    this.sheets = null;
    this.auth = null;
    this.serviceAccountEmail = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      // 서비스 계정 키 파일 경로
      const keyFilePath = path.join(__dirname, '..', 'config', 'google-credentials.json');
      
      if (!fs.existsSync(keyFilePath)) {
        console.log('⚠️ google-credentials.json 파일이 없습니다. Google Sheets 연동이 비활성화됩니다.');
        return false;
      }

      // 서비스 계정 인증
      const serviceAccountKey = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
      this.serviceAccountEmail = serviceAccountKey.client_email;
      
      this.auth = new google.auth.GoogleAuth({
        credentials: serviceAccountKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      this.initialized = true;

      console.log('✅ Google Sheets 클라이언트 초기화 완료');
      console.log(`📧 서비스 계정: ${this.serviceAccountEmail}`);
      return true;

    } catch (error) {
      console.error('❌ Google Sheets 초기화 실패:', error.message);
      return false;
    }
  }

  /**
   * URL에서 Spreadsheet ID 추출
   */
  extractSpreadsheetId(url) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : url;
  }

  /**
   * 서비스 계정 이메일 가져오기
   */
  async getServiceAccountEmail() {
    return this.serviceAccountEmail;
  }

  /**
   * 시트 접근 권한 테스트
   */
  async testAccess(spreadsheetId) {
    if (!this.initialized) return false;

    try {
      await this.sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId,
      });
      return true;
    } catch (error) {
      console.error('시트 접근 실패:', error.message);
      return false;
    }
  }

  /**
   * 시트의 탭 목록 가져오기
   */
  async getSheetList(spreadsheetId) {
    if (!this.initialized) return [];

    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId,
      });

      return response.data.sheets.map(sheet => ({
        title: sheet.properties.title,
        sheetId: sheet.properties.sheetId,
      }));
    } catch (error) {
      console.error('시트 탭 목록 가져오기 실패:', error.message);
      return [];
    }
  }

  /**
   * 탭 목록 가져오기 (별칭)
   */
  async listTabs(spreadsheetId) {
    return await this.getSheetList(spreadsheetId);
  }

  /**
   * 특정 셀 읽기
   */
  async readCell(spreadsheetId, cellAddress, sheetName = null) {
    if (!this.initialized) return null;

    try {
      const range = sheetName ? `${sheetName}!${cellAddress}` : cellAddress;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: range,
      });

      const values = response.data.values;
      return values && values[0] && values[0][0] ? values[0][0] : null;
    } catch (error) {
      // 셀이 비어있으면 조용히 null 반환
      return null;
    }
  }

  /**
   * 특정 셀 쓰기
   */
  async writeCell(spreadsheetId, cellAddress, value, sheetName = null) {
    if (!this.initialized) return false;

    try {
      const range = sheetName ? `${sheetName}!${cellAddress}` : cellAddress;
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[value]],
        },
      });
      return true;
    } catch (error) {
      console.error(`셀 쓰기 실패 (${cellAddress}):`, error.message);
      return false;
    }
  }

  /**
   * 범위 읽기
   */
  async readRange(spreadsheetId, range, sheetName = null) {
    if (!this.initialized) return null;

    try {
      const fullRange = sheetName ? `${sheetName}!${range}` : range;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: fullRange,
      });

      return response.data.values || [];
    } catch (error) {
      console.error(`범위 읽기 실패 (${range}):`, error.message);
      return null;
    }
  }

  /**
   * 캐릭터 전체 데이터 읽기 (기존 버전 - 느림)
   */
  async readFullCharacter(spreadsheetId, sheetName) {
    // 최적화된 버전으로 리다이렉트
    return await this.readFullCharacterFast(spreadsheetId, sheetName);
  }

  /**
   * 🚀 최적화된 캐릭터 전체 데이터 읽기 (빠른 버전)
   */
  async readFullCharacterFast(spreadsheetId, sheetName) {
    try {
      const { readFullCharacterOptimized } = require('./optimized/fastCharacterReader');
      return await readFullCharacterOptimized(this, spreadsheetId, sheetName);
    } catch (error) {
      console.error('⚡ 최적화 읽기 실패, 폴백 시도:', error.message);
      // 최적화 버전 실패시 기존 방식 사용
      return await this.readFullCharacterSlow(spreadsheetId, sheetName);
    }
  }

  /**
   * 캐릭터 전체 데이터 읽기 (기존 느린 버전 - 폴백용)
   */
  async readFullCharacterSlow(spreadsheetId, sheetName) {
    if (!this.initialized) return null;

    try {
      console.log(`📊 [SLOW] 시트에서 캐릭터 데이터 읽기: ${spreadsheetId} - ${sheetName}`);
      
      const { SHEET_MAPPING, calculateErosionD } = require('./sheetsMapping');
      
      const characterData = {
        characterName: null,
        codeName: null,
        HP: 0,
        침식률: 0,
        침식D: 0,
        로이스: 0,
        lois: [],
        combos: [],
        weapons: [],
        armor: [],
        vehicles: [],
        items: [],
        effects: [],
      };

      // 기본 정보 읽기
      characterData.characterName = await this.readCell(spreadsheetId, SHEET_MAPPING.characterName, sheetName);
      characterData.codeName = await this.readCell(spreadsheetId, SHEET_MAPPING.codeName, sheetName);
      characterData.cover = await this.readCell(spreadsheetId, SHEET_MAPPING.cover, sheetName);
      characterData.works = await this.readCell(spreadsheetId, SHEET_MAPPING.works, sheetName);
      characterData.awakening = await this.readCell(spreadsheetId, SHEET_MAPPING.awakening, sheetName);
      characterData.impulse = await this.readCell(spreadsheetId, SHEET_MAPPING.impulse, sheetName);
      characterData.breed = await this.readCell(spreadsheetId, SHEET_MAPPING.breed, sheetName);

      // 신드롬 조합
      const syndrome1 = await this.readCell(spreadsheetId, SHEET_MAPPING.syndrome1, sheetName);
      const syndrome2 = await this.readCell(spreadsheetId, SHEET_MAPPING.syndrome2, sheetName);
      const syndromeOptional = await this.readCell(spreadsheetId, SHEET_MAPPING.syndromeOptional, sheetName);
      
      let syndromes = [];
      if (syndrome1) syndromes.push(syndrome1);
      if (syndrome2) syndromes.push(syndrome2);
      if (syndromeOptional) syndromes.push(syndromeOptional);
      characterData.syndromes = syndromes.join(' × ');

      // HP, 침식률
      const hp = await this.readCell(spreadsheetId, SHEET_MAPPING.HP, sheetName);
      const erosion = await this.readCell(spreadsheetId, SHEET_MAPPING.erosion, sheetName);
      characterData.HP = hp ? parseInt(hp) : 0;
      characterData.침식률 = erosion ? parseInt(erosion) : 0;
      characterData.침식D = calculateErosionD(characterData.침식률);

      // 능력치 읽기
      characterData.육체 = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.body, sheetName)) || 0;
      characterData.감각 = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.sense, sheetName)) || 0;
      characterData.정신 = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.mind, sheetName)) || 0;
      characterData.사회 = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.social, sheetName)) || 0;

      // 세부 기능
      characterData.백병 = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.melee, sheetName)) || 0;
      characterData.회피 = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.dodge, sheetName)) || 0;
      characterData.사격 = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.shoot, sheetName)) || 0;
      characterData.지각 = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.perceive, sheetName)) || 0;
      characterData.RC = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.RC, sheetName)) || 0;
      characterData.의지 = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.will, sheetName)) || 0;
      characterData.교섭 = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.negotiate, sheetName)) || 0;
      characterData.조달 = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.procure, sheetName)) || 0;

      console.log(`✅ [SLOW] 캐릭터 데이터 읽기 완료: ${characterData.characterName}`);

      return characterData;

    } catch (error) {
      console.error('[SLOW] 캐릭터 데이터 읽기 실패:', error);
      throw error;
    }
  }

  /**
   * 특정 스탯 업데이트
   */
  async updateStat(spreadsheetId, statName, value, sheetName = null) {
    if (!this.initialized) return false;

    try {
      const { STAT_TO_CELL } = require('./sheetsMapping');
      
      const cellAddress = STAT_TO_CELL[statName];

      if (!cellAddress) {
        console.warn(`알 수 없는 스탯: ${statName}`);
        return false;
      }

      return await this.writeCell(spreadsheetId, cellAddress, value, sheetName);

    } catch (error) {
      console.error(`스탯 업데이트 실패 (${statName}):`, error.message);
      return false;
    }
  }

  /**
   * 초기화 상태 확인
   */
  isInitialized() {
    return this.initialized;
  }
}

module.exports = new SheetsClient();
