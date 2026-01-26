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
   * 캐릭터 전체 데이터 읽기
   */
  async readFullCharacter(spreadsheetId, sheetName) {
    if (!this.initialized) return null;

    try {
      console.log(`📊 시트에서 캐릭터 데이터 읽기: ${spreadsheetId} - ${sheetName}`);
      
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

      // 운전, 예술, 지식, 정보 (동적 기능)
      const dynamicSkills = ['driving', 'art', 'knowledge', 'info'];
      for (const skillType of dynamicSkills) {
        const config = SHEET_MAPPING[skillType];
        for (let row = config.startRow; row <= config.endRow; row++) {
          const skillName = await this.readCell(spreadsheetId, `${config.nameCol}${row}`, sheetName);
          const skillValue = await this.readCell(spreadsheetId, `${config.valueCol}${row}`, sheetName);
          
          if (skillName && skillValue && !isNaN(parseInt(skillValue))) {
            characterData[skillName] = parseInt(skillValue);
          }
        }
      }

      // 로이스 읽기
      const loisConfig = SHEET_MAPPING.lois;
      for (let row = loisConfig.startRow; row <= loisConfig.endRow; row++) {
        const loisType = await this.readCell(spreadsheetId, `${loisConfig.typeCol}${row}`, sheetName);
        const loisName = await this.readCell(spreadsheetId, `${loisConfig.nameCol}${row}`, sheetName);
        
        if (loisName && loisName.trim() && loisType !== 'D') {  // D로이스 제외
          const pEmotion = await this.readCell(spreadsheetId, `${loisConfig.positiveCol}${row}`, sheetName);
          const nEmotion = await this.readCell(spreadsheetId, `${loisConfig.negativeCol}${row}`, sheetName);
          const pCheck = await this.readCell(spreadsheetId, `${loisConfig.positiveCheckCol}${row}`, sheetName);
          const nCheck = await this.readCell(spreadsheetId, `${loisConfig.negativeCheckCol}${row}`, sheetName);
          const description = await this.readCell(spreadsheetId, `${loisConfig.descCol}${row}`, sheetName);
          const titusCheck = await this.readCell(spreadsheetId, `${loisConfig.titusCol}${row}`, sheetName);

          // 강조 처리
          const formattedP = pCheck ? `**【P: ${pEmotion}】**` : `P: ${pEmotion || '-'}`;
          const formattedN = nCheck ? `**【N: ${nEmotion}】**` : `N: ${nEmotion || '-'}`;

          const loisData = {
            name: loisName.trim(),
            pEmotion: formattedP,
            nEmotion: formattedN,
            description: description ? description.trim() : '',
          };

          // 타이터스 체크
          if (titusCheck === 'T' || titusCheck === 'TRUE') {
            loisData.name = `~~${loisData.name}~~`;
            loisData.pEmotion = `~~${loisData.pEmotion}~~`;
            loisData.nEmotion = `~~${loisData.nEmotion}~~`;
            loisData.description = `~~${loisData.description}~~`;
            loisData.isTitus = true;
          }

          characterData.lois.push(loisData);
        }
      }
      characterData.로이스 = characterData.lois.length;

      // D로이스 읽기
      const dloisNoAndName = await this.readCell(spreadsheetId, SHEET_MAPPING.dlois.noAndNameCell, sheetName);
      if (dloisNoAndName) {
        // "No. 17 기묘한 이웃 Strange Neighbour" 형식 파싱
        const match = dloisNoAndName.match(/No\.\s*(\d+)\s+(.+)/i);
        if (match) {
          characterData.dloisNo = match[1];
          characterData.dloisName = match[2].trim();
        }
      }

      // 콤보 읽기
      const comboConfig = SHEET_MAPPING.combo;
      for (let row = comboConfig.startRow; row <= comboConfig.endRow; row += comboConfig.interval) {
        const comboName = await this.readCell(spreadsheetId, `${comboConfig.nameCol}${row}`, sheetName);
        
        if (comboName && comboName.trim()) {
          const timing = await this.readCell(spreadsheetId, `${comboConfig.timingCol}${row + 1}`, sheetName);
          const skill = await this.readCell(spreadsheetId, `${comboConfig.skillCol}${row + 1}`, sheetName);
          const difficulty = await this.readCell(spreadsheetId, `${comboConfig.difficultyCol}${row + 1}`, sheetName);
          const target = await this.readCell(spreadsheetId, `${comboConfig.targetCol}${row + 1}`, sheetName);
          const range = await this.readCell(spreadsheetId, `${comboConfig.rangeCol}${row + 1}`, sheetName);
          const restriction = await this.readCell(spreadsheetId, `${comboConfig.restrictionCol}${row + 1}`, sheetName);
          const erosion = await this.readCell(spreadsheetId, `${comboConfig.erosionCol}${row + 1}`, sheetName);

          // 99↓ 조건
          const effectList99 = await this.readCell(spreadsheetId, `${comboConfig.effectList99Col}${row + 2}`, sheetName);
          const content99 = await this.readCell(spreadsheetId, `${comboConfig.content99Col}${row + 3}`, sheetName);
          const dice99 = await this.readCell(spreadsheetId, `${comboConfig.dice99Col}${row + 3}`, sheetName);
          const critical99 = await this.readCell(spreadsheetId, `${comboConfig.critical99Col}${row + 3}`, sheetName);
          const attack99 = await this.readCell(spreadsheetId, `${comboConfig.attack99Col}${row + 3}`, sheetName);

          // 100↑ 조건
          const effectList100 = await this.readCell(spreadsheetId, `${comboConfig.effectList100Col}${row + 4}`, sheetName);
          const content100 = await this.readCell(spreadsheetId, `${comboConfig.content100Col}${row + 5}`, sheetName);
          const dice100 = await this.readCell(spreadsheetId, `${comboConfig.dice100Col}${row + 5}`, sheetName);
          const critical100 = await this.readCell(spreadsheetId, `${comboConfig.critical100Col}${row + 5}`, sheetName);
          const attack100 = await this.readCell(spreadsheetId, `${comboConfig.attack100Col}${row + 5}`, sheetName);

          characterData.combos.push({
            name: comboName.trim(),
            timing: timing || '',
            skill: skill || '백병',
            difficulty: difficulty || '',
            target: target || '',
            range: range || '',
            restriction: restriction || '',
            erosion: erosion || '',
            // 99↓
            effectList99: effectList99 || '',
            content99: content99 || '',
            dice99: dice99 ? parseInt(dice99) : 0,
            critical99: critical99 ? parseInt(critical99) : 10,
            attack99: attack99 || '',
            // 100↑
            effectList100: effectList100 || '',
            content100: content100 || '',
            dice100: dice100 ? parseInt(dice100) : 0,
            critical100: critical100 ? parseInt(critical100) : 10,
            attack100: attack100 || '',
          });
        }
      }

      // 무기 읽기
      const weaponConfig = SHEET_MAPPING.weapon;
      for (let row = weaponConfig.startRow; row <= weaponConfig.endRow; row++) {
        const weaponName = await this.readCell(spreadsheetId, `${weaponConfig.nameCol}${row}`, sheetName);
        if (weaponName && weaponName.trim()) {
          characterData.weapons.push({
            name: weaponName.trim(),
            type: await this.readCell(spreadsheetId, `${weaponConfig.typeCol}${row}`, sheetName) || '',
            ability: await this.readCell(spreadsheetId, `${weaponConfig.abilityCol}${row}`, sheetName) || '',
            range: await this.readCell(spreadsheetId, `${weaponConfig.rangeCol}${row}`, sheetName) || '',
            accuracy: await this.readCell(spreadsheetId, `${weaponConfig.accuracyCol}${row}`, sheetName) || '',
            attack: await this.readCell(spreadsheetId, `${weaponConfig.attackCol}${row}`, sheetName) || '',
            guard: await this.readCell(spreadsheetId, `${weaponConfig.guardCol}${row}`, sheetName) || '',
            description: await this.readCell(spreadsheetId, `${weaponConfig.descCol}${row}`, sheetName) || '',
          });
        }
      }

      // 방어구 읽기
      const armorConfig = SHEET_MAPPING.armor;
      for (let row = armorConfig.startRow; row <= armorConfig.endRow; row++) {
        const armorName = await this.readCell(spreadsheetId, `${armorConfig.nameCol}${row}`, sheetName);
        if (armorName && armorName.trim()) {
          characterData.armor.push({
            name: armorName.trim(),
            type: await this.readCell(spreadsheetId, `${armorConfig.typeCol}${row}`, sheetName) || '',
            dodge: await this.readCell(spreadsheetId, `${armorConfig.dodgeCol}${row}`, sheetName) || '',
            action: await this.readCell(spreadsheetId, `${armorConfig.actionCol}${row}`, sheetName) || '',
            defense: await this.readCell(spreadsheetId, `${armorConfig.defenseCol}${row}`, sheetName) || '',
            description: await this.readCell(spreadsheetId, `${armorConfig.descCol}${row}`, sheetName) || '',
          });
        }
      }

      console.log(`✅ 캐릭터 데이터 읽기 완료: ${characterData.characterName}`);
      console.log(`   - HP: ${characterData.HP}, 침식률: ${characterData.침식률}, 침식D: ${characterData.침식D}`);
      console.log(`   - 로이스: ${characterData.lois.length}개`);
      console.log(`   - 콤보: ${characterData.combos.length}개`);
      console.log(`   - 무기: ${characterData.weapons.length}개`);
      console.log(`   - 방어구: ${characterData.armor.length}개`);

      return characterData;

    } catch (error) {
      console.error('캐릭터 데이터 읽기 실패:', error);
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