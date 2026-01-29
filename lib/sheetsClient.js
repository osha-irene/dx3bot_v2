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
      const keyFilePath = path.join(__dirname, '..', 'config', 'google-credentials.json');
      
      if (!fs.existsSync(keyFilePath)) {
        console.log('⚠️ google-credentials.json 파일이 없습니다. Google Sheets 연동이 비활성화됩니다.');
        return false;
      }

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

  extractSpreadsheetId(url) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : url;
  }

  async getServiceAccountEmail() {
    return this.serviceAccountEmail;
  }

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

  async listTabs(spreadsheetId) {
    return await this.getSheetList(spreadsheetId);
  }

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
      return null;
    }
  }

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
   * 셀 주소를 행/열 인덱스로 변환
   */
  cellToIndex(cell) {
    const match = cell.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;

    const colStr = match[1];
    const row = parseInt(match[2]) - 1;

    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
      col = col * 26 + (colStr.charCodeAt(i) - 64);
    }
    col -= 1;

    return { row, col };
  }

  /**
   * 2D 배열에서 셀 값 가져오기
   */
  getCellFromArray(data, cellAddress, startCell = 'A1') {
    const targetIndex = this.cellToIndex(cellAddress);
    const startIndex = this.cellToIndex(startCell);
    
    if (!targetIndex || !startIndex) return null;

    const row = targetIndex.row - startIndex.row;
    const col = targetIndex.col - startIndex.col;

    if (!data || row >= data.length || row < 0) return null;
    if (!data[row] || col >= data[row].length || col < 0) return null;
    
    const value = data[row][col];
    return (value === undefined || value === '') ? null : value;
  }

  /**
   * 🚀 캐릭터 전체 데이터 읽기 (초고속 배치 버전)
   */
  async readFullCharacter(spreadsheetId, sheetName) {
    if (!this.initialized) return null;

    try {
      const startTime = Date.now();
      console.log(`⚡ [배치] 시트에서 캐릭터 데이터 읽기 시작: ${sheetName}`);
      
      const { SHEET_MAPPING, calculateErosionD } = require('./sheetsMapping');
      
      // === 1. 큰 범위를 한 번에 읽기 (API 호출 3번으로 끝!) ===
      const baseInfo = await this.readRange(spreadsheetId, 'A1:AF50', sheetName);       // 기본정보+능력치
      const loisData = await this.readRange(spreadsheetId, 'A67:AF80', sheetName);      // 로이스+메모리
      const equipmentData = await this.readRange(spreadsheetId, 'A91:AF240', sheetName); // 무기~콤보 전체
      
      console.log(`⚡ [배치] 3개 범위 읽기 완료 (${Date.now() - startTime}ms)`);

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
        memory: []
      };

      // === 2. 메모리에서 추출 (API 호출 없음!) ===
      characterData.characterName = this.getCellFromArray(baseInfo, SHEET_MAPPING.characterName);
      characterData.codeName = this.getCellFromArray(baseInfo, SHEET_MAPPING.codeName);
	  characterData.imageUrl = this.getCellFromArray(baseInfo, SHEET_MAPPING.characterImage);
      characterData.cover = this.getCellFromArray(baseInfo, SHEET_MAPPING.cover);
      characterData.works = this.getCellFromArray(baseInfo, SHEET_MAPPING.works);
      characterData.awakening = this.getCellFromArray(baseInfo, SHEET_MAPPING.awakening);
      characterData.impulse = this.getCellFromArray(baseInfo, SHEET_MAPPING.impulse);
      characterData.breed = this.getCellFromArray(baseInfo, SHEET_MAPPING.breed);

      // 신드롬
      const syndrome1 = this.getCellFromArray(baseInfo, SHEET_MAPPING.syndrome1);
      const syndrome2 = this.getCellFromArray(baseInfo, SHEET_MAPPING.syndrome2);
      const syndromeOptional = this.getCellFromArray(baseInfo, SHEET_MAPPING.syndromeOptional);
      
      let syndromes = [];
      if (syndrome1) syndromes.push(syndrome1);
      if (syndrome2) syndromes.push(syndrome2);
      if (syndromeOptional) syndromes.push(syndromeOptional);
      characterData.syndromes = syndromes.join(' × ');

      // HP, 침식률
      const hp = this.getCellFromArray(baseInfo, SHEET_MAPPING.HP);
      const erosion = this.getCellFromArray(baseInfo, SHEET_MAPPING.erosion);
      characterData.HP = hp ? parseInt(hp) : 0;
      characterData.침식률 = erosion ? parseInt(erosion) : 0;
      characterData.침식D = calculateErosionD(characterData.침식률);

      // 능력치
      characterData.육체 = parseInt(this.getCellFromArray(baseInfo, SHEET_MAPPING.body)) || 0;
      characterData.감각 = parseInt(this.getCellFromArray(baseInfo, SHEET_MAPPING.sense)) || 0;
      characterData.정신 = parseInt(this.getCellFromArray(baseInfo, SHEET_MAPPING.mind)) || 0;
      characterData.사회 = parseInt(this.getCellFromArray(baseInfo, SHEET_MAPPING.social)) || 0;

      // 세부 기능
      characterData.백병 = parseInt(this.getCellFromArray(baseInfo, SHEET_MAPPING.melee)) || 0;
      characterData.회피 = parseInt(this.getCellFromArray(baseInfo, SHEET_MAPPING.dodge)) || 0;
      characterData.사격 = parseInt(this.getCellFromArray(baseInfo, SHEET_MAPPING.shoot)) || 0;
      characterData.지각 = parseInt(this.getCellFromArray(baseInfo, SHEET_MAPPING.perceive)) || 0;
      characterData.RC = parseInt(this.getCellFromArray(baseInfo, SHEET_MAPPING.RC)) || 0;
      characterData.의지 = parseInt(this.getCellFromArray(baseInfo, SHEET_MAPPING.will)) || 0;
      characterData.교섭 = parseInt(this.getCellFromArray(baseInfo, SHEET_MAPPING.negotiate)) || 0;
      characterData.조달 = parseInt(this.getCellFromArray(baseInfo, SHEET_MAPPING.procure)) || 0;

      // 동적 기능
      const dynamicSkills = ['driving', 'art', 'knowledge', 'info'];
      for (const skillType of dynamicSkills) {
        const config = SHEET_MAPPING[skillType];
        for (let row = config.startRow; row <= config.endRow; row++) {
          const skillName = this.getCellFromArray(baseInfo, `${config.nameCol}${row}`);
          const skillValue = this.getCellFromArray(baseInfo, `${config.valueCol}${row}`);
          
          if (skillName && skillValue && !isNaN(parseInt(skillValue))) {
            characterData[skillName] = parseInt(skillValue);
          }
        }
      }

      // D로이스
      const dloisNoAndName = this.getCellFromArray(loisData, SHEET_MAPPING.dlois.noAndNameCell, 'A67');
      if (dloisNoAndName) {
        const match = dloisNoAndName.match(/No\.\s*(\d+)\s+(.+)/i);
        if (match) {
          characterData.dloisNo = match[1];
          characterData.dloisName = match[2].trim();
        }
      }

      // 로이스
      const loisConfig = SHEET_MAPPING.lois;
      for (let row = loisConfig.startRow; row <= loisConfig.endRow; row++) {
        const loisType = this.getCellFromArray(loisData, `${loisConfig.typeCol}${row}`, 'A67');
        const loisName = this.getCellFromArray(loisData, `${loisConfig.nameCol}${row}`, 'A67');
        
        if (loisName && loisName.trim() && loisType !== 'D') {
          const pEmotion = this.getCellFromArray(loisData, `${loisConfig.positiveCol}${row}`, 'A67');
          const nEmotion = this.getCellFromArray(loisData, `${loisConfig.negativeCol}${row}`, 'A67');
          const pCheck = this.getCellFromArray(loisData, `${loisConfig.positiveCheckCol}${row}`, 'A67');
		  const nCheck = this.getCellFromArray(loisData, `${loisConfig.negativeCheckCol}${row}`, 'A67');
          const description = this.getCellFromArray(loisData, `${loisConfig.descCol}${row}`, 'A67');
          const titusCheck = this.getCellFromArray(loisData, `${loisConfig.titusCol}${row}`, 'A67');

	      const isPChecked = pCheck === true || pCheck === 'TRUE' || pCheck === 'true';
	      const isNChecked = nCheck === true || nCheck === 'TRUE' || nCheck === 'true';

	      const formattedP = isPChecked ? `**【P ${pEmotion}】**` : `P ${pEmotion || '-'}`;
	      const formattedN = isNChecked ? `**【N ${nEmotion}】**` : `N ${nEmotion || '-'}`;

          const loisData_item = {
            name: loisName.trim(),
            pEmotion: formattedP,
            nEmotion: formattedN,
            description: description ? description.trim() : '',
          };

          if (titusCheck === 'T' || titusCheck === 'TRUE') {
            loisData_item.isTitus = true;
          }

          characterData.lois.push(loisData_item);
        }
      }
      characterData.로이스 = characterData.lois.length;

      // 메모리
      const memoryConfig = SHEET_MAPPING.memory;
      for (let row = memoryConfig.startRow; row <= memoryConfig.endRow; row++) {
        const memoryName = this.getCellFromArray(loisData, `${memoryConfig.nameCol}${row}`, 'A67');
        if (memoryName && memoryName.trim()) {
          const emotion = this.getCellFromArray(loisData, `${memoryConfig.emotionCol}${row}`, 'A67');
          const desc = this.getCellFromArray(loisData, `${memoryConfig.descCol}${row}`, 'A67');
          
          characterData.memory.push({
            name: memoryName.trim(),
            emotion: emotion || '',
            description: desc || ''
          });
        }
      }

      // 무기
      const weaponConfig = SHEET_MAPPING.weapon;
      for (let row = weaponConfig.startRow; row <= weaponConfig.endRow; row++) {
        const weaponName = this.getCellFromArray(equipmentData, `${weaponConfig.nameCol}${row}`, 'A91');
        if (weaponName && weaponName.trim()) {
          characterData.weapons.push({
            name: weaponName.trim(),
            type: this.getCellFromArray(equipmentData, `${weaponConfig.typeCol}${row}`, 'A91') || '',
            ability: this.getCellFromArray(equipmentData, `${weaponConfig.abilityCol}${row}`, 'A91') || '',
            range: this.getCellFromArray(equipmentData, `${weaponConfig.rangeCol}${row}`, 'A91') || '',
            accuracy: this.getCellFromArray(equipmentData, `${weaponConfig.accuracyCol}${row}`, 'A91') || '',
            attack: this.getCellFromArray(equipmentData, `${weaponConfig.attackCol}${row}`, 'A91') || '',
            guard: this.getCellFromArray(equipmentData, `${weaponConfig.guardCol}${row}`, 'A91') || '',
            description: this.getCellFromArray(equipmentData, `${weaponConfig.descCol}${row}`, 'A91') || '',
          });
        }
      }

      // 방어구
      const armorConfig = SHEET_MAPPING.armor;
      for (let row = armorConfig.startRow; row <= armorConfig.endRow; row++) {
        const armorName = this.getCellFromArray(equipmentData, `${armorConfig.nameCol}${row}`, 'A91');
        if (armorName && armorName.trim()) {
          characterData.armor.push({
            name: armorName.trim(),
            type: this.getCellFromArray(equipmentData, `${armorConfig.typeCol}${row}`, 'A91') || '',
            dodge: this.getCellFromArray(equipmentData, `${armorConfig.dodgeCol}${row}`, 'A91') || '',
            action: this.getCellFromArray(equipmentData, `${armorConfig.actionCol}${row}`, 'A91') || '',
            defense: this.getCellFromArray(equipmentData, `${armorConfig.defenseCol}${row}`, 'A91') || '',
            description: this.getCellFromArray(equipmentData, `${armorConfig.descCol}${row}`, 'A91') || '',
          });
        }
      }

      // 비클
      const vehicleConfig = SHEET_MAPPING.vehicle;
      for (let row = vehicleConfig.startRow; row <= vehicleConfig.endRow; row++) {
        const vehicleName = this.getCellFromArray(equipmentData, `${vehicleConfig.nameCol}${row}`, 'A91');
        if (vehicleName && vehicleName.trim()) {
          characterData.vehicles.push({
            name: vehicleName.trim(),
            type: this.getCellFromArray(equipmentData, `${vehicleConfig.typeCol}${row}`, 'A91') || '',
            ability: this.getCellFromArray(equipmentData, `${vehicleConfig.abilityCol}${row}`, 'A91') || '',
            attack: this.getCellFromArray(equipmentData, `${vehicleConfig.attackCol}${row}`, 'A91') || '',
            action: this.getCellFromArray(equipmentData, `${vehicleConfig.actionCol}${row}`, 'A91') || '',
            defense: this.getCellFromArray(equipmentData, `${vehicleConfig.defenseCol}${row}`, 'A91') || '',
            move: this.getCellFromArray(equipmentData, `${vehicleConfig.moveCol}${row}`, 'A91') || '',
            description: this.getCellFromArray(equipmentData, `${vehicleConfig.descCol}${row}`, 'A91') || '',
          });
        }
      }

      // 아이템
      const itemConfig = SHEET_MAPPING.item;
      for (let row = itemConfig.startRow; row <= itemConfig.endRow; row++) {
        const itemName = this.getCellFromArray(equipmentData, `${itemConfig.nameCol}${row}`, 'A91');
        if (itemName && itemName.trim()) {
          characterData.items.push({
            name: itemName.trim(),
            type: this.getCellFromArray(equipmentData, `${itemConfig.typeCol}${row}`, 'A91') || '',
            ability: this.getCellFromArray(equipmentData, `${itemConfig.abilityCol}${row}`, 'A91') || '',
            description: this.getCellFromArray(equipmentData, `${itemConfig.descCol}${row}`, 'A91') || '',
          });
        }
      }

      // 이펙트
      const effectConfig = SHEET_MAPPING.effect;
      for (let row of effectConfig.rows) {
        const effectName = this.getCellFromArray(equipmentData, `${effectConfig.nameCol}${row}`, 'A91');
        if (effectName && effectName.trim()) {
          const currentLevel = this.getCellFromArray(equipmentData, `${effectConfig.currentLevelCol}${row}`, 'A91');
          const maxLevel = this.getCellFromArray(equipmentData, `${effectConfig.maxLevelCol}${row}`, 'A91');
          
          // ✅ 추가 정보 읽기
          const timing = this.getCellFromArray(equipmentData, `${effectConfig.timingCol}${row}`, 'A91');
          const ability = this.getCellFromArray(equipmentData, `${effectConfig.abilityCol}${row}`, 'A91');
          const difficulty = this.getCellFromArray(equipmentData, `${effectConfig.difficultyCol}${row}`, 'A91');
          const target = this.getCellFromArray(equipmentData, `${effectConfig.targetCol}${row}`, 'A91');
          const range = this.getCellFromArray(equipmentData, `${effectConfig.rangeCol}${row}`, 'A91');
          const erosion = this.getCellFromArray(equipmentData, `${effectConfig.erosionCol}${row}`, 'A91');
          const restriction = this.getCellFromArray(equipmentData, `${effectConfig.restrictionCol}${row}`, 'A91');
          const effect = this.getCellFromArray(equipmentData, `${effectConfig.effectCol}${row}`, 'A91'); // ✅ 효과 설명!
          
          characterData.effects.push({
            name: effectName.trim(),
            currentLevel: currentLevel ? parseInt(currentLevel) : 0,
            maxLevel: maxLevel ? parseInt(maxLevel) : 1,
            timing: timing || '',
            ability: ability || '',
            difficulty: difficulty || '',
            target: target || '',
            range: range || '',
            erosion: erosion || '',
            restriction: restriction || '',
            effect: effect || '' 
          });
        }
      }

      // 콤보
      const comboConfig = SHEET_MAPPING.combo;
      for (let row = comboConfig.startRow; row <= comboConfig.endRow; row += comboConfig.interval) {
        const comboName = this.getCellFromArray(equipmentData, `${comboConfig.nameCol}${row}`, 'A91');
        
        if (comboName && comboName.trim()) {
          const timing = this.getCellFromArray(equipmentData, `${comboConfig.timingCol}${row + 1}`, 'A91');
          const skill = this.getCellFromArray(equipmentData, `${comboConfig.skillCol}${row + 1}`, 'A91');
          const difficulty = this.getCellFromArray(equipmentData, `${comboConfig.difficultyCol}${row + 1}`, 'A91');
          const target = this.getCellFromArray(equipmentData, `${comboConfig.targetCol}${row + 1}`, 'A91');
          const range = this.getCellFromArray(equipmentData, `${comboConfig.rangeCol}${row + 1}`, 'A91');
          const restriction = this.getCellFromArray(equipmentData, `${comboConfig.restrictionCol}${row + 1}`, 'A91');
          const erosion = this.getCellFromArray(equipmentData, `${comboConfig.erosionCol}${row + 1}`, 'A91');

          const effectList99 = this.getCellFromArray(equipmentData, `${comboConfig.effectList99Col}${row + 2}`, 'A91');
          const content99 = this.getCellFromArray(equipmentData, `${comboConfig.content99Col}${row + 3}`, 'A91');
          const dice99 = this.getCellFromArray(equipmentData, `${comboConfig.dice99Col}${row + 3}`, 'A91');
          const critical99 = this.getCellFromArray(equipmentData, `${comboConfig.critical99Col}${row + 3}`, 'A91');
          const attack99 = this.getCellFromArray(equipmentData, `${comboConfig.attack99Col}${row + 3}`, 'A91');

          const effectList100 = this.getCellFromArray(equipmentData, `${comboConfig.effectList100Col}${row + 4}`, 'A91');
          const content100 = this.getCellFromArray(equipmentData, `${comboConfig.content100Col}${row + 5}`, 'A91');
          const dice100 = this.getCellFromArray(equipmentData, `${comboConfig.dice100Col}${row + 5}`, 'A91');
          const critical100 = this.getCellFromArray(equipmentData, `${comboConfig.critical100Col}${row + 5}`, 'A91');
          const attack100 = this.getCellFromArray(equipmentData, `${comboConfig.attack100Col}${row + 5}`, 'A91');

          characterData.combos.push({
            name: comboName.trim(),
            timing: timing || '',
            skill: skill || '백병',
            difficulty: difficulty || '',
            target: target || '',
            range: range || '',
            restriction: restriction || '',
            erosion: erosion || '',
            effectList99: effectList99 || '',
            content99: content99 || '',
            dice99: dice99 ? parseInt(dice99) : 0,
            critical99: critical99 ? parseInt(critical99) : 10,
            attack99: attack99 || '',
            effectList100: effectList100 || '',
            content100: content100 || '',
            dice100: dice100 ? parseInt(dice100) : 0,
            critical100: critical100 ? parseInt(critical100) : 10,
            attack100: attack100 || '',
          });
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(`✅ 캐릭터 데이터 읽기 완료: ${characterData.characterName} (${elapsed}ms)`);
      console.log(`   - 로이스: ${characterData.lois.length}개 | 콤보: ${characterData.combos.length}개`);
      console.log(`   - 무기: ${characterData.weapons.length}개 | 이펙트: ${characterData.effects.length}개`);

      return characterData;

    } catch (error) {
      console.error('캐릭터 데이터 읽기 실패:', error);
      throw error;
    }
  }

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

  isInitialized() {
    return this.initialized;
  }
}

module.exports = new SheetsClient();