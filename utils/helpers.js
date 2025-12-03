/**
 * 유틸리티 헬퍼 함수들
 */

/**
 * 따옴표나 대괄호로 감싸진 이름 추출
 * @param {string} input - 입력 문자열
 * @returns {string} - 추출된 이름
 */
function extractName(input) {
  const match = input.match(/^["'\[](.*?)["'\]]$/);
  return match ? match[1] : input;
}

/**
 * 안전한 정수 변환
 * @param {any} value - 변환할 값
 * @param {number} defaultValue - 기본값
 * @returns {number} - 변환된 정수
 */
function safeParseInt(value, defaultValue = 0) {
  const parsed = parseInt(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 신드롬 한글 → 영문 변환
 * @param {string} syndrome - 한글 신드롬
 * @param {Object} translationMap - 변환 맵
 * @returns {string} - 영문 신드롬
 */
function convertSyndromeToEnglish(syndrome, translationMap) {
  return (translationMap[syndrome] || syndrome).toUpperCase();
}

/**
 * 동적 항목의 상위 항목 찾기
 * @param {string} attribute - 항목 이름
 * @param {Object} subToMainMapping - 고정 매핑
 * @param {Object} dynamicRules - 동적 규칙
 * @returns {string} - 상위 항목
 */
function getMainAttribute(attribute, subToMainMapping, dynamicRules) {
  // 고정 매핑 확인
  if (subToMainMapping[attribute]) {
    return subToMainMapping[attribute];
  }

  // 동적 규칙 확인
  for (const [prefix, mainAttr] of Object.entries(dynamicRules)) {
    if (attribute.startsWith(prefix)) {
      return mainAttr;
    }
  }

  // 자기 자신 반환 (상위 항목)
  return attribute;
}

/**
 * 콤보 침식률 조건 체크
 * @param {number} currentErosion - 현재 침식률
 * @param {string} condition - 조건 (예: '99↓', '100↑')
 * @returns {boolean} - 조건 만족 여부
 */
function checkComboCondition(currentErosion, condition) {
  if (condition.includes('↑')) {
    const threshold = parseInt(condition.replace('↑', ''));
    return currentErosion >= threshold;
  } else if (condition.includes('↓')) {
    const threshold = parseInt(condition.replace('↓', ''));
    return currentErosion <= threshold;
  }
  return false;
}

/**
 * 콤보에서 최적 조건 찾기
 * @param {number} currentErosion - 현재 침식률
 * @param {Object} combos - 콤보 조건 맵
 * @returns {Object|null} - { condition, description } 또는 null
 */
function findBestCombo(currentErosion, combos) {
  let bestMatch = null;
  let bestThreshold = -1;

  for (const [condition, description] of Object.entries(combos)) {
    if (checkComboCondition(currentErosion, condition)) {
      const threshold = parseInt(condition.replace(/[↑↓]/g, ''));
      
      // 가장 높은 임계값을 만족하는 조건 선택
      if (threshold > bestThreshold) {
        bestThreshold = threshold;
        bestMatch = { condition, description };
      }
    }
  }

  return bestMatch;
}

/**
 * 유저 멘션 생성
 * @param {string} userId - 유저 ID
 * @returns {string} - 멘션 문자열
 */
function mentionUser(userId) {
  return `<@${userId}>`;
}

/**
 * 에러 메시지 포맷팅
 * @param {string} message - 에러 메시지
 * @returns {string} - 포맷된 메시지
 */
function formatError(message) {
  return `❌ ${message}`;
}

/**
 * 성공 메시지 포맷팅
 * @param {string} message - 성공 메시지
 * @returns {string} - 포맷된 메시지
 */
function formatSuccess(message) {
  return `✅ ${message}`;
}

/**
 * 경고 메시지 포맷팅
 * @param {string} message - 경고 메시지
 * @returns {string} - 포맷된 메시지
 */
function formatWarning(message) {
  return `⚠️ ${message}`;
}

module.exports = {
  extractName,
  safeParseInt,
  convertSyndromeToEnglish,
  getMainAttribute,
  checkComboCondition,
  findBestCombo,
  mentionUser,
  formatError,
  formatSuccess,
  formatWarning
};
