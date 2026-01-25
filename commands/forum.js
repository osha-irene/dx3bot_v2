/**
 * 포럼 관련 명령어
 * 캐릭터 시트 포럼 게시판 관리
 */

const { ChannelType } = require('discord.js');
const { formatError, formatSuccess, formatWarning } = require('../utils/helpers');
const { createCharacterSheetEmbed } = require('./modules/embedSheet');

class ForumCommands {
  constructor(database, client) {
    this.db = database;
    this.client = client;
  }

  /**
   * !포럼설정 [채널멘션 또는 ID] - 캐릭터 시트 포럼 채널 설정
   */
  async setForumChannel(message, args) {
    const serverId = message.guild.id;

    // 채널 멘션 또는 ID 파싱
    let channelId = null;
    
    if (args.length > 0) {
      // <#123456789> 형태의 멘션에서 ID 추출
      const mention = args[0].match(/^<#(\d+)>$/);
      if (mention) {
        channelId = mention[1];
      } else if (/^\d+$/.test(args[0])) {
        // 숫자만 있으면 ID로 간주
        channelId = args[0];
      }
    }

    if (!channelId) {
      return message.channel.send(
        formatError('사용법: `!포럼설정 #채널` 또는 `!포럼설정 [채널ID]`') + '\n\n' +
        '**예시:**\n' +
        '`!포럼설정 #캐릭터-시트`\n' +
        '`!포럼설정 1234567890123456789`'
      );
    }

    // 채널 가져오기
    const channel = message.guild.channels.cache.get(channelId);

    if (!channel) {
      return message.channel.send(formatError('해당 채널을 찾을 수 없습니다.'));
    }

    // 포럼 채널인지 확인
    if (channel.type !== ChannelType.GuildForum) {
      return message.channel.send(
        formatError(`<#${channelId}>는 포럼 채널이 아닙니다.`) + '\n\n' +
        '💡 Discord에서 포럼 채널을 만든 후 다시 시도하세요.'
      );
    }

    // DB에 저장
    this.db.setSheetForumChannel(serverId, channelId);

    return message.channel.send(
      formatSuccess('캐릭터 시트 포럼 채널이 설정되었습니다!') + '\n' +
      `📋 포럼 채널: <#${channelId}>\n\n` +
      '이제 `!시트등록` 명령어를 사용하면 자동으로 포럼에 캐릭터 시트 게시물이 생성됩니다!'
    );
  }

  /**
   * !포럼확인 - 현재 설정된 포럼 채널 확인
   */
  async checkForumChannel(message) {
    const serverId = message.guild.id;
    const forumChannelId = this.db.getSheetForumChannel(serverId);

    if (!forumChannelId) {
      return message.channel.send(
        formatWarning('아직 포럼 채널이 설정되지 않았습니다.') + '\n\n' +
        '`!포럼설정 #채널` 명령어로 포럼 채널을 설정하세요.'
      );
    }

    const channel = message.guild.channels.cache.get(forumChannelId);

    if (!channel) {
      return message.channel.send(
        formatWarning('설정된 포럼 채널을 찾을 수 없습니다.') + '\n' +
        '채널이 삭제되었을 수 있습니다. `!포럼설정`으로 다시 설정하세요.'
      );
    }

    return message.channel.send(
      formatSuccess('현재 설정된 포럼 채널') + '\n' +
      `📋 <#${forumChannelId}>\n\n` +
      '`!시트등록` 명령어 사용 시 이 포럼에 게시물이 생성됩니다.'
    );
  }

  /**
   * !포럼해제 - 포럼 채널 설정 해제
   */
  async clearForumChannel(message) {
    const serverId = message.guild.id;
    const forumChannelId = this.db.getSheetForumChannel(serverId);

    if (!forumChannelId) {
      return message.channel.send(formatWarning('설정된 포럼 채널이 없습니다.'));
    }

    this.db.setSheetForumChannel(serverId, null);

    return message.channel.send(
      formatSuccess('포럼 채널 설정이 해제되었습니다.') + '\n' +
      '이제 `!시트등록` 사용 시 포럼에 게시물이 생성되지 않습니다.'
    );
  }

  /**
   * 포럼에 캐릭터 시트 게시물 생성
   * @param {Guild} guild - Discord 서버
   * @param {string} serverId - 서버 ID
   * @param {string} userId - 유저 ID
   * @param {Object} characterData - 캐릭터 데이터
   * @returns {Object|null} - { threadId, messageId } 또는 null
   */
  async createCharacterSheetThread(guild, serverId, userId, characterData) {
    try {
      const forumChannelId = this.db.getSheetForumChannel(serverId);

      if (!forumChannelId) {
        console.log('⚠️ 포럼 채널이 설정되지 않음');
        return null;
      }

      const forumChannel = guild.channels.cache.get(forumChannelId);

      if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
        console.log('⚠️ 포럼 채널을 찾을 수 없음');
        return null;
      }

      // 기존 스레드가 있는지 확인
      const existingThread = this.db.getCharacterSheetThread(serverId, userId, characterData.characterName);
      
      if (existingThread && existingThread.threadId) {
        console.log(`♻️ 기존 스레드 업데이트: ${existingThread.threadId}`);
        
        try {
          const thread = await forumChannel.threads.fetch(existingThread.threadId);
          if (thread) {
            // 기존 스레드의 첫 메시지 업데이트
            const message = await thread.fetchStarterMessage();
            if (message) {
              const embed = createCharacterSheetEmbed(characterData, userId);
              await message.edit({ embeds: [embed] });
              console.log(`✅ 기존 스레드 업데이트 완료`);
              return existingThread;
            }
          }
        } catch (error) {
          console.log(`⚠️ 기존 스레드 업데이트 실패, 새로 생성: ${error.message}`);
        }
      }

      // 캐릭터 시트 임베드 생성
      const embed = createCharacterSheetEmbed(characterData, userId);

      // 포럼에 스레드 생성
      const thread = await forumChannel.threads.create({
        name: `${characterData.emoji || '📝'} ${characterData.characterName}`,
        message: {
          embeds: [embed]
        }
      });

      console.log(`✅ 포럼 스레드 생성 완료: ${thread.id}`);

      // 스레드 ID와 메시지 ID 저장
      const starterMessage = await thread.fetchStarterMessage();
      const result = {
        threadId: thread.id,
        messageId: starterMessage.id
      };

      this.db.setCharacterSheetThread(serverId, userId, characterData.characterName, thread.id, starterMessage.id);

      return result;

    } catch (error) {
      console.error('포럼 스레드 생성 오류:', error);
      return null;
    }
  }

