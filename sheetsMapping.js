/**
 * Google Sheets 셀 매핑
 * PbP 테스트 시트 구조에 맞춘 셀 위치 정의
 */

const SHEET_MAPPING = {
  // 기본 정보
  codeNameRuby: 'L7',      // 코드네임 루비문자
  codeName: 'L8',          // 코드네임
  characterNameRuby: 'W7', // 캐릭터 이름 원어 표기
  characterName: 'W8',     // 캐릭터 이름
  cover: 'Z10',            // 커버
  works: 'Z11',            // 웍스
  awakening: 'Z12',        // 각성
  impulse: 'Z13',          // 충동
  breed: 'B21',            // 브리드
  syndrome1: 'E21',        // 첫 번째 신드롬
  syndrome2: 'N21',        // 두 번째 신드롬
  syndromeOptional: 'W21', // 옵셔널 신드롬
  
  // 상태 정보
  HP: 'O16',               // HP
  erosion: 'S16',          // 침식률
  // 침식D는 침식률에 비례하여 자동 계산
  
  // 능력치 (합계 값)
  body: 'F33',             // 육체
  sense: 'N33',            // 감각
  mind: 'V33',             // 정신
  social: 'AD33',          // 사회
  
  // 세부 기능 (각 이름이 적힌 셀에서 3칸 떨어진 위치)
  // 예: 백병은 B36에 이름, H36에 값
  melee: 'H36',            // 백병
  dodge: 'H37',            // 회피
  shoot: 'P36',            // 사격
  perceive: 'P37',         // 지각
  RC: 'X36',               // RC
  will: 'X37',             // 의지
  negotiate: 'AF36',       // 교섭
  procure: 'AF37',         // 조달
  
  // 운전, 예술, 지식, 정보 (38-42행, 동일한 패턴)
  // 운전: B열, 예술: J열, 지식: R열, 정보: Z열
  driving: {
    startRow: 38,
    endRow: 42,
    nameCol: 'B',
    valueCol: 'H'
  },
  art: {
    startRow: 38,
    endRow: 42,
    nameCol: 'J',
    valueCol: 'P'
  },
  knowledge: {
    startRow: 38,
    endRow: 42,
    nameCol: 'R',
    valueCol: 'X'
  },
  info: {
    startRow: 38,
    endRow: 42,
    nameCol: 'Z',
    valueCol: 'AF'
  },
  
  // 로이스
  // 67~73행
  lois: {
    startRow: 67,
    endRow: 73,
    typeCol: 'B',          // D로이스 여부 확인
    nameCol: 'E',          // 로이스 이름
    positiveCol: 'L',      // P감정 (포지티브)
    negativeCol: 'Q',      // N감정 (네거티브)
    positiveCheckCol: 'K', // P감정 강조 체크
    negativeCheckCol: 'O', // N감정 강조 체크
    descCol: 'T',          // 해설/내용
    titusCol: 'AD'         // 타이터스 체크 (T)
  },
  
  // D로이스
  dlois: {
    noAndNameCell: 'E67',  // D로이스 번호와 이름 (예: "No. 17 기묘한 이웃 Strange Neighbour")
    descCell: 'M67'        // D로이스 세부 내용 (긴 설명)
  },
  
  // 메모리 (로이스 아래)
  memory: {
    startRow: 77,
    endRow: 79,
    nameCol: 'E',          // 메모리 이름
    emotionCol: 'K',       // 감정
    descCol: 'O'           // 내용
  },
  
  // 무기
  weapon: {
    startRow: 91,
    endRow: 95,
    nameCol: 'B',          // 이름
    typeCol: 'H',          // 종별
    abilityCol: 'J',       // 기능
    rangeCol: 'L',         // 사정거리
    accuracyCol: 'N',      // 명중치
    attackCol: 'Q',        // 공격력
    guardCol: 'S',         // 가드치
    descCol: 'Y'           // 내용
  },
  
  // 방어구
  armor: {
    startRow: 99,
    endRow: 104,
    nameCol: 'B',          // 이름
    typeCol: 'H',          // 종별
    dodgeCol: 'J',         // 닷지
    actionCol: 'L',        // 행동치
    defenseCol: 'N',       // 장갑치
    descCol: 'U'           // 내용
  },
  
  // 비클
  vehicle: {
    startRow: 109,
    endRow: 111,
    nameCol: 'B',          // 이름
    typeCol: 'H',          // 종별
    abilityCol: 'J',       // 기능
    attackCol: 'L',        // 공격력
    actionCol: 'N',        // 행동치
    defenseCol: 'Q',       // 장갑치
    moveCol: 'S',          // 이동거리
    descCol: 'Y'           // 내용
  },
  
  // 아이템
  item: {
    startRow: 116,
    endRow: 130,
    nameCol: 'B',          // 이름
    typeCol: 'H',          // 종별
    abilityCol: 'J',       // 기능
    descCol: 'S'           // 내용
  },
  
  // 이펙트 (164~168, 172~193)
  effect: {
    rows: [164, 165, 166, 167, 168, 
           172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193],
    nameCol: 'C',          // 이펙트명
    currentLevelCol: 'H',  // 현재 레벨
    maxLevelCol: 'I',      // 최대 레벨
    timingCol: 'J',        // 타이밍
    abilityCol: 'L',       // 기능
    difficultyCol: 'N',    // 난이도
    targetCol: 'Q',        // 대상
    rangeCol: 'S',         // 사정거리
    erosionCol: 'U',       // 상승 침식률
    restrictionCol: 'W',   // 제한 조건
    effectCol: 'Y'         // 효과 내용
  },
  
  // 콤보 (196~237, 6행 단위)
  combo: {
    startRow: 196,
    endRow: 237,
    interval: 6,           // 6행마다 반복
    nameCol: 'B',          // 콤보명 (N행)
    timingCol: 'Q',        // 타이밍 (N+1행)
    skillCol: 'S',         // 사용 기능 (N+1행)
    difficultyCol: 'U',    // 난이도 (N+1행)
    targetCol: 'W',        // 대상 (N+1행)
    rangeCol: 'Y',         // 사정거리 (N+1행)
    restrictionCol: 'AB',  // 제한 (N+1행)
    erosionCol: 'AD',      // 상승 침식률 (N+1행)
    
    // 99↓ 조건
    effectList99Col: 'D',  // 이펙트 목록 (N+2행)
    content99Col: 'D',     // 내용 (N+3행)
    dice99Col: 'Y',        // +다이스 (N+3행)
    critical99Col: 'AB',   // 크리티컬치 (N+3행)
    attack99Col: 'AD',     // 공격력 (N+3행)
    
    // 100↑ 조건
    effectList100Col: 'D', // 이펙트 목록 (N+4행)
    content100Col: 'D',    // 내용 (N+5행)
    dice100Col: 'Y',       // +다이스 (N+5행)
    critical100Col: 'AB',  // 크리티컬치 (N+5행)
    attack100Col: 'AD'     // 공격력 (N+5행)
  },
  
  // 종자 데이터 (필요시)
  seed: {
    hp: 'E45',
    actionValue: 'G45',
    body: 'C48',
    sense: 'F48',
    mind: 'I48',
    social: 'L48'
  }
};

