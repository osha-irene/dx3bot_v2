/**
 * DX3bot - Double Cross 3rd Edition TRPG Discord Bot
 * Google Sheets 연동 지원
 */

const { Client, GatewayIntentBits, Events } = require('discord.js');
const config = require('./config/config');
const Database = require('./lib/database');
const SheetsClient = require('./lib/sheetsClient');
const CommandHandler = require('./lib/commandHandler');
const SlashCommandHandler = require('./lib/slashCommandHandler');

// 디스코드 클라이언트 초기화
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// 데이터베이스 초기화
const database = new Database();

// Google Sheets 클라이언트 초기화
let sheetsClient = null;
if (config.googleSheets.enabled) {
  sheetsClient = SheetsClient;  // 이미 싱글톤 인스턴스
  sheetsClient.initialize().then(success => {
    if (!success) {
      console.warn('⚠️ Google Sheets 연동을 사용하지 않습니다.');
      sheetsClient = null;
    }
  });
} else {
  console.log('ℹ️ Google Sheets 기능이 비활성화되어 있습니다.');
}

// 명령어 핸들러 초기화
const commandHandler = new CommandHandler(database, sheetsClient, client);

// 슬래시 커맨드 핸들러 초기화
const slashCommandHandler = new SlashCommandHandler(
  database, 
  sheetsClient, 
  commandHandler.characterCmd,
  commandHandler.sheetCmd,
  commandHandler.combatCmd,
  commandHandler.loisCmd
);

// 봇 준비 이벤트
client.once(Events.ClientReady, readyClient => {
  console.log('✅ 봇이 준비되었습니다!');
  console.log(`📛 로그인: ${readyClient.user.tag}`);
  console.log(`🎮 서버 수: ${readyClient.guilds.cache.size}개`);
  
  const version = database.getVersion();
  console.log(`📌 버전: v${version.major}.${version.minor}.${version.patch}`);
  
  if (sheetsClient) {
    console.log('📊 Google Sheets 연동: 활성화');
  } else {
    console.log('📁 데이터 저장: JSON 파일');
  }
});

// 새 멤버 입장 이벤트
client.on(Events.GuildMemberAdd, async (member) => {
  const channel = member.guild.channels.cache.find(ch => ch.name === 'data' && ch.isTextBased());
  if (!channel) return;

  channel.send(
    `안녕하세요, ${member.user.tag}님! 서버에 오신 것을 환영합니다. 😄\n\n` +
    `이 봇을 사용하려면 \`!도움\` 명령어를 입력하여 사용법을 확인하세요.\n\n` +
    `📊 **Google Sheets 연동**을 지원합니다!\n` +
    `자신의 캐릭터 시트를 봇에 연동하면 자동으로 업데이트됩니다.\n` +
    `자세한 내용은 \`GOOGLE_SHEETS_SETUP.md\`를 참고하세요.`
  );
});

// 메시지 이벤트
client.on(Events.MessageCreate, async (message) => {
  // 봇 메시지 무시
  if (message.author.bot) {
    // 주사위 봇 결과 처리
    await commandHandler.handleDiceResult(message);
    return;
  }

  // DM 무시
  if (!message.guild) return;

  // 명령어 처리
  await commandHandler.handle(message);
});

// 버튼 인터랙션 처리
client.on(Events.InteractionCreate, async (interaction) => {
  // 슬래시 커맨드 처리
  if (interaction.isChatInputCommand()) {
    return await slashCommandHandler.handle(interaction);
  }
  
  if (!interaction.isButton()) return;

  // 콤보 주사위 굴림
  if (interaction.customId.startsWith('combo_roll_')) {
    const [, , userId, skill, bonusDice, critical] = interaction.customId.split('_');
    
    // 권한 확인
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ 다른 사람의 콤보입니다!', ephemeral: true });
    }

    try {
      const activeChar = await commandHandler.combatCmd.getActiveCharacterData(interaction);
      if (!activeChar) {
        return interaction.reply({ content: '❌ 활성 캐릭터가 없습니다.', ephemeral: true });
      }

      const characterData = activeChar.data;
      
      // 기능 → 상위 능력치 매핑
      const skillToMain = {
        '백병': '육체',
        '회피': '육체',
        '사격': '감각',
        '지각': '감각',
        'RC': '정신',
        '의지': '정신',
        '교섭': '사회',
        '조달': '사회'
      };
      
      let mainAttr = skillToMain[skill] || '육체';
      
      // 동적 기능 처리 (운전:, 정보: 등)
      if (skill.includes(':')) {
        const prefix = skill.split(':')[0];
        const dynamicMapping = {
          '운전': '육체',
          '예술': '감각',
          '지식': '정신',
          '정보': '사회'
        };
        mainAttr = dynamicMapping[prefix] || '육체';
      }

      const mainValue = characterData[mainAttr] || 0;
      const skillValue = characterData[skill] || 0;
      const erosionD = characterData.침식D || 0;
      const bonusDiceNum = parseInt(bonusDice) || 0;

      const totalDice = mainValue + erosionD + bonusDiceNum;
      const diceFormula = `${totalDice}dx${critical}+${skillValue}`;

      // 버튼 비활성화
      await interaction.update({ components: [] });

      // 주사위 메시지 전송
      return await interaction.channel.send(`${diceFormula} ${skill} 판정 <@${userId}>`);

    } catch (error) {
      console.error('콤보 주사위 굴림 오류:', error);
      return interaction.reply({ content: '❌ 주사위를 굴리는 중 오류가 발생했습니다.', ephemeral: true });
    }
  }

  // 취소 버튼
  if (interaction.customId === 'combo_cancel') {
    return await interaction.update({ components: [] });
  }
});

// 전역 오류 처리
client.on('error', async (error) => {
  console.error('🚨 [봇 오류]:', error);
  
  if (config.discord.botOwnerId) {
    try {
      const owner = await client.users.fetch(config.discord.botOwnerId);
      if (owner) {
        await owner.send(`🚨 **DX3bot 오류 발생!**\n\`\`\`${error.stack || error.message}\`\`\``);
      }
    } catch (dmError) {
      console.error('❌ 봇 소유자 DM 전송 실패:', dmError.message);
    }
  }
});

// Unhandled Promise Rejection 처리
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Uncaught Exception 처리
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// 정상 종료 처리
process.on('SIGINT', () => {
  console.log('✅ 봇이 정상적으로 종료됩니다...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('✅ 봇이 정상적으로 종료됩니다...');
  client.destroy();
  process.exit(0);
});

// 봇 로그인
console.log('🚀 DX3bot 시작 중...');
client.login(config.discord.token)
  .then(() => {
    console.log('✅ 디스코드 로그인 성공!');
  })
  .catch((error) => {
    console.error('❌ 봇 로그인 실패:', error);
    process.exit(1);
  });
