/**
 * 명령어 핸들러
 */

const SheetCommands = require('./commands/sheet');
const CharacterCommands = require('./commands/character');
const CombatCommands = require('./commands/combat');
const LoisCommands = require('./commands/lois');
const AdminCommands = require('./commands/admin');
const ForumCommands = require('./commands/forum');
const { extractName } = require('./utils/helpers');
const { EmbedBuilder } = require('discord.js');

class CommandHandler {
  constructor(database, sheetsClient, client) {
    this.db = database;
    this.sheets = sheetsClient;
    this.client = client;

    // 명령어 모듈 초기화
    this.forumCmd = new ForumCommands(database, client);
    this.sheetCmd = new SheetCommands(database, sheetsClient, this.forumCmd, client);
    this.charCmd = new CharacterCommands(database, sheetsClient, this.forumCmd);
    this.combatCmd = new CombatCommands(database, sheetsClient, this.charCmd);
    this.loisCmd = new LoisCommands(database, sheetsClient, this.charCmd);
    this.adminCmd = new AdminCommands(database, client);
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
      // 특수 명령어: !@콤보이름
      if (content.startsWith('!@')) {
        return await this.handleComboCall(message);
      }

      // 상태 변경 명령어: !HP+10, !침식률-5
      if (this.isStatCommand(content)) {
        return await this.handleStatChange(message);
      }

      // 콤보 설정 명령어
      if (content.startsWith('!콤보 ')) {
        return await this.handleComboSet(message);
      }

      // 일반 명령어 파싱
      const args = content.slice(1).split(' ');
      const command = args[0];
      const params = args.slice(1);

      // 이펙트 호출 체크 (한글로만 이루어진 명령어)
      const knownCommands = [
        '도움', '시트등록', '시트해제', '시트동기화', '시트푸시', '지정', '지정해제', 
        '시트입력', '시트확인', '캐릭터삭제', '내캐릭터', '서버캐릭터', '상태패널',
        '코드네임', '이모지', '컬러', '커버', '웍스', '브리드', '신드롬', '각성', '충동',
        '판정', '등침', '등장침식', '타이터스', '로이스', '로이스삭제', '리셋',
        '콤보', '콤보삭제', '콤보확인', '포럼설정', '포럼확인', '포럼해제', 'D로', '업데이트'
      ];
      
      if (!knownCommands.includes(command) && /^[가-힣:]+$/.test(command)) {
        // 한글로만 이루어진 명령어 = 이펙트 호출
        return await this.combatCmd.callEffect(message, command);
      }

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
      case '시트입력':
        return await this.charCmd.inputSheet(message, params);
      
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
      
      case 'D로':
        return await this.charCmd.setDLois(message, params);

      // 전투 명령어
      case '판정':
        return await this.combatCmd.roll(message, params);
      
      case '등침':
      case '등장침식':
        return await this.combatCmd.entryErosion(message);
      
      case '콤보삭제':
        return await this.combatCmd.deleteCombo(message, params);
      
      case '콤보확인':
        return await this.combatCmd.listCombos(message);

      // 로이스 명령어
      case '로이스':
        return await this.loisCmd.addLois(message, params);
      
      case '로이스삭제':
        return await this.loisCmd.deleteLois(message, params);
      
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
		// forum.js의 handleForum 함수를 호출합니다.
		return await this.forumCmd.handleForum(message, params);
	  
	  case '포럼확인':
		// forum.js에는 checkForumChannel이라는 이름으로 되어 있습니다.
		return await this.forumCmd.checkForumChannel(message);
	  
	  case '포럼해제':
		// forum.js에는 clearForumChannel이라는 이름으로 되어 있습니다.
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
   * 콤보 설정 처리
   */
  async handleComboSet(message) {
    const regex = /^!콤보\s+(?:"([^"]+)"|\[([^\]]+)\]|(\S+))\s+(\S+)\s+(.+)$/;
    const match = message.content.match(regex);

    if (!match) {
      return message.channel.send('❌ 사용법: `!콤보 ["콤보 이름"] [침식률조건] [콤보 데이터]`');
    }

    const comboName = match[1] || match[2] || match[3];
    const condition = match[4];
    const description = match[5];

    return await this.combatCmd.setCombo(message, comboName, condition, description);
  }

  /**
   * 콤보 호출 처리
   */
  async handleComboCall(message) {
    const match = message.content.match(/^!@\s*(["'\[].*?["'\]]|\S+)/);
    if (!match) return;

    const comboName = extractName(match[1]);
    return await this.combatCmd.callCombo(message, comboName);
  }

  /**
   * 도움말
   */
  async handleHelp(message) {
    const embed1 = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📖 DX3bot 명령어 목록 (1/4)')
      .setDescription('DX3bot의 주요 기능을 안내합니다.')
      .addFields(
        {
          name: '📋 **포럼 설정**',
          value: '> `!포럼설정 #채널` - 캐릭터 시트 포럼 채널 지정\n' +
                 '> `!포럼확인` - 현재 설정된 포럼 채널 확인\n' +
                 '> `!포럼해제` - 포럼 채널 설정 해제\n' +
                 '> 💡 포럼 설정 후 `!시트등록` 하면 자동으로 게시물 생성!'
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
          value: '> `!시트입력 "캐릭터 이름" [항목] [값]...` - 캐릭터 등록/수정\n' +
                 '> `!지정 "캐릭터 이름"` - 활성 캐릭터 설정\n' +
                 '> `!지정해제` - 활성 캐릭터 해제\n' +
                 '> `!시트확인` - 캐릭터 정보 표시\n' +
                 '> `!내캐릭터` - 내 캐릭터 목록 확인\n' +
                 '> `!서버캐릭터` - 서버 전체 캐릭터 목록'
        },
        {
          name: '📌 **상태 변경**',
          value: '> `!침식률+N`, `!HP-10`, `!능력치=5`\n' +
                 '> 특정 능력치 값을 증가/감소/설정합니다.\n' +
                 '> **예시:** `!침식률+5`, `!HP-10`, `!육체=4`'
        }
      );

    const embed2 = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📖 DX3bot 명령어 목록 (2/4)')
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
                 '> `!콤보 "콤보명" [조건] [설명]` - 콤보 저장\n' +
                 '> `!@"콤보명"` - 콤보 호출\n' +
                 '> `!콤보삭제 "콤보명"` - 콤보 삭제'
        },
        {
          name: '🔹 **로이스 & D로이스**',
          value: '> `!로이스 "이름" [P감정] [N감정] [내용]`\n' +
                 '> `!로이스삭제 "이름"`\n' +
                 '> `!타이터스 "이름"` - 로이스 → 타이터스 변환\n' +
                 '> `!D로` - 현재 D로이스 확인\n' +
                 '> `!D로 No. 번호 이름` - D로이스 설정 (시트 자동 업데이트)'
        }
      );

    const embed3 = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📖 DX3bot 명령어 목록 (3/4)')
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
                 '> 📋 `GOOGLE_SHEETS_SETUP.md`에서 설정 방법 확인\n' +
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