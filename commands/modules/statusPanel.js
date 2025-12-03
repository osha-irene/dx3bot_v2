/**
 * 상태 패널 관련 기능 모듈
 */

const { EmbedBuilder } = require('discord.js');

class StatusPanelModule {
  constructor(database) {
    this.db = database;
  }

  /**
   * !상태패널 - 서버 활성 캐릭터 패널 생성/업데이트
   */
  async createOrUpdatePanel(message) {
    const serverId = message.guild.id;
    
    // 기존 패널 메시지 ID 가져오기
    const panelMessageId = this.db.getStatusPanelId(serverId);
    
    const embed = await this.createPanelEmbed(message.guild, serverId);
    
    try {
      if (panelMessageId) {
        // 기존 패널 업데이트
        const panelMessage = await message.channel.messages.fetch(panelMessageId);
        await panelMessage.edit({ embeds: [embed] });
        
        // 확인 메시지 (5초 후 삭제)
        const confirmMsg = await message.reply('✅ 상태 패널이 업데이트되었습니다!');
        setTimeout(() => confirmMsg.delete().catch(() => {}), 5000);
      } else {
        // 새 패널 생성
        const panelMessage = await message.channel.send({ embeds: [embed] });
        
        // 패널 메시지 고정
        await panelMessage.pin();
        
        // 패널 ID 저장
        this.db.setStatusPanelId(serverId, panelMessage.id, message.channel.id);
        
        // 확인 메시지 (5초 후 삭제)
        const confirmMsg = await message.reply('✅ 상태 패널이 생성되었습니다!');
        setTimeout(() => confirmMsg.delete().catch(() => {}), 5000);
        
        // "메시지를 고정했습니다" 시스템 메시지 삭제
        const systemMessages = await message.channel.messages.fetch({ limit: 5 });
        systemMessages.forEach(msg => {
          if (msg.type === 6 && msg.author.id === message.client.user.id) {
            msg.delete().catch(() => {});
          }
        });
      }
    } catch (error) {
      console.error('상태 패널 생성/업데이트 오류:', error);
      return message.reply('❌ 상태 패널 생성 중 오류가 발생했습니다.');
    }
  }

  /**
   * 상태 패널 임베드 생성
   */
  async createPanelEmbed(guild, serverId) {
    const allUsers = this.db.getAllUsers(serverId);
    
    const embed = new EmbedBuilder()
      .setColor(0x00ff88)
      .setTitle('🎭 활성 캐릭터 현황')
      .setDescription('현재 활동 중인 캐릭터들입니다.')
      .setTimestamp();

    let activeCount = 0;
    let fieldValue = '';

    for (const [userId, userData] of Object.entries(allUsers)) {
      try {
        const member = await guild.members.fetch(userId);
        const userName = member.user.username;
        const activeCharName = this.db.getActiveCharacter(serverId, userId);
        
        if (activeCharName && userData[activeCharName]) {
          const charData = userData[activeCharName];
          const emoji = charData.emoji || '❌';
          const codeName = charData.codeName || '';
          
          fieldValue += `✅ **${userName}**\n`;
          fieldValue += `   ${emoji} **${activeCharName}** ${codeName ? `「${codeName}」` : ''}\n\n`;
          activeCount++;
        }
      } catch (error) {
        // 유저를 찾을 수 없는 경우 무시
      }
    }

    if (activeCount === 0) {
      fieldValue = '현재 활성화된 캐릭터가 없습니다.\n`!지정 "캐릭터이름"`으로 캐릭터를 활성화하세요!';
    }

    embed.addFields({
      name: `📊 활성 캐릭터 (${activeCount}명)`,
      value: fieldValue
    });

    embed.setFooter({ text: '💡 캐릭터 변경 시 자동으로 업데이트됩니다' });

    return embed;
  }

  /**
   * 상태 패널 자동 업데이트
   */
  async autoUpdate(guild, serverId) {
    const panelInfo = this.db.getStatusPanelInfo(serverId);
    if (!panelInfo) return;

    try {
      const channel = await guild.channels.fetch(panelInfo.channelId);
      if (!channel) return;

      const panelMessage = await channel.messages.fetch(panelInfo.messageId);
      if (!panelMessage) return;

      const embed = await this.createPanelEmbed(guild, serverId);
      await panelMessage.edit({ embeds: [embed] });
    } catch (error) {
      console.error('상태 패널 자동 업데이트 오류:', error);
    }
  }
}

module.exports = StatusPanelModule;