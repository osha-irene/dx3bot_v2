/**
 * 임베드 시트 확인 모듈
 */

const { EmbedBuilder } = require('discord.js');
const { convertSyndromeToEnglish } = require('../../utils/helpers');
const config = require('../../config/config');

class EmbedSheetModule {
  /**
   * 임베드로 캐릭터 시트 표시
   */
  static async displaySheet(activeChar) {
    const characterData = activeChar.data;
    const characterCodeName = characterData.codeName || '코드네임 없음';
    const characterEmoji = characterData.emoji || '❌';

    // 로이스 배열 확인
    if (!Array.isArray(characterData.lois)) {
      characterData.lois = [];
    }

    // 브리드 타입 결정
    let breedType = "브리드 없음";
    if (characterData.breed) {
      const breed = characterData.breed.toLowerCase();
      if (breed === "퓨어" || breed === "pure") breedType = "PURE";
      else if (breed === "크로스" || breed === "cross") breedType = "CROSS";
      else if (breed === "트라이" || breed === "tri") breedType = "TRI";
    }

    // 신드롬 변환
    let syndromeList = characterData.syndromes ? characterData.syndromes.split(" × ") : ["신드롬 없음"];
    syndromeList = syndromeList.map(s => convertSyndromeToEnglish(s, config.syndromeTranslation));

    // 임베드 생성
    const embed = new EmbedBuilder()
      .setColor(0x00aaff)
      .setTitle(`${characterEmoji} ${activeChar.name} 「${characterCodeName}」`)
      .setDescription(
        `${characterData.cover || "커버 없음"} | ${characterData.works || "웍스 없음"}\n` +
        `${breedType} | ${syndromeList.join(" × ")}\n` +
        `${characterData.awakening || "각성 없음"} | ${characterData.impulse || "충동 없음"}`
      )
      .setTimestamp();

    // 기본 스탯
    embed.addFields({
      name: '📊 기본 정보',
      value: `💚 **HP:** ${characterData.HP || 0}  |  🔴 **침식률:** ${characterData.침식률 || 0}  |  ⚡ **침식D:** ${characterData.침식D || 0}\n` +
             `💙 **로이스:** ${characterData.lois.length}개  |  📝 **D-Lois:** No.${characterData.dloisNo || "00"} ${characterData.dloisName || "없음"}`,
      inline: false
    });

    // 능력치
    let statsText = '';
    for (let mainAttr of config.mainAttributes) {
      let subAttributes = [];
      let mainAttrValue = characterData[mainAttr] || 0;

      for (let [key, value] of Object.entries(characterData)) {
        if (config.subToMainMapping[key] === mainAttr) {
          subAttributes.push(`${key}: ${value}`);
        } else {
          for (let prefix in config.dynamicMappingRules) {
            if (key.startsWith(prefix) && config.dynamicMappingRules[prefix] === mainAttr) {
              subAttributes.push(`${key}: ${value}`);
            }
          }
        }
      }

      if (subAttributes.length > 0 || mainAttrValue !== 0) {
        statsText += `**【${mainAttr}】** ${mainAttrValue}\n${subAttributes.join(' • ')}\n\n`;
      }
    }

    if (statsText) {
      embed.addFields({
        name: '⚔️ 능력치',
        value: statsText,
        inline: false
      });
    }

    return embed;
  }

  /**
   * 콤보/로이스/장비 섹션 추가
   */
  static addDetailSections(embed, activeChar, combos) {
    const characterData = activeChar.data;

    // 콤보
    if (Object.keys(combos).length > 0) {
      const comboList = Object.keys(combos).map(name => `• **${name}**`).join('\n');
      embed.addFields({
        name: `⚔️ 콤보 (${Object.keys(combos).length}개)`,
        value: comboList.length > 1000 ? comboList.substring(0, 1000) + '...' : comboList,
        inline: true
      });
    }

    // 로이스
    if (characterData.lois && characterData.lois.length > 0) {
      const loisList = characterData.lois.map(lois => 
        `• **${lois.name}**\n  ${lois.pEmotion} / ${lois.nEmotion}`
      ).slice(0, 5).join('\n');
      
      embed.addFields({
        name: `💙 로이스 (${characterData.lois.length}개)`,
        value: loisList + (characterData.lois.length > 5 ? `\n... 외 ${characterData.lois.length - 5}개` : ''),
        inline: true
      });
    }

    // 메모리
    if (characterData.memory && characterData.memory.length > 0) {
      const memoryList = characterData.memory.map(mem => 
        `• **${mem.name}** (${mem.emotion})`
      ).join('\n');
      
      embed.addFields({
        name: `🧠 메모리 (${characterData.memory.length}개)`,
        value: memoryList.length > 1000 ? memoryList.substring(0, 1000) + '...' : memoryList,
        inline: false
      });
    }

    // 무기
    if (characterData.weapons && characterData.weapons.length > 0) {
      const weaponList = characterData.weapons.map(weapon => 
        `• **${weapon.name}** (${weapon.type || '무기'})\n` +
        `  명중: ${weapon.accuracy || '-'} | 공격: ${weapon.attack || '-'} | 가드: ${weapon.guard || '-'}`
      ).slice(0, 3).join('\n');
      
      embed.addFields({
        name: `⚔️ 무기 (${characterData.weapons.length}개)`,
        value: weaponList + (characterData.weapons.length > 3 ? `\n... 외 ${characterData.weapons.length - 3}개` : ''),
        inline: false
      });
    }

    // 방어구
    if (characterData.armor && characterData.armor.length > 0) {
      const armorList = characterData.armor.map(armor => 
        `• **${armor.name}** (${armor.type || '방어구'})\n` +
        `  닷지: ${armor.dodge || '-'} | 행동: ${armor.action || '-'} | 장갑: ${armor.defense || '-'}`
      ).slice(0, 3).join('\n');
      
      embed.addFields({
        name: `🛡️ 방어구 (${characterData.armor.length}개)`,
        value: armorList + (characterData.armor.length > 3 ? `\n... 외 ${characterData.armor.length - 3}개` : ''),
        inline: false
      });
    }

    // 비클
    if (characterData.vehicles && characterData.vehicles.length > 0) {
      const vehicleList = characterData.vehicles.map(vehicle => 
        `• **${vehicle.name}** (${vehicle.type || '비클'})`
      ).join('\n');
      
      embed.addFields({
        name: `🚗 비클 (${characterData.vehicles.length}개)`,
        value: vehicleList,
        inline: false
      });
    }

    // 아이템
    if (characterData.items && characterData.items.length > 0) {
      const itemList = characterData.items.map(item => 
        `• **${item.name}** ${item.type ? `(${item.type})` : ''}`
      ).slice(0, 10).join('\n');
      
      embed.addFields({
        name: `🎒 아이템 (${characterData.items.length}개)`,
        value: itemList + (characterData.items.length > 10 ? `\n... 외 ${characterData.items.length - 10}개` : ''),
        inline: false
      });
    }

    // 시트 연동 상태
    if (activeChar.fromSheet) {
      embed.setFooter({ 
        text: `📊 Google Sheets 연동 중${activeChar.sheetName ? ` (탭: ${activeChar.sheetName})` : ''}` 
      });
    }

    return embed;
  }
}

module.exports = EmbedSheetModule;