# DX3bot v2 프로젝트 구조 📁

이 문서는 프로젝트의 디렉토리 구조와 각 파일의 역할을 설명합니다.

## 루트 디렉토리

```
dx3bot_v2/
├── .env                      # 환경 변수 (gitignore)
├── .gitignore               # Git 무시 파일
├── package.json             # npm 설정 및 의존성
├── package-lock.json        # npm 락 파일
├── README.md                # 프로젝트 개요
├── CHANGELOG.md             # 변경 이력
├── dx3bot.js                # 메인 봇 진입점 ⭐
├── config.js                # 전역 설정
├── google-credentials.json  # Google 서비스 계정 키 (gitignore)
│
├── backup/                  # 백업 파일
│   └── dx3bot_original.js  # 원본 백업
│
├── data/                    # 데이터 파일 (gitignore)
│   ├── data.json           # 캐릭터 데이터
│   ├── comboData.json      # 콤보 데이터
│   ├── characterSheets.json # 시트 매핑
│   ├── userSheets.json     # 사용자-시트 연결
│   ├── activeCharacter.json # 활성 캐릭터
│   └── version.json        # 버전 정보
│
├── docs/                    # 문서
│   ├── COMMANDS.md         # 명령어 가이드
│   ├── DEPLOYMENT.md       # 배포 가이드
│   └── STRUCTURE.md        # 이 문서
│
├── src/                     # 소스 코드
│   ├── index.js            # 대체 진입점
│   ├── commands/           # 명령어 핸들러
│   ├── handlers/           # 이벤트 핸들러
│   ├── constants/          # 상수
│   └── utils/              # 유틸리티
│
├── commands/                # 명령어 구현 (레거시)
│   ├── admin.js
│   ├── character.js
│   ├── combat.js
│   ├── forum.js
│   ├── lois.js
│   ├── sheet.js
│   └── modules/            # 서브모듈
│
└── utils/                   # 유틸리티 (레거시)
    ├── erosion.js
    └── helpers.js
```

## 주요 파일 설명

### 진입점 및 설정

#### `dx3bot.js` ⭐
- **역할**: 봇의 메인 진입점
- **내용**:
  - Discord 클라이언트 초기화
  - 이벤트 리스너 설정
  - 명령어 핸들러 등록
  - 전역 에러 처리
- **의존성**: 
  - `discord.js`
  - `dotenv`
  - `./commands/*`
  - `./utils/*`

#### `config.js`
- **역할**: 전역 설정 관리
- **내용**:
  - 환경 변수 로드
  - 기본 설정값
  - 상수 정의

#### `.env`
- **역할**: 환경 변수 저장
- **주요 변수**:
  ```env
  DISCORD_BOT_TOKEN=...      # Discord 봇 토큰
  BOT_OWNER_ID=...          # 봇 관리자 ID
  GOOGLE_CREDENTIALS_PATH=...# Google 인증 파일 경로
  ```

### 데이터 디렉토리 (`data/`)

#### `data.json`
캐릭터 데이터 저장 구조:
```json
{
  "서버ID": {
    "사용자ID": {
      "캐릭터명": {
        "codeName": "코드네임",
        "emoji": "🦋",
        "육체": 3,
        "감각": 6,
        "백병": 5,
        "HP": 24,
        "침식률": 35,
        "lois": [...],
        "effects": [...]
      }
    }
  }
}
```

#### `comboData.json`
콤보 데이터 저장 구조:
```json
{
  "서버ID": {
    "사용자ID": {
      "캐릭터명": {
        "콤보명": {
          "99↓": "낮은 침식률 콤보",
          "100↑": "높은 침식률 콤보"
        }
      }
    }
  }
}
```

#### `activeCharacter.json`
활성 캐릭터 추적:
```json
{
  "서버ID": {
    "사용자ID": "활성캐릭터명"
  }
}
```

#### `userSheets.json`
Google Sheets 연결 정보:
```json
{
  "서버ID": {
    "사용자ID": "시트ID::시트명"
  }
}
```

