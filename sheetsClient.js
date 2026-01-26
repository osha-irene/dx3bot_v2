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
      const keyFilePath = path.join(__dirname, 'google-credentials.json');
      
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
   * 배치로 여러 범위 읽기 (최적화)
   */
  async batchReadRanges(spreadsheetId, ranges, sheetName = null) {
    if (!this.initialized) return {};

    try {
      const fullRanges = ranges.map(range => 
        sheetName ? `${sheetName}!${range}` : range
      );

      const response = await this.sheets.spreadsheets.values.batchGet({
        spreadsheetId: spreadsheetId,
        ranges: fullRanges,
      });

      const result = {};
      response.data.valueRanges.forEach((valueRange, index) => {
        result[ranges[index]] = valueRange.values || [];
      });

      return result;
    } catch (error) {
      console.error('배치 읽기 실패:', error.message);
      return {};
    }
  }

  /**
   * 캐릭터 전체 데이터 읽기 (최적화 버전)
   */
  async readFullCharacter(spreadsheetId, sheetName) {
    if (!this.initialized) return null;

    const startTime = Date.now();
    console.log(`\n⏱️ [성능] 시트 데이터 읽기 시작: ${spreadsheetId} - ${sheetName}`);

    try {
      const { SHEET_MAPPING, calculateErosionD } = require('./sheetsMapping');
      
      // 🚀 최적화: 모든 범위를 한 번에 읽기
      console.log('📊 [성능] 배치 API 호출 시작...');
      const batchStart = Date.now();
      
      const ranges = [
        // 기본 정보 (한 줄로)
        'L7:W13',  // 코드네임, 캐릭터명, 커버, 웍스, 각성, 충동
        'B21:W21', // 브리드, 신드롬들
        'O16:S16', // HP, 침식률
        // 능력치
        'F33:AD33', // 육체, 감각, 정신, 사회
        // 세부 기능
        'H36:H37', // 백병, 회피
        'P36:P37', // 사격, 지각
        'X36:X37', // RC, 의지
        'AF36:AF37', // 교섭, 조달
        // 동적 기능 (운전, 예술, 지식, 정보)
        'B38:H42',  // 운전
        'J38:P42',  // 예술
        'R38:X42',  // 지식
        'Z38:AF42', // 정보
        // 로이스
        'B67:AD73',
        // D로이스
        'E67:M67',
        // 콤보 (전체 범위)
        'B196:AD237',
        // 무기
        'B91:Y95',
        // 방어구
        'B100:U104',
      ];

      const batchData = await this.batchReadRanges(spreadsheetId, ranges, sheetName);
      console.log(`✅ [성능] 배치 API 호출 완료: ${Date.now() - batchStart}ms`);

      console.log('🔄 [성능] 데이터 파싱 시작...');
      const parseStart = Date.now();

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

      // 기본 정보 파싱
      const basicInfo = batchData['L7:W13'] || [];
      if (basicInfo.length > 0) {
        characterData.codeName = basicInfo[1] ? basicInfo[1][0] : null; // L8
        characterData.characterName = basicInfo[1] ? basicInfo[1][12] : null; // W8
        characterData.cover = basicInfo[3] ? basicInfo[3][15] : null; // Z10
        characterData.works = basicInfo[4] ? basicInfo[4][15] : null; // Z11
        characterData.awakening = basicInfo[5] ? basicInfo[5][15] : null; // Z12
        characterData.impulse = basicInfo[6] ? basicInfo[6][15] : null; // Z13
      }

      // 브리드, 신드롬
      const breedInfo = batchData['B21:W21'] || [];
      if (breedInfo.length > 0 && breedInfo[0]) {
        characterData.breed = breedInfo[0][0] || null; // B21
        const syndrome1 = breedInfo[0][3] || null; // E21
        const syndrome2 = breedInfo[0][12] || null; // N21
        const syndromeOptional = breedInfo[0][21] || null; // W21
        
        let syndromes = [];
        if (syndrome1) syndromes.push(syndrome1);
        if (syndrome2) syndromes.push(syndrome2);
        if (syndromeOptional) syndromes.push(syndromeOptional);
        characterData.syndromes = syndromes.join(' × ');
      }

      // HP, 침식률
      const statusInfo = batchData['O16:S16'] || [];
      if (statusInfo.length > 0 && statusInfo[0]) {
        characterData.HP = statusInfo[0][0] ? parseInt(statusInfo[0][0]) : 0; // O16
        characterData.침식률 = statusInfo[0][4] ? parseInt(statusInfo[0][4]) : 0; // S16
        characterData.침식D = calculateErosionD(characterData.침식률);
      }

      // 능력치
      const stats = batchData['F33:AD33'] || [];
      if (stats.length > 0 && stats[0]) {
        characterData.육체 = parseInt(stats[0][0]) || 0; // F33
        characterData.감각 = parseInt(stats[0][8]) || 0; // N33
        characterData.정신 = parseInt(stats[0][16]) || 0; // V33
        characterData.사회 = parseInt(stats[0][24]) || 0; // AD33
      }

      // 세부 기능
      const melee = batchData['H36:H37'] || [];
      if (melee.length >= 2) {
        characterData.백병 = parseInt(melee[0][0]) || 0;
        characterData.회피 = parseInt(melee[1][0]) || 0;
      }

      const shoot = batchData['P36:P37'] || [];
      if (shoot.length >= 2) {
        characterData.사격 = parseInt(shoot[0][0]) || 0;
        characterData.지각 = parseInt(shoot[1][0]) || 0;
      }

      const rc = batchData['X36:X37'] || [];
      if (rc.length >= 2) {
        characterData.RC = parseInt(rc[0][0]) || 0;
        characterData.의지 = parseInt(rc[1][0]) || 0;
      }

      const negotiate = batchData['AF36:AF37'] || [];
      if (negotiate.length >= 2) {
        characterData.교섭 = parseInt(negotiate[0][0]) || 0;
        characterData.조달 = parseInt(negotiate[1][0]) || 0;
      }

      // 동적 기능 (운전, 예술, 지식, 정보)
      const skillTypes = [
        { data: batchData['B38:H42'], nameOffset: 0, valueOffset: 6 },  // 운전
        { data: batchData['J38:P42'], nameOffset: 0, valueOffset: 6 },  // 예술
        { data: batchData['R38:X42'], nameOffset: 0, valueOffset: 6 },  // 지식
        { data: batchData['Z38:AF42'], nameOffset: 0, valueOffset: 6 }, // 정보
      ];

      for (const skillType of skillTypes) {
        if (skillType.data && skillType.data.length > 0) {
          for (const row of skillType.data) {
            const skillName = row[skillType.nameOffset];
            const skillValue = row[skillType.valueOffset];
            if (skillName && skillValue && !isNaN(parseInt(skillValue))) {
              characterData[skillName] = parseInt(skillValue);
            }
          }
        }
      }

      // 로이스
      const loisData = batchData['B67:AD73'] || [];
      for (const row of loisData) {
        if (!row || row.length < 5) continue;
        
        const loisType = row[0]; // B열
        const loisName = row[3]; // E열
        
        if (loisName && loisName.trim() && loisType !== 'D') {
          const pEmotion = row[10] || ''; // L열
          const nEmotion = row[15] || ''; // Q열
          const pCheck = row[9]; // K열
          const nCheck = row[13]; // O열
          const description = row[18] || ''; // T열
          const titusCheck = row[28]; // AD열

          const formattedP = pCheck ? `**【P: ${pEmotion}】**` : `P: ${pEmotion || '-'}`;
          const formattedN = nCheck ? `**【N: ${nEmotion}】**` : `N: ${nEmotion || '-'}`;

          const loisObj = {
            name: loisName.trim(),
            pEmotion: formattedP,
            nEmotion: formattedN,
            description: description.trim(),
          };

          if (titusCheck === 'T' || titusCheck === 'TRUE') {
            loisObj.name = `~~${loisObj.name}~~`;
            loisObj.pEmotion = `~~${loisObj.pEmotion}~~`;
            loisObj.nEmotion = `~~${loisObj.nEmotion}~~`;
            loisObj.description = `~~${loisObj.description}~~`;
            loisObj.isTitus = true;
          }

          characterData.lois.push(loisObj);
        }
      }
      characterData.로이스 = characterData.lois.length;

      // D로이스
      const dloisData = batchData['E67:M67'] || [];
      if (dloisData.length > 0 && dloisData[0] && dloisData[0][0]) {
        const dloisNoAndName = dloisData[0][0];
        const match = dloisNoAndName.match(/No\.\s*(\d+)\s+(.+)/i);
        if (match) {
          characterData.dloisNo = match[1];
          characterData.dloisName = match[2].trim();
        }
      }

      // 콤보 (6행 간격)
      const comboData = batchData['B196:AD237'] || [];
      for (let i = 0; i < comboData.length; i += 6) {
        if (!comboData[i] || !comboData[i][0]) continue;
        
        const comboName = comboData[i][0]; // B열 (N행)
        if (comboName && comboName.trim()) {
          const row1 = comboData[i + 1] || [];
          const row2 = comboData[i + 2] || [];
          const row3 = comboData[i + 3] || [];
          const row4 = comboData[i + 4] || [];
          const row5 = comboData[i + 5] || [];

          characterData.combos.push({
            name: comboName.trim(),
            timing: row1[15] || '', // Q열
            skill: row1[17] || '백병', // S열
            difficulty: row1[19] || '', // U열
            target: row1[21] || '', // W열
            range: row1[23] || '', // Y열
            restriction: row1[25] || '', // AB열
            erosion: row1[27] || '', // AD열
            // 99↓
            effectList99: row2[2] || '', // D열
            content99: row3[2] || '', // D열
            dice99: row3[23] ? parseInt(row3[23]) : 0, // Y열
            critical99: row3[25] ? parseInt(row3[25]) : 10, // AB열
            attack99: row3[27] || '', // AD열
            // 100↑
            effectList100: row4[2] || '', // D열
            content100: row5[2] || '', // D열
            dice100: row5[23] ? parseInt(row5[23]) : 0, // Y열
            critical100: row5[25] ? parseInt(row5[25]) : 10, // AB열
            attack100: row5[27] || '', // AD열
          });
        }
      }

      // 무기
      const weaponData = batchData['B91:Y95'] || [];
      for (const row of weaponData) {
        if (!row || !row[0]) continue;
        const weaponName = row[0];
        if (weaponName && weaponName.trim()) {
          characterData.weapons.push({
            name: weaponName.trim(),
            type: row[6] || '',
            ability: row[8] || '',
            range: row[10] || '',
            accuracy: row[12] || '',
            attack: row[15] || '',
            guard: row[17] || '',
            description: row[23] || '',
          });
        }
      }

      // 방어구
      const armorData = batchData['B100:U104'] || [];
      for (const row of armorData) {
        if (!row || !row[0]) continue;
        const armorName = row[0];
        if (armorName && armorName.trim()) {
          characterData.armor.push({
            name: armorName.trim(),
            type: row[6] || '',
            dodge: row[8] || '',
            action: row[10] || '',
            defense: row[12] || '',
            description: row[19] || '',
          });
        }
      }

      console.log(`✅ [성능] 데이터 파싱 완료: ${Date.now() - parseStart}ms`);

      const totalTime = Date.now() - startTime;
      console.log(`\n🎉 [성능] 전체 완료: ${totalTime}ms`);
      console.log(`✅ 캐릭터 데이터 읽기 완료: ${characterData.characterName}`);
      console.log(`   - HP: ${characterData.HP}, 침식률: ${characterData.침식률}, 침식D: ${characterData.침식D}`);
      console.log(`   - 로이스: ${characterData.lois.length}개`);
      console.log(`   - 콤보: ${characterData.combos.length}개`);
      console.log(`   - 무기: ${characterData.weapons.length}개`);
      console.log(`   - 방어구: ${characterData.armor.length}개\n`);

      return characterData;

    } catch (error) {
      console.error('❌ 캐릭터 데이터 읽기 실패:', error);
      console.error(error.stack);
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