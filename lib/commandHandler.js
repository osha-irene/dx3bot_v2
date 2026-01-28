/**
 * 명령어 핸들러
 * 
 * ❌ 제거된 명령어 (시트 동기화로 대체):
 *    - !시트입력 → 시트에서 직접 편집
 *    - !콤보 → 시트에서 자동 읽기
 *    - !콤보삭제 → 시트에서 직접 삭제
 *    - !D로 → 시트에서 자동 읽기
 *    - !로이스 → 시트에서 자동 읽기
 *    - !로이스삭제 → 시트에서 직접 삭제
 * 
 * ✅ 유지된 명령어:
 *    - !타이터스 → 게임 중 실시간 변환 필요
 *    - !콤보확인 → 읽기 전용 조회
 *    - !@콤보명 → 콤보/이펙트 호출
 */

const SheetCommands = require('../commands/sheet');
const CharacterCommands = require('../commands/character');
const CombatCommands = require('../commands/combat');
const LoisCommands = require('../commands/lois');
const AdminCommands = require('../commands/admin');
const ForumCommands = require('../commands/forum');
const { extractName } = require('../utils/helpers');
const { EmbedBuilder } = require('discord.js');
const { formatError } = require('../utils/helpers');

class CommandHandler {
  constructor(database, sheetsClient, client) {
    this.db = database;
    this.sheets = sheetsClient;
    this.client = client;

    // 명령어 모듈 초기화
    this.forumCmd = new ForumCommands(database, client);
    this.sheetCmd = new SheetCommands(database, sheetsClient, this.forumCmd, client);
    this.charCmd = new CharacterCommands(database, sheetsClient, this.forumCmd, client);
    this.combatCmd = new CombatCommands(database, sheetsClient, this.charCmd);
    this.loisCmd = new LoisCommands(database, sheetsClient, this.charCmd);
    this.adminCmd = new AdminCommands(database, client);

    // 순환 참조 해결을 위해 characterCmd를 명시적으로 전달
    this.charCmd.characterCmd = this.charCmd;
    this.combatCmd.characterCmd = this.charCmd;
  }

  /**
   * 명령어 처리
   */
  async handle(message) {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content.startsWith('!')) return;

    const content = message.content.trim();

