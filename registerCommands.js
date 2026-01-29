/**
 * 슬래시 커맨드 등록 스크립트
 * 
 * 사용법: node registerCommands.js
 * 
 * 명령어 설명을 수정하려면 아래 commands 배열에서 description을 변경하세요.
 */

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

// 환경 변수 확인
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;  // 봇의 Application ID

if (!TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN이 .env에 없습니다!');
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error('❌ CLIENT_ID가 .env에 없습니다!');
  console.log('💡 Discord Developer Portal에서 봇의 Application ID를 복사해서 .env에 추가하세요:');
  console.log('   CLIENT_ID=여기에_Application_ID_입력');
  process.exit(1);
}

// ============================================
// 슬래시 커맨드 정의
// ============================================

const commands = [
  // 📊 시트 관리
  new SlashCommandBuilder()
    .setName('시트등록')
    .setDescription('Google Sheets 캐릭터 시트를 등록합니다')
    .addStringOption(option =>
      option.setName('url')
        .setDescription('Google Sheets URL')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('탭이름')
        .setDescription('사용할 탭 이름 (여러 탭이 있는 경우)')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('시트동기화')
    .setDescription('시트 데이터를 봇으로 동기화합니다 (시트 → 봇)'),

  new SlashCommandBuilder()
    .setName('시트푸시')
    .setDescription('봇 데이터를 시트로 업로드합니다 (봇 → 시트)'),

  new SlashCommandBuilder()
    .setName('시트해제')
    .setDescription('시트 연동을 해제합니다'),

  // 👤 캐릭터 관리
  new SlashCommandBuilder()
    .setName('지정')
    .setDescription('사용할 캐릭터를 활성화합니다')
    .addStringOption(option =>
      option.setName('캐릭터이름')
        .setDescription('활성화할 캐릭터 이름')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('지정해제')
    .setDescription('현재 활성화된 캐릭터를 해제합니다'),

  new SlashCommandBuilder()
    .setName('시트확인')
    .setDescription('현재 캐릭터 시트를 확인하고 포럼을 업데이트합니다'),

  new SlashCommandBuilder()
    .setName('내캐릭터')
    .setDescription('내가 등록한 캐릭터 목록을 확인합니다'),

  new SlashCommandBuilder()
    .setName('이모지')
    .setDescription('캐릭터 이모지를 설정합니다')
    .addStringOption(option =>
      option.setName('이모지')
        .setDescription('사용할 이모지')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('캐릭터삭제')
    .setDescription('캐릭터를 삭제합니다')
    .addStringOption(option =>
      option.setName('이름')
        .setDescription('삭제할 캐릭터 이름')
        .setRequired(true)),

  // 💔 로이스 관리
  new SlashCommandBuilder()
    .setName('로이스')
    .setDescription('새로운 로이스를 추가합니다')
    .addStringOption(option =>
      option.setName('이름')
        .setDescription('로이스 대상 이름')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('p감정')
        .setDescription('P감정 (메인 감정은 *를 붙이세요. 예: 호의*)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('n감정')
        .setDescription('N감정 (메인 감정은 *를 붙이세요. 예: 불안*)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('내용')
        .setDescription('로이스 설명')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('타이터스')
    .setDescription('로이스를 타이터스로 승화시킵니다')
    .addStringOption(option =>
      option.setName('이름')
        .setDescription('승화시킬 로이스 이름')
        .setRequired(true)),

  // 🔧 관리
  new SlashCommandBuilder()
    .setName('리셋')
    .setDescription('캐릭터 데이터를 초기화합니다')
    .addStringOption(option =>
      option.setName('항목')
        .setDescription('초기화할 항목')
        .setRequired(false)
        .addChoices(
          { name: '전체', value: '전체' },
          { name: '로이스', value: '로이스' },
          { name: '콤보', value: '콤보' },
          { name: '이펙트', value: '이펙트' }
        )),

  new SlashCommandBuilder()
    .setName('도움')
    .setDescription('DX3bot 사용 방법을 확인합니다'),
];

// ============================================
// 등록 실행
// ============================================

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('🔄 슬래시 커맨드 등록 중...');
    console.log(`📝 등록할 명령어: ${commands.length}개`);

/* 
const GUILD_ID = '1335664025521881141';  // 봇테스트용 서버 ID

const data = await rest.put(
  Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
  { body: commands.map(cmd => cmd.toJSON()) }
); */

  // 전역 등록 (모든 서버에 적용, 최대 1시간 소요)
    const data = await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands.map(cmd => cmd.toJSON()) }
    ); 

    console.log('');
    console.log('✅ 슬래시 커맨드 등록 완료!');
    console.log(`📊 등록된 명령어: ${data.length}개`);
    console.log('');
    console.log('💡 전역 등록은 Discord에 반영되기까지 최대 1시간 걸릴 수 있습니다.');
    console.log('   빠른 테스트를 원하면 특정 서버에만 등록하는 옵션을 사용하세요.');

  } catch (error) {
    console.error('❌ 등록 실패:', error);
  }
})();
