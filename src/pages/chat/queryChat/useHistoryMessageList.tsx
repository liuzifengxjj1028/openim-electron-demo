import { MessageItem, ViewType } from "@openim/wasm-client-sdk";
import { useLatest, useRequest } from "ahooks";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { IMSDK } from "@/layout/MainContentWrap";
import emitter, { emit } from "@/utils/events";

const START_INDEX = 10000;
const SPLIT_COUNT = 20;

export function useHistoryMessageList(initialUnreadCount = 0) {
  const { conversationID } = useParams();
  const [loadState, setLoadState] = useState({
    initLoading: true,
    hasMoreOld: true,
    messageList: [] as MessageItem[],
    firstItemIndex: START_INDEX,
  });
  const latestLoadState = useLatest(loadState);

  useEffect(() => {
    loadHistoryMessages();
    return () => {
      setLoadState(() => ({
        initLoading: true,
        hasMoreOld: true,
        messageList: [] as MessageItem[],
        firstItemIndex: START_INDEX,
      }));
    };
  }, [conversationID]);

  useEffect(() => {
    const pushNewMessage = (message: MessageItem) => {
      if (
        latestLoadState.current.messageList.find(
          (item) => item.clientMsgID === message.clientMsgID,
        )
      ) {
        return;
      }
      setLoadState((preState) => ({
        ...preState,
        messageList: [...preState.messageList, message],
      }));
    };
    const updateOneMessage = (message: MessageItem) => {
      const newReadCount = message.attachedInfoElem?.groupHasReadInfo?.hasReadCount;
      console.log("[updateOneMessage] ===== 收到更新请求 =====", {
        clientMsgID: message.clientMsgID,
        shortID: message.clientMsgID?.slice(-8),
        hasReadCount: newReadCount,
      });
      setLoadState((preState) => {
        const tmpList = [...preState.messageList];
        console.log("[updateOneMessage] 当前消息列表长度:", tmpList.length);

        // 打印所有本地消息的 clientMsgID 用于比较
        console.log("[updateOneMessage] 本地消息ID列表:",
          tmpList.map(m => m.clientMsgID?.slice(-8)).join(", ")
        );

        const idx = tmpList.findIndex((msg) => msg.clientMsgID === message.clientMsgID);
        if (idx < 0) {
          console.log("[updateOneMessage] ❌ 未找到消息!", {
            searchID: message.clientMsgID,
            searchIDShort: message.clientMsgID?.slice(-8),
          });
          return preState;
        }

        // 深度合并 attachedInfoElem，避免覆盖其他字段
        const existingMsg = tmpList[idx];
        const oldReadCount = existingMsg.attachedInfoElem?.groupHasReadInfo?.hasReadCount;
        console.log("[updateOneMessage] ✅ 找到消息! idx=", idx, {
          oldReadCount,
          newReadCount,
        });

        const updatedMsg = { ...existingMsg, ...message };

        // 如果更新包含 attachedInfoElem，需要深度合并
        if (message.attachedInfoElem) {
          updatedMsg.attachedInfoElem = {
            ...existingMsg.attachedInfoElem,
            ...message.attachedInfoElem,
            // 深度合并 groupHasReadInfo
            groupHasReadInfo: message.attachedInfoElem.groupHasReadInfo
              ? {
                  ...existingMsg.attachedInfoElem?.groupHasReadInfo,
                  ...message.attachedInfoElem.groupHasReadInfo,
                }
              : existingMsg.attachedInfoElem?.groupHasReadInfo,
          };
        }

        // 如果有 groupHasReadInfo 更新，同步更新顶层字段（模仿单聊的 isRead 字段）
        if (updatedMsg.attachedInfoElem?.groupHasReadInfo?.hasReadCount !== undefined) {
          (updatedMsg as any)._groupReadCount = updatedMsg.attachedInfoElem.groupHasReadInfo.hasReadCount || 0;
        }

        tmpList[idx] = updatedMsg;
        console.log("[updateOneMessage] 更新后的消息:", {
          clientMsgID: updatedMsg.clientMsgID?.slice(-8),
          newReadCount: updatedMsg.attachedInfoElem?.groupHasReadInfo?.hasReadCount,
          _groupReadCount: (updatedMsg as any)._groupReadCount,
        });

        return {
          ...preState,
          messageList: tmpList,
        };
      });
    };
    emitter.on("PUSH_NEW_MSG", pushNewMessage);
    emitter.on("UPDATE_ONE_MSG", updateOneMessage);
    return () => {
      emitter.off("PUSH_NEW_MSG", pushNewMessage);
      emitter.off("UPDATE_ONE_MSG", updateOneMessage);
    };
  }, []);

  const loadHistoryMessages = () => getMoreOldMessages(false);

  const { loading: moreOldLoading, runAsync: getMoreOldMessages } = useRequest(
    async (loadMore = true) => {
      const reqConversationID = conversationID;
      // 初始加载时，根据未读消息数决定加载数量
      // 确保加载足够的消息以包含所有未读消息
      const loadCount = !loadMore && initialUnreadCount > SPLIT_COUNT
        ? Math.max(SPLIT_COUNT, initialUnreadCount + 10)  // 多加载10条确保有上下文
        : SPLIT_COUNT;

      console.log("加载历史消息:", {
        loadMore,
        initialUnreadCount,
        loadCount,
      });

      const { data } = await IMSDK.getAdvancedHistoryMessageList({
        count: loadCount,
        startClientMsgID: loadMore
          ? latestLoadState.current.messageList[0]?.clientMsgID
          : "",
        conversationID: conversationID ?? "",
        viewType: ViewType.History,
      });
      if (conversationID !== reqConversationID) return;

      // 调试：检查消息是否有 groupHasReadInfo
      const myMsgs = data.messageList.filter((m: any) => m.attachedInfoElem?.groupHasReadInfo);
      console.log("[loadHistoryMessages] 消息总数:", data.messageList.length, "带 groupHasReadInfo 的消息数:", myMsgs.length);

      setTimeout(() =>
        setLoadState((preState) => ({
          ...preState,
          initLoading: false,
          hasMoreOld: !data.isEnd,
          messageList: [...data.messageList, ...(loadMore ? preState.messageList : [])],
          firstItemIndex: preState.firstItemIndex - data.messageList.length,
        })),
      );
    },
    {
      manual: true,
    },
  );

  // 直接更新消息的函数（不使用事件机制）- 使用 useCallback 防止无限循环
  // 支持通过 clientMsgID 或 seq 匹配消息
  const updateMessageReadStatus = useCallback((clientMsgID: string, groupHasReadInfo: any, seq?: number) => {
    setLoadState((preState) => {
      // 首先尝试通过 clientMsgID 查找
      let idx = preState.messageList.findIndex((msg) => msg.clientMsgID === clientMsgID);

      // 如果找不到，且提供了 seq，尝试通过 seq 查找
      if (idx < 0 && seq && seq > 0) {
        idx = preState.messageList.findIndex((msg) => msg.seq === seq);
        if (idx >= 0) {
          console.log("[updateMessageReadStatus] 通过 seq 匹配成功:", seq, "-> clientMsgID:", preState.messageList[idx].clientMsgID?.slice(-8));
        }
      }

      if (idx < 0) {
        return preState;
      }

      const existingMsg = preState.messageList[idx];
      const oldReadCount = existingMsg.attachedInfoElem?.groupHasReadInfo?.hasReadCount || 0;
      const newReadCount = groupHasReadInfo?.hasReadCount || 0;

      // 如果已读数没有变化，不更新（避免不必要的重渲染）
      if (oldReadCount === newReadCount && existingMsg.attachedInfoElem?.groupHasReadInfo?.groupMemberCount === groupHasReadInfo?.groupMemberCount) {
        return preState;
      }

      // 创建全新的数组（不使用 spread 以确保引用变化）
      const newList = preState.messageList.map((msg, i) => {
        if (i !== idx) return msg;
        return {
          ...msg,
          // 顶层字段，用于触发 React 变化检测（模仿单聊的 isRead 字段）
          _groupReadCount: groupHasReadInfo?.hasReadCount || 0,
          attachedInfoElem: {
            ...msg.attachedInfoElem,
            groupHasReadInfo: {
              ...msg.attachedInfoElem?.groupHasReadInfo,
              ...groupHasReadInfo,
            },
          },
        };
      });

      console.log("[updateMessageReadStatus] ✅ 更新成功:", {
        clientMsgID: clientMsgID?.slice(-8),
        oldReadCount,
        newReadCount,
        newListLength: newList.length,
        updatedMsg_groupReadCount: (newList[idx] as any)._groupReadCount,
      });

      return {
        ...preState,
        messageList: newList,
      };
    });
  }, []);

  return {
    SPLIT_COUNT,
    loadState,
    latestLoadState,
    conversationID,
    moreOldLoading,
    getMoreOldMessages,
    updateMessageReadStatus,
  };
}

export const pushNewMessage = (message: MessageItem) => emit("PUSH_NEW_MSG", message);
export const updateOneMessage = (message: MessageItem) =>
  emit("UPDATE_ONE_MSG", message);