    try {
      // 🔥 특수 명령어: !@이름 (콤보 또는 이펙트)
      if (content.startsWith('!@')) {
        return await this.handleComboCall(message);
      }

      // 상태 변경 명령어: !HP+10, !침식률-5
      if (this.isStatCommand(content)) {
        return await this.handleStatChange(message);
      }

      // 일반 명령어 파싱
      const args = content.slice(1).split(' ');
      const command = args[0];
      const params = args.slice(1);
      
      await this.routeCommand(message, command, params);
    } catch (error) {
      console.error('명령어 처리 오류:', error);
      message.channel.send(`❌ 명령어 처리 중 오류가 발생했습니다: ${error.message}`);
    }
  }

  /**
   * 명령어 라우팅
   */
  async routeCommand(message, command, params) {
    const content = message.content.trim();
    
    // !@"이름" 형식 처리 (무기/방어구/비클/아이템/콤보 개별 호출)
    if (content.startsWith('!@')) {
      const match = content.match(/^!@\s*["'[]?(.+?)["']]?$/);
      if (match) {
        const itemName = match[1].trim();
        return await this.charCmd.handleAtCall(message, itemName);
      }
    }

    switch (command) {
      // 도움말
      case '도움':
        return await this.handleHelp(message);

      // 시트 명령어
      case '시트등록':
        return await this.sheetCmd.register(message, params);
      
      case '시트해제':
        return await this.sheetCmd.unregister(message);
      
      case '시트동기화':
        return await this.sheetCmd.sync(message);
      
      case '시트푸시':
        return await this.sheetCmd.push(message);

      // 캐릭터 명령어
      case '지정':
        return await this.charCmd.setActive(message, params);
      
      case '지정해제':
        return await this.charCmd.unsetActive(message);
      
      case '시트확인':
        return await this.charCmd.checkSheet(message);
      
      case '내캐릭터':
        return await this.charCmd.listMyCharacters(message);
      
      case '서버캐릭터':
        return await this.charCmd.listServerCharacters(message);
      
      case '캐릭터삭제':
        return await this.charCmd.deleteCharacter(message, params);
      
      case '상태패널':
        return await this.charCmd.statusPanel(message);

      // 캐릭터 속성 설정
      case '인장':
        return await this.charCmd.handleSetCharacterImage(message, params);

      case '코드네임':
        return await this.charCmd.setCodeName(message, params);
      
      case '이모지':
        return await this.charCmd.setEmoji(message, params);
      
      case '컬러':
        return await this.charCmd.setColor(message, params);
      
      case '커버':
        return await this.charCmd.setCover(message, params);
      
      case '웍스':
        return await this.charCmd.setWorks(message, params);
      
      case '브리드':
        return await this.charCmd.setBreed(message, params);
      
      case '신드롬':
        return await this.charCmd.setSyndrome(message, params);
      
      case '각성':
        return await this.charCmd.setAwakening(message, params);
      
      case '충동':
        return await this.charCmd.setImpulse(message, params);

      // 전투 명령어
      case '판정':
        return await this.combatCmd.roll(message, params);
      
      case '등침':
      case '등장침식':
        return await this.combatCmd.entryErosion(message);

      // 로이스 명령어
      case '로이스':
        return await this.loisCmd.addLois(message, params);
      
      case '타이터스':
        return await this.loisCmd.convertToTitus(message, params);

      // 관리 명령어
      case '리셋':
        return await this.adminCmd.reset(message, params);
      
      case '업데이트':
        return await this.adminCmd.update(message, params);

      // 포럼 명령어
      case '포럼':
      case '포럼설정':
        return await this.forumCmd.handleForum(message, params);
      
      case '포럼확인':
        return await this.forumCmd.checkForumChannel(message);
      
      case '포럼해제':
        return await this.forumCmd.clearForumChannel(message);

      default:
        // 알 수 없는 명령어
        return message.channel.send(`❌ 알 수 없는 명령어입니다: \`!${command}\`\n\`!도움\` 명령어로 사용법을 확인하세요.`);
    }
  }

  /**
   * 상태 변경 명령어 체크
   */
  isStatCommand(content) {
    return content.match(/^!([가-힣A-Za-z]+)([+=\-]\d+)$/);
  }

  /**
   * 상태 변경 처리
   */
  async handleStatChange(message) {
    const statMatch = message.content.match(/^!([가-힣A-Za-z]+)([+=\-])(\d+)$/);
    if (!statMatch) return;

    const statName = statMatch[1];
    const operator = statMatch[2];
    const value = parseInt(statMatch[3]);

    return await this.combatCmd.updateStat(message, statName, operator, value);
  }

  /**
   * 콤보/이펙트 호출 처리
   * !@ 뒤의 모든 텍스트를 이름으로 인식
   */
  async handleComboCall(message) {
    // !@ 뒤의 모든 내용을 이름으로 추출 (따옴표, 대괄호 제거)
    const content = message.content.trim();
    const nameMatch = content.match(/^!@\s*(.+)$/);
    
    if (!nameMatch) return;
    
    let name = nameMatch[1].trim();
    
    // 따옴표나 대괄호 제거
    name = name.replace(/^["'\[]+|["'\]]+$/g, '');
    
    console.log(`🎯 [CALL] !@ 호출: "${name}"`);
    
    const activeChar = await this.combatCmd.getActiveCharacterData(message);
    if (!activeChar) {
      return message.reply(formatError('활성화된 캐릭터가 없습니다. `!지정 ["캐릭터 이름"]` 명령어로 캐릭터를 지정해주세요.'));
    }
    
    // 1️⃣ 시트에서 읽은 콤보 확인 (activeChar.data.combos)
    const combos = activeChar.data.combos || [];
    
    // 띄어쓰기 무시하고 검색
    const normalizedInput = name.replace(/\s+/g, '');
    const combo = combos.find(c => 
      c.name && c.name.replace(/\s+/g, '') === normalizedInput
    );
    
    if (combo) {
      console.log(`✅ [CALL] 콤보 발견: ${combo.name}`);
      return await this.combatCmd.callCombo(message, combo.name);
    }
    
    // 2️⃣ 콤보가 없으면 이펙트 확인 (시트 연동 필요)
    const sheetInfo = this.db.getUserSheet(activeChar.serverId, activeChar.userId);
    
    if (!sheetInfo || !this.sheets) {
      return message.channel.send(formatError(`"${name}"을(를) 찾을 수 없습니다.\n콤보: 등록되지 않음\n이펙트: 시트 연동 필요`));
    }
    
    try {
      // 시트에서 이펙트 확인
      const characterData = await this.sheets.readFullCharacter(sheetInfo.spreadsheetId, sheetInfo.sheetName);
      
      if (characterData && characterData.effects && characterData.effects.length > 0) {
        const effect = characterData.effects.find(e => 
          e.name.replace(/\s+/g, '') === normalizedInput
        );
        
        if (effect) {
          console.log(`✅ [CALL] 이펙트 발견: ${effect.name}`);
          return await this.combatCmd.callEffect(message, name);
        }
      }
      
      // 3️⃣ 둘 다 없으면 오류
      return message.channel.send(formatError(`"${name}"을(를) 찾을 수 없습니다.\n\`!콤보확인\`으로 등록된 콤보를 확인하거나\n시트의 164~193행에서 이펙트를 확인하세요.`));
      
    } catch (error) {
      console.error('!@ 호출 오류:', error);
      return message.channel.send(formatError(`"${name}"을(를) 확인하는 중 오류가 발생했습니다.`));
    }
  }

  /**
   * 도움말
   */
  async handleHelp(message) {
    const embed1 = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📖 DX3bot 명령어 목록 (1/3)')
      .setDescription('💡 **시트 중심 워크플로우**: 모든 데이터는 Google Sheets에서 관리됩니다!')
      .addFields(
        {
          name: '📋 **시작하기**',
          value: '> 1️⃣ `!포럼설정 #채널` - 캐릭터 시트 포럼 채널 지정\n' +
                 '> 2️⃣ `!시트등록 [URL]` - 자신의 시트를 봇에 등록\n' +
                 '> 3️⃣ `!지정 "캐릭터 이름"` - 활성 캐릭터 설정\n' +
                 '> 💡 이제 플레이 준비 완료!'
        },
        {
          name: '📊 **Google Sheets 연동**',
          value: '> `!시트등록 [URL]` - 자신의 시트를 봇에 등록\n' +
                 '> `!시트동기화` - 시트 → 봇으로 데이터 가져오기\n' +
                 '> `!시트푸시` - 봇 → 시트로 데이터 업로드\n' +
                 '> `!시트해제` - 시트 연동 해제'
        },
        {
          name: '📌 **캐릭터 관리**',
          value: '> `!지정 "캐릭터 이름"` - 활성 캐릭터 설정\n' +
                 '> `!지정해제` - 활성 캐릭터 해제\n' +
                 '> `!시트확인` - 캐릭터 정보 표시\n' +
                 '> `!내캐릭터` - 내 캐릭터 목록 확인\n' +
                 '> `!서버캐릭터` - 서버 전체 캐릭터 목록'
        },
        {
          name: '📌 **상태 변경**',
          value: '> `!침식률+N`, `!HP-10`, `!능력치=5`\n' +
                 '> 특정 능력치 값을 증가/감소/설정합니다.\n' +
                 '> **예시:** `!침식률+5`, `!HP-10`, `!육체=4`\n' +
                 '> 💡 HP/침식률 변경 시 시트도 자동 업데이트!'
        }
      );

    const embed2 = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📖 DX3bot 명령어 목록 (2/3)')
      .addFields(
        {
          name: '🎲 **판정 시스템**',
          value: '> `!판정 [항목]` - 능력 판정\n' +
                 '> 침식D가 자동 적용됩니다.\n' +
                 '> **예시:** `!판정 백병`, `!판정 정보:컴퓨터`'
        },
        {
          name: '⚔ **전투**',
          value: '> `!등침`, `!등장침식` - 등장 시 1d10 침식률 추가\n' +
                 '> `!@"콤보명"` - 콤보 호출 (시트에서 자동 읽기)\n' +
                 '> `!@"이펙트명"` - 이펙트 호출'
        },
        {
          name: '🔹 **로이스 & 타이터스**',
          value: '> `!로이스 "이름" P감정 N감정 내용` - 로이스 추가\n' +
                 '> `!타이터스 "이름"` - 로이스 → 타이터스 변환\n' +
                 '> 💡 로이스 삭제는 시트에서 직접 수정하세요!'
        }
      );

    const embed3 = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📖 DX3bot 명령어 목록 (3/3)')
      .addFields(
        {
          name: '🔧 **관리**',
          value: '> `!리셋` - 모든 데이터 초기화\n' +
                 '> `!리셋 콤보/로이스/이펙트` - 특정 데이터만 초기화\n' +
                 '> `!캐릭터삭제 "이름"` - 캐릭터 삭제'
        },
        {
          name: '💡 **팁**',
          value: '> 📊 **Google Sheets 연동**으로 시트가 자동 업데이트됩니다!\n' +
                 '> 🎯 PbP 플레이에 최적화된 봇입니다'
        }
      )
      .setFooter({ text: '📌 문의: @TRPG_sha' });

    await message.channel.send({ embeds: [embed1] });
    await message.channel.send({ embeds: [embed2] });
    await message.channel.send({ embeds: [embed3] });
  }

  /**
   * 주사위 봇 결과 처리
   */
  async handleDiceResult(message) {
    return await this.combatCmd.handleDiceResult(message);
  }
}

module.exports = CommandHandler;
