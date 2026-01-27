/**
 * 관리자 명령어
 */

const { formatError, formatSuccess } = require('../utils/helpers');
const config = require('../config/config');

class AdminCommands {
  constructor(database, client) {
    this.db = database;
    this.client = client;
  }

  /**
   * !업데이트 [type] [메시지]
   */
  async update(message, args) {
    if (message.author.id !== config.discord.botOwnerId) {
      return message.channel.send(formatError('이 명령어는 봇 소유자만 사용할 수 있습니다.'));
    }

    const updateType = args[0] || "patch";
    const announcementMessage = args.slice(1).join(' ');

    const newVersion = this.db.updateVersion(updateType);
    const versionString = `v${newVersion.major}.${newVersion.minor}.${newVersion.patch}`;
    const finalMessage = `📢 **DX3bot 업데이트: ${versionString}**\n${announcementMessage || "새로운 기능이 추가되었습니다!"}`;

    // 모든 서버에 공지 전송
    let successCount = 0;
    let failCount = 0;

    for (const guild of this.client.guilds.cache.values()) {
      try {
        const defaultChannel = guild.channels.cache.find(channel =>
          channel.type === 0 && channel.permissionsFor(this.client.user).has("SendMessages")
        );

        if (defaultChannel) {
          await defaultChannel.send(finalMessage);
          successCount++;
        } else {
          const owner = await guild.fetchOwner();
          if (owner) {
            await owner.send(finalMessage);
            successCount++;
          } else {
            failCount++;
          }
        }
      } catch (error) {
        console.error(`❌ 서버 "${guild.name}"에 공지를 보내는 중 오류 발생:`, error.message);
        failCount++;
      }
    }

    // 봇 소유자에게도 DM 전송
    try {
      const botOwner = await this.client.users.fetch(config.discord.botOwnerId);
      if (botOwner) {
        await botOwner.send(finalMessage);
      }
    } catch (error) {
      console.error('❌ 봇 소유자 DM 전송 실패:', error.message);
    }

    return message.channel.send(
      formatSuccess(`업데이트 완료! 현재 버전: ${versionString}`) + '\n' +
      `📤 성공: ${successCount}개 서버 | ❌ 실패: ${failCount}개 서버`
    );
  }

  /**
   * !리셋 [항목]
   */
  async reset(message, args) {
    const serverId = message.guild.id;
    const userId = message.author.id;
    const activeCharName = this.db.getActiveCharacter(serverId, userId);

    if (!activeCharName) {
      return message.reply(formatError('활성화된 캐릭터가 없습니다.'));
    }

    if (args.length === 0) {
      // 전체 리셋
      this.db.deleteCharacter(serverId, userId, activeCharName);
      
      const combos = this.db.getCombos(serverId, userId, activeCharName);
      for (const comboName of Object.keys(combos)) {
        this.db.deleteCombo(serverId, userId, activeCharName, comboName);
      }

      return message.channel.send(formatSuccess(`**${activeCharName}**의 모든 데이터가 초기화되었습니다.`));
    }

    const resetType = args.join(' ').toLowerCase();

    if (resetType === "콤보") {
      const combos = this.db.getCombos(serverId, userId, activeCharName);
      for (const comboName of Object.keys(combos)) {
        this.db.deleteCombo(serverId, userId, activeCharName, comboName);
      }
      return message.channel.send(formatSuccess(`**${activeCharName}**의 모든 콤보가 삭제되었습니다.`));
    }

    if (resetType === "로이스") {
      const characterData = this.db.getCharacter(serverId, userId, activeCharName);
      if (characterData) {
        characterData.lois = [];
        this.db.setCharacter(serverId, userId, activeCharName, characterData);
        return message.channel.send(formatSuccess(`**${activeCharName}**의 모든 로이스가 삭제되었습니다.`));
      }
    }

    if (resetType === "이펙트") {
      const characterData = this.db.getCharacter(serverId, userId, activeCharName);
      if (characterData && characterData.effects) {
        delete characterData.effects;
        this.db.setCharacter(serverId, userId, activeCharName, characterData);
        return message.channel.send(formatSuccess(`**${activeCharName}**의 모든 이펙트가 삭제되었습니다.`));
      } else {
        return message.channel.send(formatError(`**${activeCharName}**에게 등록된 이펙트가 없습니다.`));
      }
    }

    // 특정 속성 리셋
    const characterData = this.db.getCharacter(serverId, userId, activeCharName);
    if (characterData && characterData[resetType] !== undefined) {
      delete characterData[resetType];
      this.db.setCharacter(serverId, userId, activeCharName, characterData);
      return message.channel.send(formatSuccess(`**${activeCharName}**의 '${resetType}' 데이터가 초기화되었습니다.`));
    } else {
      return message.channel.send(formatError(`**${activeCharName}**의 '${resetType}' 데이터를 찾을 수 없습니다.`));
    }
  }
}

module.exports = AdminCommands;