  /**
   * 포럼 스레드 업데이트
   * @param {Guild} guild - Discord 서버
   * @param {string} serverId - 서버 ID
   * @param {string} userId - 유저 ID
   * @param {Object} characterData - 캐릭터 데이터
   */
  async updateCharacterSheetThread(guild, serverId, userId, characterData) {
    try {
      const threadInfo = this.db.getCharacterSheetThread(serverId, userId, characterData.characterName);

      if (!threadInfo || !threadInfo.threadId) {
        console.log('⚠️ 업데이트할 스레드가 없음');
        return false;
      }

      const forumChannelId = this.db.getSheetForumChannel(serverId);
      if (!forumChannelId) return false;

      const forumChannel = guild.channels.cache.get(forumChannelId);
      if (!forumChannel) return false;

      const thread = await forumChannel.threads.fetch(threadInfo.threadId);
      if (!thread) return false;

      const message = await thread.fetchStarterMessage();
      if (!message) return false;

      const embed = createCharacterSheetEmbed(characterData, userId);
      await message.edit({ embeds: [embed] });

      console.log(`✅ 포럼 스레드 업데이트 완료: ${threadInfo.threadId}`);
      return true;

    } catch (error) {
      console.error('포럼 스레드 업데이트 오류:', error);
      return false;
    }
  }
}

module.exports = ForumCommands;
