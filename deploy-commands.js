/**
 * Discord 슬래시 커맨드 등록 스크립트
 */

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('./config');

const commands = [
  // 시트 관리
  new SlashCommandBuilder()
    .setName('시트등록')
    .setDescription('Google Sheets 캐릭터 시트를 봇에 연동합니다')
    .addStringOption(option =>
      option.setName('url')
        .setDescription('Google Sheets URL')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('시트동기화')
    .setDescription('시트와 봇 데이터를 동기화합니다'),
  
  new SlashCommandBuilder()
    .setName('지정')
    .setDescription('활성 캐릭터를 지정합니다')
    .addStringOption(option =>
      option.setName('캐릭터이름')
        .setDescription('활성화할 캐릭터 이름')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('지정해제')
    .setDescription('활성 캐릭터 지정을 해제합니다'),
  
  new SlashCommandBuilder()
    .setName('시트확인')
    .setDescription('현재 활성 캐릭터의 시트를 포럼에 표시합니다'),
  
  // 캐릭터 설정
  new SlashCommandBuilder()
    .setName('이모지')
    .setDescription('캐릭터 이모지를 설정합니다')
    .addStringOption(option =>
      option.setName('이모지')
        .setDescription('설정할 이모지')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('캐릭터삭제')
    .setDescription('캐릭터를 삭제합니다')
    .addStringOption(option =>
      option.setName('이름')
        .setDescription('삭제할 캐릭터 이름')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('리셋')
    .setDescription('캐릭터 데이터를 초기화합니다')
    .addStringOption(option =>
      option.setName('항목')
        .setDescription('초기화할 항목 (비워두면 전체 초기화)')
        .setRequired(false)
        .addChoices(
          { name: '전체', value: '전체' },
          { name: '로이스', value: '로이스' },
          { name: '이펙트', value: '이펙트' }
        )
    ),
  
  // 로이스
  new SlashCommandBuilder()
    .setName('로이스')
    .setDescription('로이스를 추가합니다')
    .addStringOption(option =>
      option.setName('이름')
        .setDescription('로이스 대상 이름')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('p감정')
        .setDescription('포지티브 감정 (끝에 *를 붙이면 강조)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('n감정')
        .setDescription('네거티브 감정 (끝에 *를 붙이면 강조)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('내용')
        .setDescription('로이스 설명')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('타이터스')
    .setDescription('로이스를 타이터스로 변환합니다 (침식률 +5)')
    .addStringOption(option =>
      option.setName('이름')
        .setDescription('타이터스로 변환할 로이스 이름')
        .setRequired(true)
    ),
  
  // 도움말
  new SlashCommandBuilder()
    .setName('도움')
    .setDescription('DX3bot 사용법을 확인합니다'),
  
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(config.discord.token);

(async () => {
  try {
    console.log(`🔄 ${commands.length}개의 슬래시 커맨드를 등록 중...`);

    const data = await rest.put(
      Routes.applicationCommands(config.discord.clientId),
      { body: commands },
    );

    console.log(`✅ ${data.length}개의 슬래시 커맨드가 등록되었습니다!`);
    console.log('\n등록된 커맨드:');
    data.forEach(cmd => console.log(`  /${cmd.name}`));
  } catch (error) {
    console.error('❌ 슬래시 커맨드 등록 실패:', error);
  }
})();
