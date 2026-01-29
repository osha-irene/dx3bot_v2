/**
 * 슬래시 커맨드 삭제 스크립트
 * 
 * 사용법: node deleteCommands.js [옵션]
 * 
 * 옵션:
 *   global - 전역 명령어 삭제
 *   guild  - 특정 서버 명령어 삭제
 *   all    - 둘 다 삭제
 */

const { REST, Routes } = require('discord.js');
require('dotenv').config();

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || '1335664025521881141';  // 서버 ID

if (!TOKEN || !CLIENT_ID) {
  console.error('❌ DISCORD_BOT_TOKEN 또는 CLIENT_ID가 .env에 없습니다!');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

const option = process.argv[2] || 'all';

(async () => {
  try {
    if (option === 'global' || option === 'all') {
      console.log('🗑️ 전역 슬래시 커맨드 삭제 중...');
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
      console.log('✅ 전역 명령어 삭제 완료!');
    }

    if (option === 'guild' || option === 'all') {
      console.log(`🗑️ 서버(${GUILD_ID}) 슬래시 커맨드 삭제 중...`);
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
      console.log('✅ 서버 명령어 삭제 완료!');
    }

    console.log('');
    console.log('💡 이제 원하는 방식으로 다시 등록하세요:');
    console.log('   node registerCommands.js');

  } catch (error) {
    console.error('❌ 삭제 실패:', error);
  }
})();