#### `version.json`
봇 버전 정보:
```json
{
  "major": 2,
  "minor": 0,
  "patch": 0
}
```

### 명령어 디렉토리 (`commands/`)

#### `character.js`
- **명령어**: `!시트입력`, `!지정`, `!지정해제`, `!시트확인`
- **기능**: 캐릭터 생성 및 관리
- **모듈**:
  - `modules/characterData.js`: 데이터 처리
  - `modules/characterSheet.js`: 시트 생성
  - `modules/embedSheet.js`: 임베드 출력

#### `combat.js`
- **명령어**: `!판정`, `!등침`, `!HP+`, `!침식률+`
- **기능**: 전투 및 판정 시스템
- **의존성**: `utils/erosion.js`

#### `lois.js`
- **명령어**: `!로이스`, `!로이스삭제`, `!타이터스`
- **기능**: 로이스 시스템 관리

#### `admin.js`
- **명령어**: `!리셋`, `!캐릭터삭제`, `!업데이트`
- **기능**: 관리자 기능

#### `sheet.js`
- **명령어**: `!시트연결`, `!시트동기화`
- **기능**: Google Sheets 연동
- **의존성**: 
  - `sheetsClient.js`
  - `sheetsMapping.js`

### 유틸리티 디렉토리 (`utils/`)

#### `erosion.js`
침식률 관련 계산:
```javascript
// 침식D 계산
function calculateErosionD(erosionRate) { ... }

// 침식률 임계값
const EROSION_THRESHOLDS = [
  { erosion: 60, d: 1 },
  { erosion: 80, d: 2 },
  ...
];
```

#### `helpers.js`
공통 헬퍼 함수:
```javascript
// 이름 추출 (따옴표 처리)
function extractName(input) { ... }

// 안전한 정수 변환
function safeParseInt(value, defaultValue) { ... }
```

### Google Sheets 연동

#### `sheetsClient.js`
- Google Sheets API 클라이언트 초기화
- 인증 처리

#### `sheetsMapping.js`
- 시트 데이터 ↔ 봇 데이터 변환
- 필드 매핑 규칙

#### `database.js`
- 로컬 JSON ↔ Google Sheets 동기화
- 백업 및 복원

### 문서 디렉토리 (`docs/`)

#### `COMMANDS.md`
- 전체 명령어 레퍼런스
- 사용 예시 및 팁

#### `DEPLOYMENT.md`
- 배포 가이드 (VPS, Heroku, Docker)
- Google Sheets 설정
- 문제 해결

#### `STRUCTURE.md` (이 문서)
- 프로젝트 구조 설명
- 파일 및 디렉토리 역할

## 신규 개발자를 위한 가이드

### 시작하기

1. **전체 구조 파악**
   - `README.md` 읽기
   - 이 문서(`STRUCTURE.md`) 읽기

2. **핵심 파일 이해**
   - `dx3bot.js`: 메인 로직
   - `commands/character.js`: 캐릭터 관리
   - `commands/combat.js`: 전투 시스템

3. **데이터 흐름 파악**
   ```
   사용자 명령어 
   → dx3bot.js (이벤트 리스너)
   → commands/*.js (명령어 핸들러)
   → data/*.json (데이터 저장/로드)
   → 응답 반환
   ```

### 새 명령어 추가하기

#### 1. 명령어 파일 생성/수정
`commands/` 디렉토리의 적절한 파일에 추가:

```javascript
// commands/character.js
module.exports = {
  name: 'character',
  commands: {
    '시트입력': handleSheetInput,
    '새명령어': handleNewCommand  // ← 추가
  }
};

async function handleNewCommand(message, args) {
  // 구현
}
```

#### 2. 도움말 업데이트
`commands/help.js`에 명령어 설명 추가

#### 3. 문서 업데이트
`docs/COMMANDS.md`에 상세 가이드 추가

### 데이터 구조 수정하기

#### 1. 마이그레이션 스크립트 작성
```javascript
// scripts/migrate_v2_to_v3.js
function migrateData(oldData) {
  // 데이터 변환 로직
  return newData;
}
```

