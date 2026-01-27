# Changelog

All notable changes to DX3bot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- 슬래시 커맨드 지원
- 웹 대시보드
- 다국어 지원 (영어, 일본어)
- 통계 시스템
- 전투 로그 자동 기록

---

## [2.0.0] - 2025-01-XX

### Added
- **Google Sheets 연동**: 실시간 캐릭터 시트 동기화
- **빠른생성 시스템**: JSON 형식으로 캐릭터 일괄 생성
- **이펙트 시스템**: 버프/디버프 효과 관리
- **개선된 콤보 시스템**: 침식률 조건부 콤보 자동 선택
- **모듈화된 명령어 구조**: 유지보수성 향상
- **서버별 독립 데이터**: 각 서버마다 독립적인 데이터 관리
- **향상된 에러 처리**: 상세한 오류 메시지 및 로깅
- **자동 백업 시스템**: JSON 및 Google Sheets 백업

### Changed
- **명령어 통합**: 35개 명령어 → 18개 주요 명령어로 통합
- **시트 확인 출력 개선**: 더 읽기 쉬운 임베드 형식
- **침식D 자동 계산**: 침식률 변경 시 자동 업데이트
- **로이스 형식 개선**: 메인 감정 강조 기능 (`*` 표시)

### Fixed
- 동시 다중 사용자 데이터 충돌 문제 해결
- 침식률 계산 오류 수정
- 콤보 저장/불러오기 버그 수정
- 메모리 누수 문제 해결

### Security
- 환경 변수 보안 강화
- Google Credentials 파일 보호
- Rate limiting 구현

---

## [1.5.0] - 2024-12-XX

### Added
- **로이스 시스템**: 로이스 추가, 삭제, 타이터스 변환
- **신드롬 자동 번역**: 한글 → 영어 자동 변환
- **캐릭터 상세 정보**: 코드네임, 이모지, 커버 등 설정
- **D-Lois 시스템**: D-Lois 번호 및 이름 관리

### Changed
- 명령어 응답 속도 개선
- 데이터 저장 방식 최적화

### Fixed
- 특수문자가 포함된 이름 처리 오류 수정
- 등장침식 계산 버그 수정

---

## [1.0.0] - 2024-11-XX

### Added
- **기본 캐릭터 관리**: 시트입력, 지정, 시트확인
- **판정 시스템**: dx 기반 판정
- **등장침식**: 1d10 등장침식 자동 계산
- **상태 관리**: HP, 침식률 변경
- **콤보 시스템**: 기본 콤보 저장 및 호출
- **도움말 시스템**: !도움 명령어

### Technical
- Discord.js v14 기반 구축
- JSON 파일 기반 데이터 저장
- 모듈화된 코드 구조

---

## Version History Summary

| Version | Release Date | Major Features |
|---------|-------------|----------------|
| 2.0.0 | 2025-01-XX | Google Sheets 연동, 빠른생성, 이펙트 시스템 |
| 1.5.0 | 2024-12-XX | 로이스 시스템, 신드롬 관리 |
| 1.0.0 | 2024-11-XX | 기본 캐릭터 관리 및 판정 시스템 |

---

## Migration Guides

### 1.x → 2.0

#### 데이터 마이그레이션
```bash
# 기존 데이터 백업
cp data.json data.json.backup

# 새 버전으로 업데이트
git pull origin main
npm install
```

#### 환경 변수 추가
`.env` 파일에 다음 추가:
```env
GOOGLE_CREDENTIALS_PATH=./google-credentials.json
```

#### 명령어 변경사항
- `!시트입력` → 따옴표 사용 권장: `!시트입력 "캐릭터명"`
- `!콤보` → 침식률 조건 추가: `!콤보 "이름" 99↓ [내용]`
- `!로이스` → P감정 강조: `!로이스 "이름" 증오* 분노 [내용]`

---

## Credits

### Contributors
- [@TRPG_sha](https://github.com/yourusername) - Main Developer

### Special Thanks
- Double Cross 3rd Edition TRPG Community
- Discord.js Development Team
- All Beta Testers

### Libraries Used
- [discord.js](https://discord.js.org/) - Discord API wrapper
- [googleapis](https://github.com/googleapis/google-api-nodejs-client) - Google Sheets integration
- [dotenv](https://github.com/motdotla/dotenv) - Environment variable management

---

## Links

- [GitHub Repository](https://github.com/yourusername/dx3bot_v2)
- [Issue Tracker](https://github.com/yourusername/dx3bot_v2/issues)
- [Documentation](https://github.com/yourusername/dx3bot_v2/wiki)

---

**Note**: 이 프로젝트는 활발히 개발 중입니다. 새로운 기능과 개선사항이 지속적으로 추가됩니다.
