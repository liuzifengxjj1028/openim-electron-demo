import {
  ConversationItem,
  GroupItem,
  GroupMemberItem,
  MessageItem,
} from "@openim/wasm-client-sdk/lib/types/entity";
import { t } from "i18next";
import { create } from "zustand";

import { IMSDK } from "@/layout/MainContentWrap";
import { feedbackToast } from "@/utils/common";
import { conversationSort, isGroupSession } from "@/utils/imCommon";

import { ConversationListUpdateType, ConversationStore } from "./type";
import { useUserStore } from "./user";

const CONVERSATION_SPLIT_COUNT = 500;

export const useConversationStore = create<ConversationStore>()((set, get) => ({
  conversationList: [],
  currentConversation: undefined,
  unReadCount: 0,
  currentGroupInfo: undefined,
  currentMemberInGroup: undefined,
  initialUnreadCount: 0,
  conversationEntryTime: 0, // 追踪每次进入会话的时间
  getConversationListByReq: async (isOffset?: boolean) => {
    let tmpConversationList = [] as ConversationItem[];
    try {
      const { data } = await IMSDK.getConversationListSplit({
        offset: isOffset ? get().conversationList.length : 0,
        count: CONVERSATION_SPLIT_COUNT,
      });
      tmpConversationList = data;
    } catch (error) {
      feedbackToast({ error, msg: t("toast.getConversationFailed") });
      return true;
    }
    set((state) => ({
      conversationList: [
        ...(isOffset ? state.conversationList : []),
        ...tmpConversationList,
      ],
    }));
    return tmpConversationList.length === CONVERSATION_SPLIT_COUNT;
  },
  updateConversationList: (
    list: ConversationItem[],
    type: ConversationListUpdateType,
  ) => {
    // 如果更新的会话是当前会话，只更新会话数据，不更新 conversationEntryTime 和 initialUnreadCount
    const idx = list.findIndex(
      (c) => c.conversationID === get().currentConversation?.conversationID,
    );
    if (idx > -1) {
      // 只更新 currentConversation，不触发完整的 updateCurrentConversation
      set(() => ({ currentConversation: { ...list[idx] } }));
    }

    if (type === "filter") {
      set((state) => ({
        conversationList: conversationSort(
          [...list, ...state.conversationList],
          state.conversationList,
        ),
      }));
      return;
    }
    let filterArr: ConversationItem[] = [];
    const chids = list.map((ch) => ch.conversationID);
    filterArr = get().conversationList.filter(
      (tc) => !chids.includes(tc.conversationID),
    );

    set(() => ({ conversationList: conversationSort([...list, ...filterArr]) }));
  },
  updateCurrentConversation: async (
    conversation?: ConversationItem,
    isJump?: boolean,
  ) => {
    if (!conversation) {
      set(() => ({
        currentConversation: undefined,
        quoteMessage: undefined,
        currentGroupInfo: undefined,
        currentMemberInGroup: undefined,
        initialUnreadCount: 0,
      }));
      return;
    }
    const prevConversation = get().currentConversation;

    const toggleNewConversation =
      conversation.conversationID !== prevConversation?.conversationID;

    // 每次进入会话时都保存未读数和进入时间
    // 这样即使重新进入相同会话，也能触发重新处理
    const entryTime = Date.now();
    console.log("进入会话，保存初始未读数:", conversation.unreadCount, "进入时间:", entryTime);
    set(() => ({
      initialUnreadCount: conversation.unreadCount,
      conversationEntryTime: entryTime,
    }));

    if (toggleNewConversation && isGroupSession(conversation.conversationType)) {
      get().getCurrentGroupInfoByReq(conversation.groupID);
      await get().getCurrentMemberInGroupByReq(conversation.groupID);
    }
    set(() => ({ currentConversation: { ...conversation } }));
  },
  getUnReadCountByReq: async () => {
    try {
      const { data } = await IMSDK.getTotalUnreadMsgCount();
      set(() => ({ unReadCount: data }));
      return data;
    } catch (error) {
      console.error(error);
      return 0;
    }
  },
  updateUnReadCount: (count: number) => {
    set(() => ({ unReadCount: count }));
  },
  getCurrentGroupInfoByReq: async (groupID: string) => {
    let groupInfo: GroupItem;
    try {
      const { data } = await IMSDK.getSpecifiedGroupsInfo([groupID]);
      groupInfo = data[0];
    } catch (error) {
      feedbackToast({ error, msg: t("toast.getGroupInfoFailed") });
      return;
    }
    set(() => ({ currentGroupInfo: { ...groupInfo } }));
  },
  updateCurrentGroupInfo: (groupInfo: GroupItem) => {
    set(() => ({ currentGroupInfo: { ...groupInfo } }));
  },
  getCurrentMemberInGroupByReq: async (groupID: string) => {
    let memberInfo: GroupMemberItem;
    const selfID = useUserStore.getState().selfInfo.userID;
    try {
      const { data } = await IMSDK.getSpecifiedGroupMembersInfo({
        groupID,
        userIDList: [selfID],
      });
      memberInfo = data[0];
    } catch (error) {
      set(() => ({ currentMemberInGroup: undefined }));
      feedbackToast({ error, msg: t("toast.getGroupMemberFailed") });
      return;
    }
    set(() => ({ currentMemberInGroup: memberInfo ? { ...memberInfo } : undefined }));
  },
  setCurrentMemberInGroup: (memberInfo?: GroupMemberItem) => {
    set(() => ({ currentMemberInGroup: memberInfo }));
  },
  tryUpdateCurrentMemberInGroup: (member: GroupMemberItem) => {
    const currentMemberInGroup = get().currentMemberInGroup;
    if (
      member.groupID === currentMemberInGroup?.groupID &&
      member.userID === currentMemberInGroup?.userID
    ) {
      set(() => ({ currentMemberInGroup: { ...member } }));
    }
  },
  clearConversationStore: () => {
    set(() => ({
      conversationList: [],
      currentConversation: undefined,
      unReadCount: 0,
      currentGroupInfo: undefined,
      currentMemberInGroup: undefined,
      quoteMessage: undefined,
      initialUnreadCount: 0,
      conversationEntryTime: 0,
    }));
  },
}));