#### 2. 백업 생성
```bash
cp data/data.json data/data.json.v2.backup
```

#### 3. 테스트 및 배포

### 코드 스타일 가이드

#### 명명 규칙
- **변수/함수**: camelCase (`characterData`, `handleCommand`)
- **상수**: UPPER_SNAKE_CASE (`MAIN_ATTRIBUTES`, `EROSION_THRESHOLDS`)
- **클래스**: PascalCase (`CommandHandler`, `SheetManager`)
- **파일**: kebab-case (`character-manager.js`)

#### 주석
```javascript
/**
 * 캐릭터 데이터를 저장합니다
 * @param {string} serverId - 서버 ID
 * @param {string} userId - 사용자 ID
 * @param {string} charName - 캐릭터 이름
 * @param {object} data - 저장할 데이터
 * @returns {boolean} 성공 여부
 */
function saveCharacterData(serverId, userId, charName, data) {
  // 구현
}
```

#### 에러 처리
```javascript
try {
  // 작업
} catch (error) {
  console.error('상세한 에러 메시지:', error);
  // 사용자에게 친절한 메시지 전송
  message.reply('❌ 오류가 발생했습니다.');
}
```

## 빌드 및 배포

### 개발 모드
```bash
npm run dev
```

### 프로덕션 배포
```bash
npm start
# 또는
pm2 start dx3bot.js --name dx3bot
```

### 환경별 설정

#### 개발 환경
```env
NODE_ENV=development
LOG_LEVEL=debug
```

#### 프로덕션 환경
```env
NODE_ENV=production
LOG_LEVEL=info
```

## 의존성 관리

### 주요 의존성
```json
{
  "discord.js": "^14.25.1",    // Discord API
  "dotenv": "^16.6.1",         // 환경 변수
  "googleapis": "^128.0.0"     // Google Sheets
}
```

### 업데이트
```bash
# 최신 마이너 버전
npm update

# 메이저 버전 업그레이드 (주의!)
npm install discord.js@latest
```

## 테스팅

### 테스트 서버 설정
1. Discord Developer Portal에서 테스트 봇 생성
2. 별도 `.env.test` 파일 사용
3. 테스트 서버에만 초대

### 수동 테스트 체크리스트
- [ ] 캐릭터 생성 및 수정
- [ ] 판정 시스템
- [ ] 등장침식
- [ ] 콤보 시스템
- [ ] 로이스 관리
- [ ] Google Sheets 연동

## 문제 해결

### 자주 발생하는 이슈

#### 1. 데이터 파일 손상
```bash
# 백업에서 복구
cp backup/data.json.backup data/data.json
```

#### 2. Google Sheets 연동 실패
- `google-credentials.json` 파일 확인
- 시트 공유 권한 확인
- API 할당량 확인

#### 3. 메모리 누수
```bash
# PM2 메모리 제한
pm2 start dx3bot.js --max-memory-restart 500M
```

## 기여하기

### 풀 리퀘스트 프로세스
1. Fork 저장소
2. Feature 브랜치 생성 (`git checkout -b feature/amazing-feature`)
3. 변경사항 커밋 (`git commit -m 'Add amazing feature'`)
4. 브랜치 푸시 (`git push origin feature/amazing-feature`)
5. Pull Request 생성

### 코드 리뷰 기준
- 기능이 올바르게 작동하는가?
- 코드가 읽기 쉬운가?
- 문서가 업데이트되었는가?
- 기존 기능을 손상시키지 않는가?

## 추가 리소스

### 관련 문서
- [Discord.js 가이드](https://discordjs.guide/)
- [Google Sheets API](https://developers.google.com/sheets/api)
- [Double Cross 3rd Edition](http://www.fear.co.jp/dx3/)

### 커뮤니티
- [Discord 서버](https://discord.gg/yourserver)
- [GitHub Discussions](https://github.com/yourusername/dx3bot_v2/discussions)

---

**마지막 업데이트**: 2025-01-27
**작성자**: @TRPG_sha
