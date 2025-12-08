/**
 * 설정 관리 모듈
 */

require('dotenv').config();

// 환경 변수 검증
const requiredEnvVars = ['DISCORD_BOT_TOKEN'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`❌ 필수 환경 변수가 설정되지 않았습니다: ${missingEnvVars.join(', ')}`);
  console.error('💡 .env 파일을 확인하거나 .env.example을 참고하세요.');
  process.exit(1);
}

// Google Sheets 인증 확인
const hasGoogleAuth = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
if (!hasGoogleAuth) {
  console.warn('⚠️ Google Sheets 인증 정보가 없습니다. 시트 연동 기능이 비활성화됩니다.');
  console.warn('💡 GOOGLE_SHEETS_SETUP.md를 참고하여 설정하세요.');
}

module.exports = {
  // Discord 설정
  discord: {
    token: process.env.DISCORD_BOT_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID || null,
    botOwnerId: process.env.BOT_OWNER_ID || null
  },

  // Google Sheets 설정
  googleSheets: {
    enabled: hasGoogleAuth,
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
    credentialsJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || null
  },

  // 봇 설정
  bot: {
    commandPrefix: '!',
    defaultErosionD: 0
  },

  // 침식률 임계값
  erosionThresholds: [
    { erosion: 190, d: 5 },
    { erosion: 130, d: 4 },
    { erosion: 100, d: 3 },
    { erosion: 80, d: 2 },
    { erosion: 60, d: 1 },
    { erosion: 0, d: 0 }
  ],

  // 신드롬 한영 변환
  syndromeTranslation: {
    "엔젤 헤일로": "ANGEL HALO",
    "발로르": "BALOR",
    "블랙독": "BLACK DOG",
    "브람스토커": "BRAM STOKER",
    "키마이라": "CHIMAERA",
    "엑자일": "EXILE",
    "하누만": "HANUMAN",
    "모르페우스": "MORPHEUS",
    "노이만": "NEUMANN",
    "오르쿠스": "ORCUS",
    "샐러맨더": "SALAMANDRA",
    "솔라리스": "SOLARIS",
    "우로보로스": "OUROBOROS",
    "아자토스": "AZATHOTH",
    "미스틸테인": "MISTILTEN",
    "글레이프닐": "GLEIPNIR"
  },

  // 능력치 매핑
  mainAttributes: ['육체', '감각', '정신', '사회'],
  
  subToMainMapping: {
    '백병': '육체',
    '회피': '육체',
    '사격': '감각',
    '지각': '감각',
    'RC': '정신',
    '의지': '정신',
    '교섭': '사회',
    '조달': '사회'
  },

  dynamicMappingRules: {
    '운전:': '육체',
    '정보:': '사회',
    '예술:': '감각',
    '지식:': '정신'
  }
};