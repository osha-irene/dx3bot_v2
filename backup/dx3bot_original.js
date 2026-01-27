const fs = require('fs');  // fs 모듈 추가
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { token } = require('./config.json');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

let sheetData = {}; // 캐릭터 데이터 저장
let activeCharacter = {}; // 유저별 활성 캐릭터 저장

const mainAttributes = ['육체', '감각', '정신', '사회'];
const subToMainMapping = {
  '백병': '육체',
  '회피': '육체',
  '운전: 전차': '육체',
  '사격': '감각',
  '지각': '감각',
  '예술: 음악': '감각',
  'RC': '정신',
  '의지': '정신',
  '지식: 역사': '정신',
  '교섭': '사회',
  '조달': '사회',
  '정보: 기술': '사회',
};

// 데이터 저장 함수
function setCharacterData(characterName, attribute, value) {
  if (!sheetData[characterName]) sheetData[characterName] = {};
  sheetData[characterName][attribute] = value;
}

// 데이터 가져오기 함수
function getCharacterData(characterName, attribute) {
  if (!sheetData[characterName] || !(attribute in sheetData[characterName])) {
    return null; // 값이 없을 경우 null 반환
  }
  return sheetData[characterName][attribute];
}

// 봇이 준비됐을 때 표시할 메시지
client.once(Events.ClientReady, readyClient => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// 새로운 사용자가 입장했을 때 처리
client.on(Events.GuildMemberAdd, async (member) => {
  const channel = member.guild.channels.cache.find(ch => ch.name === 'data' && ch.isTextBased());
  if (!channel) return;

  channel.send(
    `안녕하세요, ${member.user.tag}님! 서버에 오신 것을 환영합니다. 😄\n\n` +
    `이 봇을 사용하려면 먼저 \`!시트입력 [캐릭터 이름] [항목] [값]\` 형식으로 데이터를 입력해야 합니다.\n` +
    `예시: \`!시트입력 캐릭터1 육체 1 감각 2 정신 3 사회 4\`\n\n` +
    `### **봇 사용법**\n\n` +
    `1. **시트입력**: \`!시트입력 [캐릭터 이름] [항목] [값]\` 형식으로 캐릭터의 능력치를 설정할 수 있습니다.\n` +
    `   예시: \`!시트입력 캐릭터1 육체 1 감각 2 정신 3 사회 4\`\n\n` +
    `   * **항목**: \`육체\`, \`감각\`, \`정신\`, \`사회\` 등의 상위 항목과, 하위 항목들 (예: \`백병\`, \`사격\`, \`지식: 역사\`)을 설정할 수 있습니다.\n` +
    `2. **판정**: \`!판정 [상위항목(육체/감각/정신/사회) 또는 하위항목]\` 명령어를 사용하여 능력치를 기반으로 판정을 내릴 수 있습니다.\n` +
    `   예시: \`!판정 육체\` 또는 \`!판정 백병\`\n\n` +
    `3. **지정**: \`!지정 [캐릭터 이름]\` 명령어를 사용하여 현재 활동 중인 캐릭터를 설정할 수 있습니다.\n` +
    `   예시: \`!지정 캐릭터1\`` 
  );
});

// 메시지 처리 이벤트
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // !도움 명령어 처리
  if (message.content.startsWith('!도움')) {
    const userMention = `<@${message.author.id}>`; // 유저를 멘션하기 위한 값
    message.channel.send(
      `${userMention}님, 봇 사용법에 대한 안내를 드립니다. 😄\n\n` +
      `### **봇 사용법**\n\n` +
      `1. **시트입력**: \`!시트입력 [캐릭터 이름] [항목] [값]\` 형식으로 캐릭터의 능력치를 설정할 수 있습니다.\n` +
      `   예시: \`!시트입력 캐릭터1 육체 1 감각 2 정신 3 사회 4\`\n\n` +
      `   * **항목**: \`육체\`, \`감각\`, \`정신\`, \`사회\` 등의 상위 항목과, 하위 항목들 (예: \`백병\`, \`사격\`, \`지식: 역사\`)을 설정할 수 있습니다.\n` +
      `2. **판정**: \`!판정 [상위항목(육체/감각/정신/사회) 또는 하위항목]\` 명령어를 사용하여 능력치를 기반으로 판정을 내릴 수 있습니다.\n` +
      `   예시: \`!판정 육체\` 또는 \`!판정 백병\`\n\n` +
      `3. **지정**: \`!지정 [캐릭터 이름]\` 명령어를 사용하여 현재 활동 중인 캐릭터를 설정할 수 있습니다.\n` +
      `   예시: \`!지정 캐릭터1\`` 
    );
  }

  // !등침 혹은 !등장침식 명령어 처리
  if (message.content.startsWith('!등침') || message.content.startsWith('!등장침식')) {
    const randomRoll = Math.floor(Math.random() * 10) + 1; // 1d10 랜덤값
    const activeCharacterName = activeCharacter[message.author.id];
    if (activeCharacterName) {
      message.channel.send(`${randomRoll} 등장침식 판정 결과: ${activeCharacterName}`);
    } else {
      message.channel.send(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 [캐릭터 이름]\` 명령어로 캐릭터를 지정해주세요.`);
    }
  }

  // !침식률 및 !HP 수정
  if (message.content.startsWith('!침식률') || message.content.startsWith('!HP')) {
    const args = message.content.split(' ');
    if (args.length !== 2) {
      return message.channel.send('사용법: !침식률 [값] 또는 !HP [값]');
    }

    const activeCharacterName = activeCharacter[message.author.id];
    if (!activeCharacterName) {
      return message.channel.send(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 [캐릭터 이름]\` 명령어로 캐릭터를 지정해주세요.`);
    }

    const characterData = sheetData[activeCharacterName];
    const statType = args[0].slice(0, -1); // '침식률' 또는 'HP' 추출
    const changeValue = parseInt(args[1]);

    if (isNaN(changeValue)) {
      return message.channel.send(`변경 값은 숫자여야 합니다. ${args[1]}는 유효하지 않습니다.`);
    }

    // 값 수정
    if (!characterData[statType]) {
      characterData[statType] = 0;
    }

    characterData[statType] += changeValue;
    message.channel.send(`${activeCharacterName}의 ${statType}가 ${changeValue}만큼 변동되었습니다. 현재 ${statType}: ${characterData[statType]}`);
  }

  // !시트확인 명령어 처리
  if (message.content.startsWith('!시트확인')) {
    const activeCharacterName = activeCharacter[message.author.id];
    if (!activeCharacterName) {
      return message.channel.send(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 [캐릭터 이름]\` 명령어로 캐릭터를 지정해주세요.`);
    }

    const characterData = sheetData[activeCharacterName];
    let response = `현재 활성 캐릭터: ${activeCharacterName} (${message.author.tag})\n`;
    for (const attribute in characterData) {
      response += `${attribute}: ${characterData[attribute]}\n`;
    }
    message.channel.send(response);
  }

  // !지정해제 명령어 처리
  if (message.content === '!지정해제') { // 정확히 !지정해제인지 확인
    const userId = message.author.id;

    // 사용자가 지정된 캐릭터가 있는지 확인
    if (!activeCharacter[userId]) {
      return message.channel.send(`<@${userId}>님, 활성화된 캐릭터가 없습니다. \`!지정 [캐릭터 이름]\` 명령어로 캐릭터를 지정해주세요.`);
    }

    // 활성 캐릭터를 해제하고 알려줍니다.
    const prevCharacter = activeCharacter[userId];
    delete activeCharacter[userId];
    message.channel.send(`<@${userId}>님, ${prevCharacter} 캐릭터를 해제했습니다.`);
  }

  // !캐릭터리셋 명령어 처리
  if (message.content.startsWith('!캐릭터리셋')) {
    const args = message.content.split(' ').slice(1);
    const activeCharacterName = activeCharacter[message.author.id];

    if (!activeCharacterName) {
      return message.channel.send(`${message.author.tag}님, 활성화된 캐릭터가 없습니다.`);
    }

    if (args.length === 0) {
      // 모든 데이터 리셋
      sheetData[activeCharacterName] = {};
      message.channel.send(`${activeCharacterName}의 모든 값이 리셋되었습니다.`);
    } else {
      const attribute = args[0];
      if (sheetData[activeCharacterName][attribute]) {
        delete sheetData[activeCharacterName][attribute];
        message.channel.send(`${activeCharacterName}의 ${attribute} 값이 리셋되었습니다.`);
      } else {
        message.channel.send(`${activeCharacterName}에 ${attribute} 값이 존재하지 않습니다.`);
      }
    }
  }

  // !시트입력 명령어
  if (message.content.startsWith('!시트입력')) {
    const args = message.content.split(' ').slice(1);
    if (args.length < 3 || args.length % 2 === 0) {
      return message.channel.send('사용법: !시트입력 [캐릭터 이름] [항목1] [값1] [항목2] [값2] ...');
    }

    const characterName = args[0];
    for (let i = 1; i < args.length; i += 2) {
      const attribute = args[i];
      const value = parseInt(args[i + 1]);

      if (isNaN(value)) {
        return message.channel.send(`값은 숫자여야 합니다. ${args[i + 1]}는 유효하지 않습니다.`);
      }

      setCharacterData(characterName, attribute, value);
    }

    message.channel.send(`${characterName}의 항목들이 설정되었습니다.`);
  }

  // !판정 명령어 처리
  if (message.content.startsWith('!판정')) {
    const args = message.content.split(' ').slice(1);
    if (args.length < 1) {
      return message.channel.send('사용법: !판정 [항목]');
    }

    let attribute = args[0];
    let activeCharacterName = activeCharacter[message.author.id];

    if (activeCharacterName) {
      // 해당하는 상위 항목을 찾아서 그 값을 가져옴
      const mainAttr = subToMainMapping[attribute] || attribute;
      const mainValue = sheetData[activeCharacterName][mainAttr];
      const subValue = sheetData[activeCharacterName][attribute];

      if (mainValue !== undefined && subValue !== undefined) {
        // 상위항목값과 하위항목값을 결합하여 출력 (mainValue는 dx 값, subValue는 추가값)
        message.channel.send(`${mainValue}dx+${subValue}  ${attribute} 판정 <@${message.author.id}>`);
      } else {
        message.channel.send(`${activeCharacterName} ${attribute} 값을 찾을 수 없습니다.`);
      }
    } else {
      message.channel.send(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 [캐릭터 이름]\` 명령어로 캐릭터를 지정해주세요.`);
    }
  }

  // !지정 명령어 처리
  if (message.content.startsWith('!지정')) {
    const args = message.content.split(' ').slice(1);
    const characterName = args.join(' ');

    if (!sheetData[characterName]) {
      return message.channel.send(`캐릭터 "${characterName}"의 데이터가 없습니다.`);
    }

    activeCharacter[message.author.id] = characterName;
    message.channel.send(`${characterName}님을 활성 캐릭터로 지정했습니다.`);
  }
});

// 봇 로그인
client.login(token);
