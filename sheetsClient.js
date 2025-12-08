/**
 * Google Sheets API 클라이언트
 * DX3bot과 Google Sheets 연동
 */

const { google } = require('googleapis');
const { SHEET_MAPPING, STAT_TO_CELL, calculateErosionD } = require('./sheetsMapping');

class SheetsClient {
  constructor() {
    this.sheets = null;
    this.auth = null;
  }

  /**
   * Google Sheets API 초기화
   */
  async initialize() {
    try {
      // 환경 변수에서 인증 정보 가져오기
      let credentials;
      
      if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        // JSON 문자열로 제공된 경우
        credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // 파일 경로로 제공된 경우
        const fs = require('fs');
        credentials = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
      } else {
        throw new Error('Google 인증 정보가 설정되지 않았습니다. .env 파일을 확인하세요.');
      }

      // 서비스 계정 이메일 저장
      this.serviceAccountEmail = credentials.client_email;

      // JWT 인증 설정
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      console.log('✅ Google Sheets API 초기화 완료');
      console.log(`📧 서비스 계정: ${this.serviceAccountEmail}`);
      return true;
    } catch (error) {
      console.error('❌ Google Sheets API 초기화 실패:', error.message);
      return false;
    }
  }

  /**
   * 서비스 계정 이메일 가져오기
   * @returns {string} - 서비스 계정 이메일
   */
  getServiceAccountEmail() {
    return this.serviceAccountEmail || 'dx3bot-v2@my-project-irene-353016.iam.gserviceaccount.com';
  }

  /**
   * 스프레드시트 ID를 URL에서 추출
   * @param {string} url - 스프레드시트 URL
   * @returns {string} - 스프레드시트 ID
   */
  extractSpreadsheetId(url) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : url;
  }

  /**
   * 스프레드시트의 모든 시트(탭) 목록 가져오기
   * @param {string} spreadsheetId - 스프레드시트 ID
   * @returns {Array} - 시트 목록 [{ title, sheetId, index }]
   */
  async getSheetList(spreadsheetId) {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets(properties(sheetId,title,index))'
      });
      
      return response.data.sheets.map(sheet => ({
        title: sheet.properties.title,
        sheetId: sheet.properties.sheetId,
        index: sheet.properties.index
      }));
    } catch (error) {
      console.error('시트 목록 가져오기 오류:', error.message);
      return [];
    }
  }

  /**
   * 캐릭터가 있는 시트 찾기
   * @param {string} spreadsheetId - 스프레드시트 ID
   * @returns {Object|null} - { sheetName, characterName } 또는 null
   */
  async findCharacterSheet(spreadsheetId) {
    try {
      const sheetList = await this.getSheetList(spreadsheetId);
      
      // 각 시트를 순회하며 캐릭터 이름 확인
      for (const sheet of sheetList) {
        const characterName = await this.readCell(spreadsheetId, `'${sheet.title}'!W8`);
        
        if (characterName && characterName.trim()) {
          console.log(`✅ 캐릭터 발견: "${characterName}" (시트: ${sheet.title})`);
          return {
            sheetName: sheet.title,
            characterName: characterName.trim()
          };
        }
      }
      
      console.warn('⚠️ 캐릭터가 있는 시트를 찾을 수 없습니다.');
      return null;
    } catch (error) {
      console.error('캐릭터 시트 찾기 오류:', error.message);
      return null;
    }
  }

  /**
   * 특정 셀의 값 읽기 (시트 이름 지원)
   * @param {string} spreadsheetId - 스프레드시트 ID
   * @param {string} cell - 셀 주소 (예: 'A1' 또는 '시트1!A1')
   * @returns {any} - 셀 값
   */
  async readCell(spreadsheetId, cell) {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: cell
      });
      
      const value = response.data.values?.[0]?.[0];
      return value || null;
    } catch (error) {
      // 시트가 없거나 접근 불가한 경우 조용히 null 반환
      return null;
    }
  }

  /**
   * 특정 셀에 값 쓰기 (시트 이름 지원)
   * @param {string} spreadsheetId - 스프레드시트 ID
   * @param {string} cell - 셀 주소
   * @param {any} value - 쓸 값
   * @param {string} sheetName - 시트 이름 (선택)
   */
  async writeCell(spreadsheetId, cell, value, sheetName = null) {
    try {
      const range = sheetName ? `'${sheetName}'!${cell}` : cell;
      
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[value]]
        }
      });
      return true;
    } catch (error) {
      console.error(`셀 쓰기 오류 (${cell}):`, error.message);
      return false;
    }
  }

  /**
   * 스프레드시트의 모든 시트(탭) 목록 가져오기
   * @param {string} spreadsheetId - 스프레드시트 ID
   * @returns {Array} - 시트 목록 [{ title, sheetId, index }]
   */
  async getSheetList(spreadsheetId) {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets(properties(sheetId,title,index))'
      });
      
      return response.data.sheets.map(sheet => ({
        title: sheet.properties.title,
        sheetId: sheet.properties.sheetId,
        index: sheet.properties.index
      }));
    } catch (error) {
      console.error('시트 목록 가져오기 오류:', error.message);
      return [];
    }
  }

  /**
   * 특정 셀의 값 읽기 (시트 이름 지원)
   * @param {string} spreadsheetId - 스프레드시트 ID
   * @param {string} cell - 셀 주소 (예: 'A1')
   * @param {string} sheetName - 시트 이름 (선택)
   * @returns {any} - 셀 값
   */
  async readCell(spreadsheetId, cell, sheetName = null) {
    try {
      const range = sheetName ? `'${sheetName}'!${cell}` : cell;
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range
      });
      
      const value = response.data.values?.[0]?.[0];
      return value || null;
    } catch (error) {
      // 시트가 없거나 접근 불가한 경우 조용히 null 반환
      return null;
    }
  }

  /**
   * 특정 셀에 값 쓰기 (시트 이름 지원)
   * @param {string} spreadsheetId - 스프레드시트 ID
   * @param {string} cell - 셀 주소
   * @param {any} value - 쓸 값
   * @param {string} sheetName - 시트 이름 (선택)
   */
  async writeCell(spreadsheetId, cell, value, sheetName = null) {
    try {
      const range = sheetName ? `'${sheetName}'!${cell}` : cell;
      
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[value]]
        }
      });
      return true;
    } catch (error) {
      console.error(`셀 쓰기 오류 (${cell}):`, error.message);
      return false;
    }
  }

  /**
   * 범위의 값 읽기 (시트 이름 지원)
   * @param {string} spreadsheetId - 스프레드시트 ID
   * @param {string} range - 범위 (예: 'A1:B10')
   * @param {string} sheetName - 시트 이름 (선택)
   * @returns {Array} - 2차원 배열
   */
  async readRange(spreadsheetId, range, sheetName = null) {
    try {
      const fullRange = sheetName ? `'${sheetName}'!${range}` : range;
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: fullRange
      });
      return response.data.values || [];
    } catch (error) {
      console.error(`범위 읽기 오류 (${range}):`, error.message);
      return [];
    }
  }

  /**
   * 캐릭터 기본 정보 읽기
   * @param {string} spreadsheetId - 스프레드시트 ID
   * @param {string} sheetName - 시트 이름 (선택)
   * @returns {Object} - 캐릭터 정보
   */
  async readCharacterInfo(spreadsheetId, sheetName = null) {
    try {
      const info = {};
      
      // 기본 정보 읽기
      info.codeName = await this.readCell(spreadsheetId, SHEET_MAPPING.codeName, sheetName);
      info.characterName = await this.readCell(spreadsheetId, SHEET_MAPPING.characterName, sheetName);
      info.cover = await this.readCell(spreadsheetId, SHEET_MAPPING.cover, sheetName);
      info.works = await this.readCell(spreadsheetId, SHEET_MAPPING.works, sheetName);
      info.awakening = await this.readCell(spreadsheetId, SHEET_MAPPING.awakening, sheetName);
      info.impulse = await this.readCell(spreadsheetId, SHEET_MAPPING.impulse, sheetName);
      info.breed = await this.readCell(spreadsheetId, SHEET_MAPPING.breed, sheetName);
      
      // 신드롬 읽기
      const syndrome1 = await this.readCell(spreadsheetId, SHEET_MAPPING.syndrome1, sheetName);
      const syndrome2 = await this.readCell(spreadsheetId, SHEET_MAPPING.syndrome2, sheetName);
      const syndromeOptional = await this.readCell(spreadsheetId, SHEET_MAPPING.syndromeOptional, sheetName);
      
      const syndromes = [syndrome1, syndrome2, syndromeOptional].filter(s => s && s.trim());
      info.syndromes = syndromes.join(' × ');
      
      return info;
    } catch (error) {
      console.error('캐릭터 정보 읽기 오류:', error.message);
      return null;
    }
  }

  /**
   * 캐릭터 능력치 읽기
   * @param {string} spreadsheetId - 스프레드시트 ID
   * @param {string} sheetName - 시트 이름 (선택)
   * @returns {Object} - 능력치 정보
   */
  async readCharacterStats(spreadsheetId, sheetName = null) {
    try {
      const stats = {};
      
      // HP, 침식률 읽기
      stats.HP = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.HP, sheetName)) || 0;
      stats.침식률 = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.erosion, sheetName)) || 0;
      stats.침식D = calculateErosionD(stats.침식률);
      
      // 상위 능력치 읽기
      stats.육체 = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.body, sheetName)) || 0;
      stats.감각 = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.sense, sheetName)) || 0;
      stats.정신 = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.mind, sheetName)) || 0;
      stats.사회 = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.social, sheetName)) || 0;
      
      // 세부 기능 읽기
      stats.백병 = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.melee, sheetName)) || 0;
      stats.회피 = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.dodge, sheetName)) || 0;
      stats.사격 = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.shoot, sheetName)) || 0;
      stats.지각 = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.perceive, sheetName)) || 0;
      stats.RC = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.RC, sheetName)) || 0;
      stats.의지 = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.will, sheetName)) || 0;
      stats.교섭 = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.negotiate, sheetName)) || 0;
      stats.조달 = parseInt(await this.readCell(spreadsheetId, SHEET_MAPPING.procure, sheetName)) || 0;
      
      return stats;
    } catch (error) {
      console.error('능력치 읽기 오류:', error.message);
      return null;
    }
  }

  /**
   * 로이스 목록 읽기
   * @param {string} spreadsheetId - 스프레드시트 ID
   * @param {string} sheetName - 시트 이름 (선택)
   * @returns {Array} - 로이스 배열
   */
  async readLois(spreadsheetId, sheetName = null) {
    try {
      const loisList = [];
      const { startRow, endRow, typeCol, nameCol, positiveCol, negativeCol, descCol, titusCol } = SHEET_MAPPING.lois;
      
      for (let row = startRow; row <= endRow; row++) {
        const type = await this.readCell(spreadsheetId, `${typeCol}${row}`, sheetName);
        const name = await this.readCell(spreadsheetId, `${nameCol}${row}`, sheetName);
        const titus = await this.readCell(spreadsheetId, `${titusCol}${row}`, sheetName);
        
        // D로이스이거나 타이터스인 경우 제외
        if (type && type.includes('D로이스')) continue;
        if (titus && (titus === 'T' || titus === 't')) continue;
        
        // 이름이 있는 로이스만 추가
        if (name && name.trim()) {
          const positive = await this.readCell(spreadsheetId, `${positiveCol}${row}`, sheetName);
          const negative = await this.readCell(spreadsheetId, `${negativeCol}${row}`, sheetName);
          const desc = await this.readCell(spreadsheetId, `${descCol}${row}`, sheetName);
          
          loisList.push({
            name: name.trim(),
            pEmotion: positive || '',
            nEmotion: negative || '',
            description: desc || ''
          });
        }
      }
      
      return loisList;
    } catch (error) {
      console.error('로이스 읽기 오류:', error.message);
      return [];
    }
  }

  /**
   * HP 또는 침식률 업데이트
   * @param {string} spreadsheetId - 스프레드시트 ID
   * @param {string} statName - 능력치 이름 ('HP' 또는 '침식률')
   * @param {number} value - 새로운 값
   * @param {string} sheetName - 시트 이름 (선택)
   */
  async updateStat(spreadsheetId, statName, value, sheetName = null) {
    try {
      const cell = STAT_TO_CELL[statName];
      if (!cell) {
        throw new Error(`알 수 없는 능력치: ${statName}`);
      }
      
      await this.writeCell(spreadsheetId, cell, value, sheetName);
      
      // 침식률 업데이트 시 침식D도 계산하여 표시 (시트에는 쓰지 않음)
      if (statName === '침식률') {
        return calculateErosionD(value);
      }
      
      return true;
    } catch (error) {
      console.error(`능력치 업데이트 오류 (${statName}):`, error.message);
      return false;
    }
  }

  /**
   * 전체 캐릭터 데이터 읽기 (배치 읽기로 최적화)
   * @param {string} spreadsheetId - 스프레드시트 ID
   * @param {string} sheetName - 시트 이름 (선택)
   * @returns {Object} - 전체 캐릭터 데이터
   */
  async readFullCharacter(spreadsheetId, sheetName = null) {
    try {
      // 🚀 한 번의 API 호출로 전체 시트 데이터 가져오기
      const range = sheetName ? `'${sheetName}'!A1:AK100` : 'A1:AK100';
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range
      });
      
      const rows = response.data.values || [];
      
      // 헬퍼 함수: 열 문자를 인덱스로 변환 (A=0, B=1, ...)
      const colToIndex = (col) => {
        let index = 0;
        for (let i = 0; i < col.length; i++) {
          index = index * 26 + (col.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
        }
        return index - 1;
      };
      
      // 헬퍼 함수: 셀 값 가져오기
      const getCell = (cellRef) => {
        const match = cellRef.match(/([A-Z]+)(\d+)/);
        if (!match) return null;
        const col = colToIndex(match[1]);
        const row = parseInt(match[2]) - 1;
        return rows[row]?.[col] || null;
      };
      
      // 캐릭터 기본 정보
      const info = {
        codeName: getCell(SHEET_MAPPING.codeName),
        characterName: getCell(SHEET_MAPPING.characterName),
        cover: getCell(SHEET_MAPPING.cover),
        works: getCell(SHEET_MAPPING.works),
        awakening: getCell(SHEET_MAPPING.awakening),
        impulse: getCell(SHEET_MAPPING.impulse),
        breed: getCell(SHEET_MAPPING.breed)
      };
      
      // 신드롬
      const syndrome1 = getCell(SHEET_MAPPING.syndrome1);
      const syndrome2 = getCell(SHEET_MAPPING.syndrome2);
      const syndromeOptional = getCell(SHEET_MAPPING.syndromeOptional);
      const syndromes = [syndrome1, syndrome2, syndromeOptional].filter(s => s && s.trim());
      info.syndromes = syndromes.join(' × ');
      
      // 능력치
      const stats = {
        HP: parseInt(getCell(SHEET_MAPPING.HP)) || 0,
        침식률: parseInt(getCell(SHEET_MAPPING.erosion)) || 0
      };
      stats.침식D = calculateErosionD(stats.침식률);
      
      // 상위 능력치
      stats.육체 = parseInt(getCell(SHEET_MAPPING.body)) || 0;
      stats.감각 = parseInt(getCell(SHEET_MAPPING.sense)) || 0;
      stats.정신 = parseInt(getCell(SHEET_MAPPING.mind)) || 0;
      stats.사회 = parseInt(getCell(SHEET_MAPPING.social)) || 0;
      
      // 세부 기능
      stats.백병 = parseInt(getCell(SHEET_MAPPING.melee)) || 0;
      stats.회피 = parseInt(getCell(SHEET_MAPPING.dodge)) || 0;
      stats.사격 = parseInt(getCell(SHEET_MAPPING.shoot)) || 0;
      stats.지각 = parseInt(getCell(SHEET_MAPPING.perceive)) || 0;
      stats.RC = parseInt(getCell(SHEET_MAPPING.RC)) || 0;
      stats.의지 = parseInt(getCell(SHEET_MAPPING.will)) || 0;
      stats.교섭 = parseInt(getCell(SHEET_MAPPING.negotiate)) || 0;
      stats.조달 = parseInt(getCell(SHEET_MAPPING.procure)) || 0;
      
      // 로이스
      const loisList = [];
      const { startRow, endRow, typeCol, nameCol, positiveCol, negativeCol, positiveCheckCol, negativeCheckCol, descCol, titusCol } = SHEET_MAPPING.lois;
      
      for (let row = startRow; row <= endRow; row++) {
        const type = getCell(`${typeCol}${row}`);
        const name = getCell(`${nameCol}${row}`);
        const titus = getCell(`${titusCol}${row}`);
        
        // D로이스는 제외
        if (type && type.includes('D로이스')) continue;
        
        // 이름이 있는 로이스만 추가
        if (name && name.trim()) {
          const positive = getCell(`${positiveCol}${row}`);
          const negative = getCell(`${negativeCol}${row}`);
          const positiveCheck = getCell(`${positiveCheckCol}${row}`);
          const negativeCheck = getCell(`${negativeCheckCol}${row}`);
          const desc = getCell(`${descCol}${row}`);
          
          // 강조 처리 (TRUE 또는 체크 확인) - 더 관대한 체크
          const isPChecked = positiveCheck !== null && positiveCheck !== undefined && positiveCheck !== '' && positiveCheck !== false && positiveCheck !== 'FALSE';
          const isNChecked = negativeCheck !== null && negativeCheck !== undefined && negativeCheck !== '' && negativeCheck !== false && negativeCheck !== 'FALSE';
          
          const formattedP = isPChecked 
            ? `**【P: ${positive}】**` 
            : `P: ${positive}`;
          const formattedN = isNChecked
            ? `**【N: ${negative}】**`
            : `N: ${negative}`;
          
          // 타이터스 체크 확인
          const isTitus = titus && (titus === 'TRUE' || titus === 'T' || titus === 't' || titus === '○' || titus === 'O');
          
          loisList.push({
            name: name.trim(),
            pEmotion: formattedP || '',
            nEmotion: formattedN || '',
            description: desc || '',
            isTitus: isTitus  // 타이터스 플래그 추가
          });
        }
      }
      
      // 메모리
      const memoryList = [];
      const memoryMapping = SHEET_MAPPING.memory;
      for (let row = memoryMapping.startRow; row <= memoryMapping.endRow; row++) {
        const name = getCell(`${memoryMapping.nameCol}${row}`);
        if (name && name.trim()) {
          const emotion = getCell(`${memoryMapping.emotionCol}${row}`);
          const desc = getCell(`${memoryMapping.descCol}${row}`);
          
          memoryList.push({
            name: name.trim(),
            emotion: emotion || '',
            description: desc || ''
          });
        }
      }
      
      // 무기
      const weaponList = [];
      const weaponMapping = SHEET_MAPPING.weapon;
      for (let row = weaponMapping.startRow; row <= weaponMapping.endRow; row++) {
        const name = getCell(`${weaponMapping.nameCol}${row}`);
        if (name && name.trim()) {
          weaponList.push({
            name: name.trim(),
            type: getCell(`${weaponMapping.typeCol}${row}`) || '',
            ability: getCell(`${weaponMapping.abilityCol}${row}`) || '',
            range: getCell(`${weaponMapping.rangeCol}${row}`) || '',
            accuracy: getCell(`${weaponMapping.accuracyCol}${row}`) || '',
            attack: getCell(`${weaponMapping.attackCol}${row}`) || '',
            guard: getCell(`${weaponMapping.guardCol}${row}`) || '',
            description: getCell(`${weaponMapping.descCol}${row}`) || ''
          });
        }
      }
      
      // 방어구
      const armorList = [];
      const armorMapping = SHEET_MAPPING.armor;
      for (let row = armorMapping.startRow; row <= armorMapping.endRow; row++) {
        const name = getCell(`${armorMapping.nameCol}${row}`);
        if (name && name.trim()) {
          armorList.push({
            name: name.trim(),
            type: getCell(`${armorMapping.typeCol}${row}`) || '',
            dodge: getCell(`${armorMapping.dodgeCol}${row}`) || '',
            action: getCell(`${armorMapping.actionCol}${row}`) || '',
            defense: getCell(`${armorMapping.defenseCol}${row}`) || '',
            description: getCell(`${armorMapping.descCol}${row}`) || ''
          });
        }
      }
      
      // 비클
      const vehicleList = [];
      const vehicleMapping = SHEET_MAPPING.vehicle;
      for (let row = vehicleMapping.startRow; row <= vehicleMapping.endRow; row++) {
        const name = getCell(`${vehicleMapping.nameCol}${row}`);
        if (name && name.trim()) {
          vehicleList.push({
            name: name.trim(),
            type: getCell(`${vehicleMapping.typeCol}${row}`) || '',
            ability: getCell(`${vehicleMapping.abilityCol}${row}`) || '',
            attack: getCell(`${vehicleMapping.attackCol}${row}`) || '',
            action: getCell(`${vehicleMapping.actionCol}${row}`) || '',
            defense: getCell(`${vehicleMapping.defenseCol}${row}`) || '',
            move: getCell(`${vehicleMapping.moveCol}${row}`) || '',
            description: getCell(`${vehicleMapping.descCol}${row}`) || ''
          });
        }
      }
      
      // 아이템
      const itemList = [];
      const itemMapping = SHEET_MAPPING.item;
      for (let row = itemMapping.startRow; row <= itemMapping.endRow; row++) {
        const name = getCell(`${itemMapping.nameCol}${row}`);
        if (name && name.trim()) {
          itemList.push({
            name: name.trim(),
            type: getCell(`${itemMapping.typeCol}${row}`) || '',
            ability: getCell(`${itemMapping.abilityCol}${row}`) || '',
            description: getCell(`${itemMapping.descCol}${row}`) || ''
          });
        }
      }
      
      return {
        ...info,
        ...stats,
        lois: loisList,
        로이스: loisList.length,
        memory: memoryList,
        메모리: memoryList.length,
        weapons: weaponList,
        무기: weaponList.length,
        armor: armorList,
        방어구: armorList.length,
        vehicles: vehicleList,
        비클: vehicleList.length,
        items: itemList,
        아이템: itemList.length
      };
    } catch (error) {
      console.error('전체 캐릭터 데이터 읽기 오류:', error.message);
      return null;
    }
  }

  /**
   * 시트 접근 권한 확인
   * @param {string} spreadsheetId - 스프레드시트 ID
   * @returns {boolean} - 접근 가능 여부
   */
  async testAccess(spreadsheetId) {
    try {
      await this.sheets.spreadsheets.get({ spreadsheetId });
      return true;
    } catch (error) {
      console.error('시트 접근 오류:', error.message);
      return false;
    }
  }

  /**
   * 시트에서 이펙트 목록 읽기
   * @param {string} spreadsheetId - 스프레드시트 ID
   * @param {string} sheetName - 시트 이름
   * @returns {Array} - 이펙트 목록
   */
  async readEffects(spreadsheetId, sheetName = null) {
    try {
      console.log(`📊 [이펙트 읽기] 시작 - 시트: ${sheetName || '기본'}`);
      
      const range = sheetName ? `'${sheetName}'!A1:Z200` : 'A1:Z200';
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range
      });
      
      const rows = response.data.values || [];
      console.log(`📊 [이펙트 읽기] 전체 행 수: ${rows.length}`);
      
      const colToIndex = (col) => {
        let index = 0;
        for (let i = 0; i < col.length; i++) {
          index = index * 26 + (col.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
        }
        return index - 1;
      };
      
      const getCell = (cellRef) => {
        const match = cellRef.match(/([A-Z]+)(\d+)/);
        if (!match) return null;
        const col = colToIndex(match[1]);
        const row = parseInt(match[2]) - 1;
        return rows[row]?.[col] || null;
      };
      
      const effectList = [];
      const { rows: effectRows } = SHEET_MAPPING.effect;
      
      console.log(`📊 [이펙트 읽기] 확인할 행: ${effectRows.join(', ')}`);
      
      for (let row of effectRows) {
        const name = getCell(`${SHEET_MAPPING.effect.nameCol}${row}`);
        
        if (name && name.trim()) {
          console.log(`✅ [이펙트 읽기] ${row}행: ${name}`);
          
          const currentLevel = parseInt(getCell(`${SHEET_MAPPING.effect.currentLevelCol}${row}`)) || 0;
          const maxLevel = parseInt(getCell(`${SHEET_MAPPING.effect.maxLevelCol}${row}`)) || 0;
          const timing = getCell(`${SHEET_MAPPING.effect.timingCol}${row}`);
          const ability = getCell(`${SHEET_MAPPING.effect.abilityCol}${row}`);
          const difficulty = getCell(`${SHEET_MAPPING.effect.difficultyCol}${row}`);
          const target = getCell(`${SHEET_MAPPING.effect.targetCol}${row}`);
          const range = getCell(`${SHEET_MAPPING.effect.rangeCol}${row}`);
          const erosion = getCell(`${SHEET_MAPPING.effect.erosionCol}${row}`);
          const restriction = getCell(`${SHEET_MAPPING.effect.restrictionCol}${row}`);
          const effect = getCell(`${SHEET_MAPPING.effect.effectCol}${row}`);
          
          console.log(`   - 현재Lv: ${currentLevel}, 최대Lv: ${maxLevel}`);
          console.log(`   - 타이밍: ${timing}, 기능: ${ability}`);
          
          effectList.push({
            name: name.trim(),
            currentLevel,
            maxLevel,
            timing: timing || '',
            ability: ability || '',
            difficulty: difficulty || '',
            target: target || '',
            range: range || '',
            erosion: erosion || '',
            restriction: restriction || '',
            effect: effect || ''
          });
        } else {
          console.log(`⏭️ [이펙트 읽기] ${row}행: 비어있음`);
        }
      }
      
      console.log(`📊 [이펙트 읽기] 총 ${effectList.length}개 읽음`);
      return effectList;
    } catch (error) {
      console.error('❌ [이펙트 읽기 오류]:', error.message);
      console.error(error.stack);
      return [];
    }
  }

  /**
   * 시트에서 콤보 목록 읽기
   * @param {string} spreadsheetId - 스프레드시트 ID
   * @param {string} sheetName - 시트 이름
   * @returns {Array} - 콤보 목록
   */
  async readCombos(spreadsheetId, sheetName = null) {
    try {
      const range = sheetName ? `'${sheetName}'!A1:AH250` : 'A1:AH250';
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range
      });
      
      const rows = response.data.values || [];
      
      const colToIndex = (col) => {
        let index = 0;
        for (let i = 0; i < col.length; i++) {
          index = index * 26 + (col.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
        }
        return index - 1;
      };
      
      const getCell = (cellRef) => {
        const match = cellRef.match(/([A-Z]+)(\d+)/);
        if (!match) return null;
        const col = colToIndex(match[1]);
        const row = parseInt(match[2]) - 1;
        return rows[row]?.[col] || null;
      };
      
      const comboList = [];
      const { startRow, endRow, interval } = SHEET_MAPPING.combo;
      
      for (let baseRow = startRow; baseRow <= endRow; baseRow += interval) {
        const comboName = getCell(`${SHEET_MAPPING.combo.nameCol}${baseRow}`);
        if (!comboName || !comboName.trim()) continue;
        
        // 기본 정보 (N+1행)
        const timing = getCell(`${SHEET_MAPPING.combo.timingCol}${baseRow + 1}`);
        const skill = getCell(`${SHEET_MAPPING.combo.skillCol}${baseRow + 1}`);
        const difficulty = getCell(`${SHEET_MAPPING.combo.difficultyCol}${baseRow + 1}`);
        const target = getCell(`${SHEET_MAPPING.combo.targetCol}${baseRow + 1}`);
        const range = getCell(`${SHEET_MAPPING.combo.rangeCol}${baseRow + 1}`);
        const restriction = getCell(`${SHEET_MAPPING.combo.restrictionCol}${baseRow + 1}`);
        const erosion = getCell(`${SHEET_MAPPING.combo.erosionCol}${baseRow + 1}`);
        
        // 99↓ 데이터
        const effectList99 = getCell(`${SHEET_MAPPING.combo.effectList99Col}${baseRow + 2}`);
        const content99 = getCell(`${SHEET_MAPPING.combo.content99Col}${baseRow + 3}`);
        const dice99 = getCell(`${SHEET_MAPPING.combo.dice99Col}${baseRow + 3}`);
        const critical99 = getCell(`${SHEET_MAPPING.combo.critical99Col}${baseRow + 3}`);
        const attack99 = getCell(`${SHEET_MAPPING.combo.attack99Col}${baseRow + 3}`);
        
        // 100↑ 데이터
        const effectList100 = getCell(`${SHEET_MAPPING.combo.effectList100Col}${baseRow + 4}`);
        const content100 = getCell(`${SHEET_MAPPING.combo.content100Col}${baseRow + 5}`);
        const dice100 = getCell(`${SHEET_MAPPING.combo.dice100Col}${baseRow + 5}`);
        const critical100 = getCell(`${SHEET_MAPPING.combo.critical100Col}${baseRow + 5}`);
        const attack100 = getCell(`${SHEET_MAPPING.combo.attack100Col}${baseRow + 5}`);
        
        comboList.push({
          name: comboName.trim(),
          timing: timing || '',
          skill: skill || '',
          difficulty: difficulty || '',
          target: target || '',
          range: range || '',
          restriction: restriction || '',
          erosion: erosion || '',
          '99↓': {
            effectList: effectList99 || '',
            content: content99 || '',
            dice: dice99 || '',
            critical: critical99 || '',
            attack: attack99 || ''
          },
          '100↑': {
            effectList: effectList100 || '',
            content: content100 || '',
            dice: dice100 || '',
            critical: critical100 || '',
            attack: attack100 || ''
          }
        });
      }
      
      return comboList;
    } catch (error) {
      console.error('콤보 읽기 오류:', error.message);
      return [];
    }
  }
}

module.exports = SheetsClient;