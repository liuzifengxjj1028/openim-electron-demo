export const avatarList = [
  {
    src: new URL("@/assets/avatar/ic_avatar_01.png", import.meta.url).href,
    name: "ic_avatar_01",
  },
  {
    src: new URL("@/assets/avatar/ic_avatar_02.png", import.meta.url).href,
    name: "ic_avatar_02",
  },
  {
    src: new URL("@/assets/avatar/ic_avatar_03.png", import.meta.url).href,
    name: "ic_avatar_03",
  },
  {
    src: new URL("@/assets/avatar/ic_avatar_04.png", import.meta.url).href,
    name: "ic_avatar_04",
  },
  {
    src: new URL("@/assets/avatar/ic_avatar_05.png", import.meta.url).href,
    name: "ic_avatar_05",
  },
  {
    src: new URL("@/assets/avatar/ic_avatar_06.png", import.meta.url).href,
    name: "ic_avatar_06",
  },
];

export const getDefaultAvatar = (name: string) => {
  return avatarList.find((avator) => avator.name === name)?.src;
};

// 默认头像颜色列表：红橙黄绿青蓝
const avatarColors = [
  "#FF6B6B", // 红色
  "#FFA500", // 橙色
  "#FFD700", // 黄色
  "#4CAF50", // 绿色
  "#00BCD4", // 青色
  "#2196F3", // 蓝色
];

/**
 * 根据用户ID生成确定性的头像颜色
 * 使用简单的哈希算法，确保同一个userID总是返回相同的颜色
 */
export const getUserAvatarColor = (userID: string): string => {
  if (!userID) return avatarColors[0];

  // 简单的字符串哈希函数
  let hash = 0;
  for (let i = 0; i < userID.length; i++) {
    const char = userID.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // 取绝对值并映射到颜色数组索引
  const index = Math.abs(hash) % avatarColors.length;
  return avatarColors[index];
};

/**
 * 获取用户昵称的前3个字符作为头像文字
 */
export const getAvatarText = (nickname: string): string => {
  if (!nickname) return "";

  // 处理中文、英文和混合情况，取前3个字符
  return nickname.substring(0, 3);
};
