# 경로 업데이트 가이드 📝

프로젝트 구조가 개선되어 일부 파일 경로를 업데이트해야 합니다.

## 변경된 파일 위치

### 1. lib/ 폴더로 이동
- `commandHandler.js` → `lib/commandHandler.js`
- `slashCommandHandler.js` → `lib/slashCommandHandler.js`
- `database.js` → `lib/database.js`
- `sheetsClient.js` → `lib/sheetsClient.js`
- `sheetsMapping.js` → `lib/sheetsMapping.js`

### 2. config/ 폴더로 이동
- `config.js` → `config/config.js`
- `google-credentials.json` → `config/google-credentials.json`

### 3. data/ 폴더로 이동 (이전 단계)
- `data.json` → `data/data.json`
- `comboData.json` → `data/comboData.json`
- `characterSheets.json` → `data/characterSheets.json`
- `userSheets.json` → `data/userSheets.json`
- `version.json` → `data/version.json`

---

## 업데이트가 필요한 파일들

### 1. dx3bot.js (메인 파일)

#### require 문 수정
```javascript
// 변경 전
const { token } = require('./config.json');

// 변경 후
const { token } = require('./config/config.js');
```

#### 데이터 파일 경로 수정
```javascript
// 변경 전
const versionFilePath = path.join(__dirname, 'version.json');
const dataFilePath = path.join(__dirname, 'data.json');
const activeCharacterFile = path.join(__dirname, 'activeCharacter.json');
const comboDataFile = path.join(__dirname, 'comboData.json');

// 변경 후
const versionFilePath = path.join(__dirname, 'data', 'version.json');
const dataFilePath = path.join(__dirname, 'data', 'data.json');
const activeCharacterFile = path.join(__dirname, 'data', 'activeCharacter.json');
const comboDataFile = path.join(__dirname, 'data', 'comboData.json');
```

### 2. lib/database.js

```javascript
// 변경 전
const characterSheetsPath = path.join(__dirname, 'characterSheets.json');
const userSheetsPath = path.join(__dirname, 'userSheets.json');

// 변경 후
const characterSheetsPath = path.join(__dirname, '..', 'data', 'characterSheets.json');
const userSheetsPath = path.join(__dirname, '..', 'data', 'userSheets.json');
```

### 3. lib/sheetsClient.js

```javascript
// 변경 전
const CREDENTIALS_PATH = './google-credentials.json';

// 변경 후
const CREDENTIALS_PATH = path.join(__dirname, '..', 'config', 'google-credentials.json');
```

### 4. commands/*.js 파일들

각 명령어 파일에서 다음을 확인하고 수정:

```javascript
// database.js import가 있다면
// 변경 전
const database = require('../database');

// 변경 후
const database = require('../lib/database');
```

```javascript
// config.js import가 있다면
// 변경 전
const config = require('../config');

// 변경 후
const config = require('../config/config');
```

### 5. .env 파일

```env
# 변경 전
GOOGLE_CREDENTIALS_PATH=./google-credentials.json

# 변경 후
GOOGLE_CREDENTIALS_PATH=./config/google-credentials.json
```

---

## 빠른 수정 스크립트

이 명령어들을 하나씩 실행하여 경로를 일괄 업데이트할 수 있습니다:

### Windows (PowerShell)
```powershell
# dx3bot.js 수정
(Get-Content dx3bot.js) -replace "require\('\./config\.json'\)", "require('./config/config.js')" | Set-Content dx3bot.js
(Get-Content dx3bot.js) -replace "path\.join\(__dirname, 'version\.json'\)", "path.join(__dirname, 'data', 'version.json')" | Set-Content dx3bot.js
(Get-Content dx3bot.js) -replace "path\.join\(__dirname, 'data\.json'\)", "path.join(__dirname, 'data', 'data.json')" | Set-Content dx3bot.js
(Get-Content dx3bot.js) -replace "path\.join\(__dirname, 'activeCharacter\.json'\)", "path.join(__dirname, 'data', 'activeCharacter.json')" | Set-Content dx3bot.js
(Get-Content dx3bot.js) -replace "path\.join\(__dirname, 'comboData\.json'\)", "path.join(__dirname, 'data', 'comboData.json')" | Set-Content dx3bot.js
```

### Linux/Mac (Bash)
```bash
# dx3bot.js 수정
sed -i "s/require('.\/config.json')/require('.\/config\/config.js')/g" dx3bot.js
sed -i "s/path.join(__dirname, 'version.json')/path.join(__dirname, 'data', 'version.json')/g" dx3bot.js
sed -i "s/path.join(__dirname, 'data.json')/path.join(__dirname, 'data', 'data.json')/g" dx3bot.js
sed -i "s/path.join(__dirname, 'activeCharacter.json')/path.join(__dirname, 'data', 'activeCharacter.json')/g" dx3bot.js
sed -i "s/path.join(__dirname, 'comboData.json')/path.join(__dirname, 'data', 'comboData.json')/g" dx3bot.js
```

---

## 테스트 체크리스트

변경 후 다음 사항들을 테스트하세요:

### 1. 봇 시작
```bash
node dx3bot.js
```

예상 출력:
```
✅ Ready! Logged in as DX3bot#1234
```

### 2. 데이터 로딩 확인
- [ ] 기존 캐릭터 데이터가 정상적으로 로드됨
- [ ] `!시트확인` 명령어가 정상 작동
- [ ] 콤보 데이터가 유지됨

### 3. Google Sheets 연동 (사용 시)
- [ ] 시트 연결이 정상 작동
- [ ] 시트 읽기/쓰기가 정상 작동

### 4. 새 데이터 저장
- [ ] `!시트입력`으로 새 데이터 입력 시 정상 저장
- [ ] 봇 재시작 후에도 데이터 유지

---

## 오류 발생 시

### "Cannot find module" 오류
```
Error: Cannot find module './config.json'
```
→ `dx3bot.js`에서 require 경로 확인

### "ENOENT: no such file or directory" 오류
```
Error: ENOENT: no such file or directory, open 'data.json'
```
→ 데이터 파일 경로가 올바르게 수정되었는지 확인

### Google Sheets 인증 오류
```
Error: Unable to load credentials
```
→ `config/google-credentials.json` 파일 존재 및 경로 확인

---

## 롤백 방법

문제가 발생하면 다음 명령으로 되돌릴 수 있습니다:

```bash
# Windows (PowerShell)
Move-Item lib\* .
Move-Item config\* .

# Linux/Mac
mv lib/* .
mv config/* .
```

---

## 완료 후

모든 수정이 완료되고 테스트가 성공하면:

```bash
git add .
git commit -m "프로젝트 구조 최종 정리 - lib/ 및 config/ 폴더 추가"
git push origin main
```

---

**문의사항이 있으면 PROJECT_CLEANUP_REPORT.md를 참고하거나 @TRPG_sha에게 문의하세요.**
