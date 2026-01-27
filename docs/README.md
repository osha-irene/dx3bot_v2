# DX3bot v2 🎲

Double Cross 3rd Edition TRPG를 위한 Discord 봇입니다. Play by Post (PbP) 방식의 게임플레이에 최적화되어 있으며, Google Sheets 연동을 통한 실시간 캐릭터 시트 관리를 지원합니다.

## 주요 기능 ✨

### 📊 캐릭터 관리
- **시트 입력/수정**: 캐릭터 능력치, 스킬, 상태 관리
- **빠른 생성**: JSON 형식으로 캐릭터 일괄 생성
- **Google Sheets 연동**: 실시간 캐릭터 시트 동기화
- **다중 캐릭터**: 사용자당 여러 캐릭터 관리 가능

### 🎲 게임플레이
- **판정 시스템**: 자동 주사위 굴림 및 크리티컬 판정
- **등장침식**: 1d10 등장침식 자동 계산
- **침식률 관리**: 침식률 변화에 따른 침식D 자동 조정
- **상태 추적**: HP, 침식률 등 실시간 상태 관리

### ⚔️ 전투 시스템
- **콤보 시스템**: 침식률 조건부 콤보 저장 및 호출
- **이펙트 관리**: 버프/디버프 효과 추적
- **로이스/타이터스**: 로이스 관리 및 타이터스 변환

## 설치 방법 🚀

### 필수 요구사항
- Node.js v18.0.0 이상
- Discord Bot Token
- Google Cloud Service Account (선택사항)

### 1. 저장소 클론
```bash
git clone https://github.com/yourusername/dx3bot_v2.git
cd dx3bot_v2
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
`.env` 파일을 생성하고 다음 내용을 입력하세요:

```env
DISCORD_BOT_TOKEN=your_discord_bot_token_here
BOT_OWNER_ID=your_discord_user_id_here
GOOGLE_CREDENTIALS_PATH=./google-credentials.json
```

### 4. Google Sheets 연동 (선택사항)
1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성
2. Google Sheets API 활성화
3. 서비스 계정 생성 및 키 다운로드
4. `google-credentials.json`으로 저장

### 5. 봇 실행
```bash
npm start
```

## 사용 방법 📖

### 기본 명령어

#### 캐릭터 관리
```
!시트입력 "캐릭터명" 육체 3 감각 6 정신 4 사회 2
!지정 "캐릭터명"
!지정해제
!시트확인
```

#### 빠른 생성 (DX3 변환기 사용)
```
!빠른생성 {"n":"테스트캐릭터","p":[["육체",3],["백병",5]],"s":[["HP",24]]}
```

#### 판정 및 전투
```
!판정 백병
!등침
!HP+5
!침식률-10
```

#### 콤보 시스템
```
!콤보 "연속공격" 99↓ 《C: 발로르(2) + 흑의 철퇴(4)》
!@"연속공격"
!콤보삭제 "연속공격"
```

#### 로이스 관리
```
!로이스 "동료" 우정* 증오 함께 싸우는 동료
!타이터스 "동료"
!로이스삭제 "동료"
```

### 상세 명령어
전체 명령어 목록은 Discord에서 `!도움` 명령어를 입력하거나 [COMMANDS.md](docs/COMMANDS.md)를 참조하세요.

## 프로젝트 구조 📁

```
dx3bot_v2/
├── src/                      # 소스 코드
│   ├── index.js             # 메인 진입점
│   ├── commands/            # 명령어 핸들러
│   ├── handlers/            # 이벤트 핸들러
│   ├── constants/           # 상수 정의
│   └── utils/               # 유틸리티 함수
├── data/                    # 데이터 파일 (gitignore)
├── docs/                    # 문서
├── backup/                  # 백업 파일
└── config files            # 설정 파일들
```

## 개발 🛠️

### 개발 환경 설정
```bash
npm run dev
```

### 설정 확인
```bash
npm run check
```

### 테스트
```bash
npm test
```

## 기여하기 🤝

버그 리포트, 기능 제안, Pull Request 모두 환영합니다!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 라이선스 📄

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 문의 💬

프로젝트 관련 문의사항은 Discord DM으로 연락주세요: `@TRPG_sha`

## 변경 이력 📝

자세한 변경 이력은 [CHANGELOG.md](CHANGELOG.md)를 참조하세요.

## 감사의 말 🙏

- Double Cross 3rd Edition TRPG 시스템
- Discord.js 커뮤니티
- 모든 기여자 및 테스터

---

Made with ❤️ for TRPG Community
