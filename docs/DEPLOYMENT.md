# DX3bot 배포 가이드 🚀

이 문서는 DX3bot을 서버에 배포하는 방법을 설명합니다.

## 목차
- [로컬 개발 환경](#로컬-개발-환경)
- [프로덕션 배포](#프로덕션-배포)
- [Google Sheets 연동](#google-sheets-연동)
- [문제 해결](#문제-해결)

---

## 로컬 개발 환경

### 1. 사전 준비
- Node.js 18.0.0 이상 설치
- npm 또는 yarn 패키지 매니저
- Discord Developer Portal 계정
- 텍스트 에디터 (VS Code 권장)

### 2. Discord Bot 생성

#### 2.1 Discord Developer Portal 접속
1. https://discord.com/developers/applications 접속
2. "New Application" 클릭
3. 봇 이름 입력 (예: DX3bot-Dev)

#### 2.2 Bot 설정
1. 좌측 메뉴에서 "Bot" 선택
2. "Add Bot" 클릭
3. "Reset Token" 클릭하여 토큰 생성 및 복사 (⚠️ 안전하게 보관!)
4. 다음 권한 활성화:
   - Presence Intent
   - Server Members Intent
   - Message Content Intent

#### 2.3 OAuth2 설정
1. 좌측 메뉴에서 "OAuth2" > "URL Generator" 선택
2. Scopes: `bot` 선택
3. Bot Permissions 선택:
   - Send Messages
   - Read Message History
   - Add Reactions
   - Use Slash Commands
   - Manage Messages (선택사항)
4. 생성된 URL로 봇을 테스트 서버에 초대

### 3. 프로젝트 설정

#### 3.1 저장소 클론
```bash
git clone https://github.com/yourusername/dx3bot_v2.git
cd dx3bot_v2
```

#### 3.2 의존성 설치
```bash
npm install
```

#### 3.3 환경 변수 설정
`.env` 파일 생성:
```env
# Discord Bot Token (필수)
DISCORD_BOT_TOKEN=your_bot_token_here

# Bot Owner Discord ID (필수)
BOT_OWNER_ID=your_discord_user_id

# Google Sheets (선택사항)
GOOGLE_CREDENTIALS_PATH=./google-credentials.json
```

**Discord User ID 확인 방법:**
1. Discord 설정 > 고급 > 개발자 모드 활성화
2. 자신의 프로필 우클릭 > ID 복사

#### 3.4 봇 실행
```bash
npm start
```

성공 메시지:
```
✅ Ready! Logged in as DX3bot-Dev#1234
```

---

## 프로덕션 배포

### 옵션 1: VPS/전용 서버 (추천)

#### 1. 서버 준비
- Ubuntu 20.04 LTS 이상 권장
- 최소 요구사양: 1GB RAM, 10GB Storage

#### 2. Node.js 설치
```bash
# NodeSource를 통한 Node.js 18 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 설치 확인
node --version  # v18.x.x 이상
npm --version
```

#### 3. Git 설치
```bash
sudo apt-get install git
```

#### 4. 프로젝트 클론
```bash
cd /opt
sudo git clone https://github.com/yourusername/dx3bot_v2.git
cd dx3bot_v2
sudo npm install
```

#### 5. 환경 변수 설정
```bash
sudo nano .env
```
`.env` 파일 내용 입력 후 저장 (Ctrl+X, Y, Enter)

#### 6. PM2로 프로세스 관리
```bash
# PM2 전역 설치
sudo npm install -g pm2

# 봇 시작
pm2 start dx3bot.js --name dx3bot

# 부팅 시 자동 시작 설정
pm2 startup
pm2 save

# 상태 확인
pm2 status
pm2 logs dx3bot

# 재시작
pm2 restart dx3bot

# 중지
pm2 stop dx3bot
```

#### 7. 방화벽 설정 (선택사항)
```bash
# UFW 방화벽 설정
sudo ufw allow ssh
sudo ufw enable
```

### 옵션 2: Heroku

#### 1. Heroku CLI 설치
```bash
# macOS
brew tap heroku/brew && brew install heroku

# Windows
# https://devcenter.heroku.com/articles/heroku-cli 에서 설치
```

#### 2. Heroku 앱 생성
```bash
heroku login
heroku create dx3bot-prod
```

#### 3. Procfile 생성
`Procfile` 파일 생성:
```
worker: node dx3bot.js
```

#### 4. 환경 변수 설정
```bash
heroku config:set DISCORD_BOT_TOKEN=your_token_here
heroku config:set BOT_OWNER_ID=your_user_id
```

#### 5. 배포
```bash
git add .
git commit -m "Deploy to Heroku"
git push heroku main

# 워커 활성화
heroku ps:scale worker=1

# 로그 확인
heroku logs --tail
```

### 옵션 3: Docker

#### 1. Dockerfile 생성
프로젝트 루트에 `Dockerfile` 생성:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

CMD ["node", "dx3bot.js"]
```

#### 2. .dockerignore 생성
```
node_modules
npm-debug.log
.env
data/
.git
```

#### 3. Docker Compose 설정
`docker-compose.yml` 생성:
```yaml
version: '3.8'

services:
  dx3bot:
    build: .
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./data:/app/data
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

#### 4. 빌드 및 실행
```bash
# 빌드
docker-compose build

# 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 중지
docker-compose down
```

---

## Google Sheets 연동

### 1. Google Cloud 프로젝트 생성

#### 1.1 프로젝트 생성
1. https://console.cloud.google.com/ 접속
2. "프로젝트 만들기" 클릭
3. 프로젝트 이름 입력 (예: dx3bot-sheets)
4. "만들기" 클릭

#### 1.2 Google Sheets API 활성화
1. "API 및 서비스" > "라이브러리" 선택
2. "Google Sheets API" 검색
3. "사용" 클릭

### 2. 서비스 계정 생성

#### 2.1 계정 생성
1. "API 및 서비스" > "사용자 인증 정보" 선택
2. "사용자 인증 정보 만들기" > "서비스 계정" 선택
3. 서비스 계정 이름 입력 (예: dx3bot-service)
4. "만들기 및 계속" 클릭
5. 역할 선택: "편집자" (선택사항)
6. "완료" 클릭

#### 2.2 키 생성
1. 생성된 서비스 계정 클릭
2. "키" 탭 선택
3. "키 추가" > "새 키 만들기" 클릭
4. "JSON" 선택 > "만들기" 클릭
5. 다운로드된 JSON 파일을 `google-credentials.json`으로 저장

### 3. Google Sheets 설정

#### 3.1 시트 생성
1. Google Sheets에서 새 스프레드시트 생성
2. 시트 이름: 캐릭터명 (예: "첸 슈아이")
3. 스프레드시트 URL에서 ID 복사:
   ```
   https://docs.google.com/spreadsheets/d/[이부분이ID]/edit
   ```

#### 3.2 권한 부여
1. 시트 우측 상단 "공유" 클릭
2. `google-credentials.json`의 `client_email` 추가
3. 권한: "편집자"
4. "전송" 클릭

#### 3.3 시트 구조
시트는 다음 구조를 따라야 합니다:
```
A1: 항목명
B1: 값
A2: 육체
B2: 3
A3: 감각
B3: 6
...
```

### 4. 봇에서 시트 연결
```
!시트연결 [시트ID]
```

예시:
```
!시트연결 1ha-jFHWtPiYtnqm9P9UVPHVApPl2vg4REAGuym3JgJo
```

---

## 모니터링 및 유지보수

### 로그 관리

#### PM2 로그
```bash
# 실시간 로그
pm2 logs dx3bot

# 로그 파일 위치
~/.pm2/logs/

# 로그 지우기
pm2 flush
```

#### 커스텀 로깅
`winston` 패키지 사용 권장:
```bash
npm install winston
```

### 백업

#### 데이터 백업
```bash
# 수동 백업
cp -r data/ backup/data_$(date +%Y%m%d_%H%M%S)/

# 자동 백업 (cron)
0 3 * * * cd /opt/dx3bot_v2 && tar -czf backup/backup_$(date +\%Y\%m\%d).tar.gz data/
```

#### 데이터베이스 백업 (Google Sheets 사용 시)
Google Sheets는 자동으로 버전 관리되므로 별도 백업 불필요

### 업데이트

#### Git Pull 방식
```bash
cd /opt/dx3bot_v2
git pull origin main
npm install
pm2 restart dx3bot
```

#### 봇 내부 업데이트 명령어
```
!업데이트 [major|minor|patch] [메시지]
```
이 명령어는 모든 서버에 업데이트 공지를 전송합니다.

---

## 문제 해결

### 봇이 시작되지 않을 때

#### 1. 환경 변수 확인
```bash
# .env 파일 확인
cat .env

# 토큰 유효성 확인
node -e "require('dotenv').config(); console.log(process.env.DISCORD_BOT_TOKEN);"
```

#### 2. 포트 충돌 확인
```bash
# 프로세스 확인
ps aux | grep node

# 포트 사용 확인
netstat -tulpn | grep LISTEN
```

#### 3. 권한 문제
```bash
# 파일 권한 확인
ls -la

# 권한 수정
chmod 644 .env
chmod 755 dx3bot.js
```

### 메모리 부족

#### PM2 메모리 제한
```bash
pm2 start dx3bot.js --name dx3bot --max-memory-restart 500M
```

#### 메모리 사용량 확인
```bash
pm2 monit
```

### Google Sheets 연동 오류

#### 1. 서비스 계정 확인
- `google-credentials.json` 파일 존재 확인
- JSON 파일 형식 확인
- client_email이 시트에 공유되었는지 확인

#### 2. API 할당량 초과
- Google Cloud Console에서 할당량 확인
- 필요 시 할당량 증가 요청

#### 3. 권한 오류
```bash
# 파일 권한 확인
ls -l google-credentials.json

# 권한이 너무 개방적일 경우 수정
chmod 600 google-credentials.json
```

### Discord API 오류

#### Rate Limiting
봇이 너무 많은 요청을 보내면 Discord가 제한합니다:
- 메시지 전송 제한: 5/5초
- API 요청 제한: 50/초

해결방법:
- 요청 사이에 딜레이 추가
- discord.js의 내장 rate limiter 활용

#### 권한 부족
봇에 필요한 권한이 없을 때:
1. Discord Developer Portal에서 권한 확인
2. 서버에서 봇 역할 권한 확인
3. 채널별 권한 확인

---

## 보안 권장사항

### 1. 환경 변수 보호
```bash
# .env 파일 권한
chmod 600 .env

# Git에서 제외
echo ".env" >> .gitignore
```

### 2. 토큰 보안
- 토큰을 절대 공개 저장소에 커밋하지 마세요
- 정기적으로 토큰 재발급
- 의심스러운 활동 발견 시 즉시 재발급

### 3. 서버 보안
```bash
# 자동 보안 업데이트
sudo apt-get install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# Fail2ban 설치 (SSH 무차별 대입 공격 방지)
sudo apt-get install fail2ban
```

### 4. 데이터 백업
- 정기적인 백업 스케줄 설정
- 백업 파일 암호화
- 오프사이트 백업 저장

---

## 성능 최적화

### 1. 데이터베이스 최적화
- 정기적으로 사용하지 않는 데이터 정리
- JSON 파일 크기 모니터링
- 필요시 SQLite/PostgreSQL로 마이그레이션 고려

### 2. 메모리 최적화
```javascript
// 메모리 사용량 확인
const used = process.memoryUsage();
console.log('Memory usage:', used.heapUsed / 1024 / 1024, 'MB');
```

### 3. 캐싱 전략
- 자주 조회되는 데이터 메모리 캐싱
- TTL (Time To Live) 설정

---

## 추가 리소스

### 공식 문서
- [Discord.js 가이드](https://discordjs.guide/)
- [Discord.js 문서](https://discord.js.org/)
- [Google Sheets API](https://developers.google.com/sheets/api)

### 커뮤니티
- [Discord.js Discord 서버](https://discord.gg/djs)
- [Discord Developers](https://discord.gg/discord-developers)

### 도구
- [PM2 문서](https://pm2.keymetrics.io/)
- [Docker 문서](https://docs.docker.com/)
- [Heroku Dev Center](https://devcenter.heroku.com/)

---

## 문의

배포 과정에서 문제가 발생하면:
- GitHub Issues에 문제 등록
- Discord DM: `@TRPG_sha`

---

**Happy Deploying! 🚀**
