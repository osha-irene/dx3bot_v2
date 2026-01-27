/**
 * 침식률 계산 유틸리티
 */

const config = require('../config/config');

/**
 * 침식률에 따른 침식D 계산
 * @param {number} erosion - 침식률
 * @returns {number} - 침식D
 */
function calculateErosionD(erosion) {
  for (const threshold of config.erosionThresholds) {
    if (erosion >= threshold.erosion) {
      return threshold.d;
    }
  }
  return 0;
}

/**
 * 침식D 변화 감지
 * @param {number} oldErosion - 이전 침식률
 * @param {number} newErosion - 새 침식률
 * @returns {Object} - { changed: boolean, oldD: number, newD: number }
 */
function detectErosionDChange(oldErosion, newErosion) {
  const oldD = calculateErosionD(oldErosion);
  const newD = calculateErosionD(newErosion);

  return {
    changed: oldD !== newD,
    oldD,
    newD,
    increased: newD > oldD
  };
}

/**
 * 침식D 변화 메시지 생성
 * @param {number} newErosion - 새 침식률
 * @param {Object} change - detectErosionDChange 결과
 * @returns {string|null} - 메시지 (변화 없으면 null)
 */
function getErosionDChangeMessage(newErosion, change) {
  if (!change.changed) return null;

  if (change.increased) {
    return `⚠️ 침식률이 ${newErosion}이 되어 **침식D가 ${change.oldD} → ${change.newD}**로 상승했습니다!`;
  } else {
    return `✅ 침식률이 ${newErosion}로 감소하여 **침식D가 ${change.oldD} → ${change.newD}**로 하락했습니다.`;
  }
}

module.exports = {
  calculateErosionD,
  detectErosionDChange,
  getErosionDChangeMessage
};