// 능력치 → 셀 매핑 (빠른 접근용)
const STAT_TO_CELL = {
  '육체': 'F33',
  '감각': 'N33',
  '정신': 'V33',
  '사회': 'AD33',
  '백병': 'H36',
  '회피': 'H37',
  '사격': 'P36',
  '지각': 'P37',
  'RC': 'X36',
  '의지': 'X37',
  '교섭': 'AF36',
  '조달': 'AF37',
  'HP': 'O16',
  '침식률': 'S16'
};

// 상위 항목 → 세부 기능 매핑
const SUB_SKILLS = {
  '육체': ['백병', '회피'],
  '감각': ['사격', '지각'],
  '정신': ['RC', '의지'],
  '사회': ['교섭', '조달']
};

// 침식률에 따른 침식D 계산
const EROSION_THRESHOLDS = [
  { erosion: 190, d: 5 },
  { erosion: 130, d: 4 },
  { erosion: 100, d: 3 },
  { erosion: 80, d: 2 },
  { erosion: 60, d: 1 },
  { erosion: 0, d: 0 }
];

/**
 * 침식률을 받아 침식D를 계산
 * @param {number} erosion - 침식률
 * @returns {number} - 침식D
 */
function calculateErosionD(erosion) {
  for (const threshold of EROSION_THRESHOLDS) {
    if (erosion >= threshold.erosion) {
      return threshold.d;
    }
  }
  return 0;
}

/**
 * 침식률과 기원종 여부로 이펙트 레벨 계산
 * @param {number} erosion - 침식률
 * @param {boolean} isKigenShu - 기원종 여부
 * @returns {number} - 이펙트 레벨
 */
function calculateEffectLevel(erosion, isKigenShu) {
  if (isKigenShu) {
    // 기원종
    if (erosion >= 200) return 4;
    if (erosion >= 150) return 3;
    if (erosion >= 100) return 2;
    if (erosion >= 80) return 1;
    return 0;
  } else {
    // 일반
    if (erosion >= 260) return 3;
    if (erosion >= 220) return 3;
    if (erosion >= 190) return 2;
    if (erosion >= 160) return 2;
    if (erosion >= 130) return 1;
    if (erosion >= 100) return 1;
    return 0;
  }
}

module.exports = {
  SHEET_MAPPING,
  STAT_TO_CELL,
  SUB_SKILLS,
  EROSION_THRESHOLDS,
  calculateErosionD,
  calculateEffectLevel
};