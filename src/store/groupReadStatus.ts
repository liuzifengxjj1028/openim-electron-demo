import { create } from "zustand";

interface GroupReadInfo {
  hasReadCount: number;
  unreadCount?: number;
  groupMemberCount?: number;
  hasReadUserIDList?: string[];
}

interface GroupReadStatusStore {
  // Record<clientMsgID, GroupReadInfo> - 使用普通对象而非 Map，与 Zustand 配合更好
  readStatusMap: Record<string, GroupReadInfo>;
  // 更新版本号，用于强制组件重新渲染
  version: number;
  // 更新单条消息的已读状态
  updateReadStatus: (clientMsgID: string, info: GroupReadInfo) => void;
  // 批量更新已读状态
  batchUpdateReadStatus: (updates: Array<{ clientMsgID: string; info: GroupReadInfo }>) => void;
  // 获取单条消息的已读状态
  getReadStatus: (clientMsgID: string) => GroupReadInfo | undefined;
  // 清除所有状态（会话切换时）
  clearAll: () => void;
}

export const useGroupReadStatusStore = create<GroupReadStatusStore>()((set, get) => ({
  readStatusMap: {},
  version: 0,

  updateReadStatus: (clientMsgID: string, info: GroupReadInfo) => {
    console.log("[GroupReadStatusStore] 更新:", clientMsgID?.slice(-8), info);
    set((state) => ({
      readStatusMap: {
        ...state.readStatusMap,
        [clientMsgID]: info,
      },
      version: state.version + 1,
    }));
  },

  batchUpdateReadStatus: (updates: Array<{ clientMsgID: string; info: GroupReadInfo }>) => {
    if (updates.length === 0) return;
    console.log("[GroupReadStatusStore] 批量更新:", updates.length, "条");
    set((state) => {
      const newMap = { ...state.readStatusMap };
      updates.forEach(({ clientMsgID, info }) => {
        newMap[clientMsgID] = info;
      });
      return { readStatusMap: newMap, version: state.version + 1 };
    });
  },

  getReadStatus: (clientMsgID: string) => {
    return get().readStatusMap[clientMsgID];
  },

  clearAll: () => {
    set({ readStatusMap: {}, version: 0 });
  },
}));
