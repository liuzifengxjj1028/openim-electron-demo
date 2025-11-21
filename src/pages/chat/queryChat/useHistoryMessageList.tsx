import { MessageItem, ViewType } from "@openim/wasm-client-sdk";
import { useLatest, useRequest } from "ahooks";
import { useEffect, useState } from "react";
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
      setLoadState((preState) => {
        const tmpList = [...preState.messageList];
        const idx = tmpList.findIndex((msg) => msg.clientMsgID === message.clientMsgID);
        if (idx < 0) {
          return preState;
        }

        tmpList[idx] = { ...tmpList[idx], ...message };
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

  return {
    SPLIT_COUNT,
    loadState,
    latestLoadState,
    conversationID,
    moreOldLoading,
    getMoreOldMessages,
  };
}

export const pushNewMessage = (message: MessageItem) => emit("PUSH_NEW_MSG", message);
export const updateOneMessage = (message: MessageItem) =>
  emit("UPDATE_ONE_MSG", message);
