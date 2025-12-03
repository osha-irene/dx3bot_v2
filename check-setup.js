/**
 * 봇 설정 검증 스크립트
 * 서버에 올리기 전에 실행하여 설정 확인
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('🔍 DX3bot 설정 검증 시작...\n');

let errors = [];
let warnings = [];
let success = [];

// 1. Node.js 버전 확인
console.log('📌 1. Node.js 버전 확인');
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));

if (majorVersion >= 18) {
  success.push(`✅ Node.js 버전: ${nodeVersion} (OK)`);
} else {
  errors.push(`❌ Node.js 버전이 너무 낮습니다: ${nodeVersion} (최소 18.0 필요)`);
}

// 2. 필수 파일 존재 확인
console.log('\n📌 2. 필수 파일 확인');
const requiredFiles = [
  'dx3bot.js',
  'config.js',
  'database.js',
  'sheetsClient.js',
  'sheetsMapping.js',
  'commandHandler.js',
  'package.json',
  '.gitignore'
];

for (const file of requiredFiles) {
  if (fs.existsSync(path.join(__dirname, file))) {
    success.push(`✅ ${file} 존재`);
  } else {
    errors.push(`❌ ${file} 파일이 없습니다!`);
  }
}

// 3. 필수 디렉토리 확인
console.log('\n📌 3. 디렉토리 구조 확인');
const requiredDirs = ['commands', 'utils'];

for (const dir of requiredDirs) {
  if (fs.existsSync(path.join(__dirname, dir))) {
    success.push(`✅ ${dir}/ 디렉토리 존재`);
  } else {
    errors.push(`❌ ${dir}/ 디렉토리가 없습니다!`);
  }
}

// 4. .env 파일 확인
console.log('\n📌 4. 환경 변수 확인');
if (fs.existsSync(path.join(__dirname, '.env'))) {
  success.push('✅ .env 파일 존재');
  
  // Discord Bot Token 확인
  if (process.env.DISCORD_BOT_TOKEN) {
    if (process.env.DISCORD_BOT_TOKEN.length > 50) {
      success.push('✅ DISCORD_BOT_TOKEN 설정됨');
    } else {
      errors.push('❌ DISCORD_BOT_TOKEN이 너무 짧습니다. 올바른 토큰인지 확인하세요.');
    }
  } else {
    errors.push('❌ DISCORD_BOT_TOKEN이 설정되지 않았습니다!');
  }
  
  // Bot Owner ID 확인
  if (process.env.BOT_OWNER_ID) {
    success.push('✅ BOT_OWNER_ID 설정됨 (관리자 명령어 사용 가능)');
  } else {
    warnings.push('⚠️ BOT_OWNER_ID가 설정되지 않았습니다. 관리자 명령어를 사용할 수 없습니다.');
  }
  
  // Google Sheets 확인
  const hasGoogleAuth = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (hasGoogleAuth) {
    success.push('✅ Google Sheets 인증 정보 설정됨');
    
    // 파일 존재 확인
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const credPath = path.join(__dirname, process.env.GOOGLE_APPLICATION_CREDENTIALS);
      if (fs.existsSync(credPath)) {
        success.push(`✅ ${process.env.GOOGLE_APPLICATION_CREDENTIALS} 파일 존재`);
        
        // JSON 파싱 테스트
        try {
          const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
          if (creds.client_email) {
            success.push(`✅ 서비스 계정 이메일: ${creds.client_email}`);
          }
        } catch (error) {
          errors.push(`❌ Google 인증 JSON 파일이 손상되었습니다: ${error.message}`);
        }
      } else {
        errors.push(`❌ ${process.env.GOOGLE_APPLICATION_CREDENTIALS} 파일이 없습니다!`);
      }
    }
  } else {
    warnings.push('⚠️ Google Sheets 인증이 설정되지 않았습니다. JSON 파일로만 데이터가 저장됩니다.');
  }
} else {
  errors.push('❌ .env 파일이 없습니다! .env.example을 복사하여 .env 파일을 만드세요.');
}

// 5. package.json 확인
console.log('\n📌 5. 패키지 설정 확인');
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  
  if (packageJson.dependencies) {
    const requiredPackages = ['discord.js', 'dotenv'];
    const optionalPackages = ['googleapis'];
    
    for (const pkg of requiredPackages) {
      if (packageJson.dependencies[pkg]) {
        success.push(`✅ ${pkg} 의존성 확인`);
      } else {
        errors.push(`❌ ${pkg} 패키지가 package.json에 없습니다!`);
      }
    }
    
    for (const pkg of optionalPackages) {
      if (packageJson.dependencies[pkg]) {
        success.push(`✅ ${pkg} 의존성 확인 (선택)`);
      }
    }
  }
  
  // node_modules 확인
  if (fs.existsSync(path.join(__dirname, 'node_modules'))) {
    success.push('✅ node_modules 디렉토리 존재 (패키지 설치됨)');
  } else {
    warnings.push('⚠️ node_modules가 없습니다. npm install을 실행하세요.');
  }
} catch (error) {
  errors.push(`❌ package.json 파싱 오류: ${error.message}`);
}

// 6. .gitignore 확인
console.log('\n📌 6. 보안 설정 확인');
try {
  const gitignore = fs.readFileSync(path.join(__dirname, '.gitignore'), 'utf8');
  
  if (gitignore.includes('.env')) {
    success.push('✅ .env 파일이 .gitignore에 포함됨 (보안 OK)');
  } else {
    errors.push('❌ .env 파일이 .gitignore에 없습니다! 보안 위험!');
  }
  
  if (gitignore.includes('google-credentials.json')) {
    success.push('✅ google-credentials.json이 .gitignore에 포함됨');
  } else {
    warnings.push('⚠️ google-credentials.json을 .gitignore에 추가하세요.');
  }
} catch (error) {
  warnings.push('⚠️ .gitignore 파일을 읽을 수 없습니다.');
}

// 결과 출력
console.log('\n' + '='.repeat(60));
console.log('📊 검증 결과');
console.log('='.repeat(60) + '\n');

if (success.length > 0) {
  console.log('✅ 성공 (' + success.length + '개):');
  success.forEach(msg => console.log('  ' + msg));
  console.log('');
}

if (warnings.length > 0) {
  console.log('⚠️  경고 (' + warnings.length + '개):');
  warnings.forEach(msg => console.log('  ' + msg));
  console.log('');
}

if (errors.length > 0) {
  console.log('❌ 오류 (' + errors.length + '개):');
  errors.forEach(msg => console.log('  ' + msg));
  console.log('');
}

console.log('='.repeat(60));

if (errors.length === 0) {
  console.log('\n🎉 모든 검증 통과! 봇을 실행할 준비가 되었습니다.');
  console.log('\n다음 명령어로 봇을 실행하세요:');
  console.log('  npm start');
  console.log('');
  process.exit(0);
} else {
  console.log('\n⚠️  오류를 수정한 후 다시 검증하세요:');
  console.log('  node check-setup.js');
  console.log('');
  process.exit(1);
}