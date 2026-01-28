/**
 * 캐릭터 목록 조회 모듈
 */

const { formatError, formatSuccess } = require('../../utils/helpers');

class CharacterListModule {
  constructor(database) {
    this.db = database;
  }

  /**
   * 내 캐릭터 목록
   */
  async listMyCharacters(message) {
    const serverId = message.guild.id;
    const userId = message.author.id;

    const characters = this.db.getUserCharacters(serverId, userId);
    
    if (!characters || Object.keys(characters).length === 0) {
      return message.channel.send('📋 등록된 캐릭터가 없습니다.\n`!시트등록 [URL]`로 시트를 등록하거나\n`!시트입력 "캐릭터 이름" [항목] [값]`으로 캐릭터를 만들어보세요!');
    }

    const activeCharName = this.db.getActiveCharacter(serverId, userId);
    let response = `📋 **${message.author.tag}님의 캐릭터 목록**\n\n`;

    for (const [charName, charData] of Object.entries(characters)) {
      const isActive = charName === activeCharName;
      const emoji = charData.emoji || '❌';
      const codeName = charData.codeName ? `「${charData.codeName}」` : '';
      const activeMarker = isActive ? '✅ ' : '　';
      
      response += `${activeMarker}${emoji}  **${charName}** ${codeName}\n`;
      
      if (charData.HP !== undefined || charData.침식률 !== undefined) {
        response += `-# 　　HP ${charData.HP || 0}  |  침식률 ${charData.침식률 || 0}\n`;
      }
    }

    response += `\n💡 **사용법**\n`;
    response += `-# • \`!지정 "캐릭터이름"\` - 캐릭터 활성화\n`;
    response += `-# • \`!시트확인\` - 활성 캐릭터 시트 확인\n`;
    response += `-# • \`!캐릭터삭제 "이름"\` - 캐릭터 삭제`;

    return message.channel.send(response);
  }

  /**
   * 서버 캐릭터 목록
   */
  async listServerCharacters(message) {
    const serverId = message.guild.id;
    const allUsers = this.db.getAllUsers(serverId);
    
    if (!allUsers || Object.keys(allUsers).length === 0) {
      return message.channel.send('📋 이 서버에는 등록된 캐릭터가 없습니다.');
    }

    let response = '📋  **서버 캐릭터 목록**\n\n';
    let totalCharacters = 0;

    for (const [uid, characters] of Object.entries(allUsers)) {
      // __statusPanel 같은 메타데이터 제외
      if (uid.startsWith('__')) continue;

      try {
        const member = await message.guild.members.fetch(uid).catch(() => null);
        const username = member ? member.user.tag : `User(${uid})`;

        response += `**${username}**\n`;

        for (const [charName, charData] of Object.entries(characters)) {
          const emoji = charData.emoji || '❌';
          const codeName = charData.codeName ? `「${charData.codeName}」` : '';
          
          response += `　${emoji}  ${charName} ${codeName}\n`;
          totalCharacters++;
        }

        response += '\n';
      } catch (error) {
        console.error(`유저 ${uid} 정보 가져오기 실패:`, error);
      }
    }

    response += `\n📊 **총 ${totalCharacters}명의 캐릭터**`;

    return message.channel.send(response);
  }

  /**
   * 콤보 확인
   */
  async checkCombos(message, getActiveCharacterData) {
    const activeChar = await getActiveCharacterData(message);
    
    if (!activeChar) {
      return message.reply(formatError('활성화된 캐릭터가 없습니다.'));
    }

    // ✅ DB에서 직접 시트 정보 확인
    const sheetInfo = this.db.getUserSheet(activeChar.serverId, activeChar.userId);

    if (!sheetInfo) {
      return message.reply(formatError('콤보 목록은 시트 연동 캐릭터만 사용할 수 있습니다. `!시트등록`을 먼저 해주세요.'));
    }

    const combos = activeChar.data.combos;
    
    if (!combos || combos.length === 0) {
      return message.channel.send(formatError('등록된 콤보가 없습니다.\n시트의 196~237행을 확인해주세요.'));
    }

    const emoji = activeChar.data.emoji || '⚔️';
    const currentErosion = activeChar.data.침식률 || 0;

    let response = `${emoji}  **${activeChar.name}의 콤보 목록** (침식률 ${currentErosion})\n\n`;

    for (let combo of combos) {
      if (typeof combo === 'string') {
        // 단순 문자열 콤보 (DB 저장)
        response += `ㆍ**${combo}**\n`;
      } else {
        // 객체 형태 콤보 (시트에서 읽음)
        response += `ㆍ**${combo.name}**\n`;
        
        // 기본 정보
        let info = [];
        if (combo.timing) info.push(combo.timing);
        if (combo.skill) info.push(combo.skill);
        if (combo.difficulty) info.push(combo.difficulty);
        if (combo.target && combo.target !== '-') info.push(combo.target);
        if (combo.range && combo.range !== '-') info.push(combo.range);
        if (combo.erosion) info.push(`침식 ${combo.erosion}`);
        
        if (info.length > 0) {
          response += `-# 　　${info.join(' | ')}\n`;
        }
        
        // 조건 확인
        const has99 = combo.effectList99 || combo.content99;
        const has100 = combo.effectList100 || combo.content100;
        
        if (currentErosion < 100 && has99) {
          response += `-# 　　99↓ 조건: ${combo.effectList99 || '활성'}\n`;
        } else if (currentErosion >= 100 && has100) {
          response += `-# 　　100↑ 조건: ${combo.effectList100 || '활성'}\n`;
        }
      }
    }

    response += `\n💡 콤보 사용: \`!@콤보이름\``;

    return message.channel.send(response);
  }
}

module.exports = CharacterListModule;