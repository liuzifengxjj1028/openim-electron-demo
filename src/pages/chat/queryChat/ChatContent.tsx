import { SessionType } from "@openim/wasm-client-sdk";
import { Layout, Spin } from "antd";
import clsx from "clsx";
import { memo, useEffect, useRef, useState } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import { SystemMessageTypes } from "@/constants/im";
import { useConversationStore, useUserStore } from "@/store";
import emitter from "@/utils/events";

import MessageItem from "./MessageItem";
import NotificationMessage from "./NotificationMessage";
import { useHistoryMessageList } from "./useHistoryMessageList";

const ChatContent = () => {
  const virtuoso = useRef<VirtuosoHandle>(null);
  const selfUserID = useUserStore((state) => state.selfInfo.userID);
  const currentConversation = useConversationStore((state) => state.currentConversation);
  const initialUnreadCount = useConversationStore((state) => state.initialUnreadCount);
  const [highlightMsgID, setHighlightMsgID] = useState<string>("");
  const [visibleRange, setVisibleRange] = useState<{ startIndex: number; endIndex: number }>({
    startIndex: 0,
    endIndex: 0,
  });
  const [unreadBelowCount, setUnreadBelowCount] = useState(0);
  // 跟踪用户已经查看到的最大未读消息索引
  const maxViewedUnreadIndexRef = useRef<number>(-1);
  // 跟踪是否已经滚动到底部
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToBottom = () => {
    setTimeout(() => {
      virtuoso.current?.scrollToIndex({
        index: 9999,
        align: "end",
        behavior: "auto",
      });
    });
  };

  const { SPLIT_COUNT, conversationID, loadState, moreOldLoading, getMoreOldMessages } =
    useHistoryMessageList(initialUnreadCount);

  // 在会话切换时，重置已查看的索引
  useEffect(() => {
    maxViewedUnreadIndexRef.current = -1;
    console.log("会话切换，重置已查看索引，初始未读数:", initialUnreadCount);
  }, [conversationID]);

  // 计算当前屏幕下方的未读消息数
  useEffect(() => {
    if (loadState.initLoading || !currentConversation) return;

    const messageList = loadState.messageList;
    const unreadCount = initialUnreadCount; // 使用从 store 中获取的初始未读数

    // 将 Virtuoso 的虚拟索引转换为实际数组索引
    const actualStartIndex = visibleRange.startIndex - loadState.firstItemIndex;
    const actualEndIndex = visibleRange.endIndex - loadState.firstItemIndex;

    console.log("计算未读消息:", {
      unreadCount,
      messageListLength: messageList.length,
      virtuosoRange: visibleRange,
      firstItemIndex: loadState.firstItemIndex,
      actualRange: { start: actualStartIndex, end: actualEndIndex },
    });

    if (unreadCount === 0) {
      setUnreadBelowCount(0);
      return;
    }

    // 找出未读消息的范围（使用实际数组索引）
    const firstUnreadIndex = Math.max(0, messageList.length - unreadCount);
    const lastUnreadIndex = messageList.length - 1;

    // 更新用户已查看到的最大未读消息索引
    if (actualEndIndex >= firstUnreadIndex) {
      // 用户的可视区域包含了一些未读消息
      const viewedUnreadIndex = Math.min(actualEndIndex, lastUnreadIndex);
      if (viewedUnreadIndex > maxViewedUnreadIndexRef.current) {
        maxViewedUnreadIndexRef.current = viewedUnreadIndex;
        console.log("更新已查看索引:", viewedUnreadIndex);
      }
    }

    // 统计可视区域下方的未读消息
    const startCountFrom = Math.max(firstUnreadIndex, maxViewedUnreadIndexRef.current + 1);
    let countBelowScreen = 0;
    for (let i = Math.max(startCountFrom, actualEndIndex + 1); i <= lastUnreadIndex; i++) {
      countBelowScreen++;
    }

    console.log("未读消息统计:", {
      firstUnreadIndex,
      lastUnreadIndex,
      maxViewedIndex: maxViewedUnreadIndexRef.current,
      actualEndIndex,
      countBelowScreen,
    });

    setUnreadBelowCount(countBelowScreen);
  }, [visibleRange, loadState.messageList, loadState.initLoading, loadState.firstItemIndex, initialUnreadCount]);

  // 向下滚动一屏
  const scrollOneScreen = () => {
    if (loadState.initLoading || !currentConversation) {
      return;
    }

    // 获取聊天列表容器
    const chatListElement = document.getElementById('chat-list');
    if (!chatListElement) return;

    // 获取容器的可视高度
    const viewportHeight = chatListElement.clientHeight;

    // 向下滚动一个视口高度
    chatListElement.scrollBy({
      top: viewportHeight,
      behavior: 'smooth'
    });
  };

  // 滚动到第一条未读消息并高亮
  useEffect(() => {
    if (loadState.initLoading || !currentConversation) return;

    const unreadCount = initialUnreadCount; // 使用从 store 中获取的初始未读数
    console.log("初始滚动 - 未读数:", unreadCount);

    if (unreadCount === 0) {
      // 没有未读消息，滚动到底部
      scrollToBottom();
      return;
    }

    // 找到第一条未读消息（从后往前数 unreadCount 条）
    const messageList = loadState.messageList;
    if (messageList.length === 0) return;

    // 找到第一条未读消息的实际数组索引
    const firstUnreadIndex = Math.max(0, messageList.length - unreadCount);
    const firstUnreadMsg = messageList[firstUnreadIndex];

    console.log("准备滚动到第一条未读消息:", {
      firstUnreadIndex,
      messageListLength: messageList.length,
      unreadCount,
      firstItemIndex: loadState.firstItemIndex,
    });

    if (firstUnreadMsg) {
      // 转换为 Virtuoso 的虚拟索引
      const virtuosoIndex = firstUnreadIndex + loadState.firstItemIndex;

      // 滚动到第一条未读消息（使用 auto 直接跳转，不平滑滚动）
      setTimeout(() => {
        virtuoso.current?.scrollToIndex({
          index: virtuosoIndex,
          align: "center",
          behavior: "auto",
        });

        // 高亮该消息
        setHighlightMsgID(firstUnreadMsg.clientMsgID);

        // 1秒后取消高亮
        setTimeout(() => {
          setHighlightMsgID("");
        }, 1000);
      }, 100);
    }
  }, [loadState.initLoading, conversationID, initialUnreadCount, loadState.firstItemIndex]);

  useEffect(() => {
    emitter.on("CHAT_LIST_SCROLL_TO_BOTTOM", scrollToBottom);
    return () => {
      emitter.off("CHAT_LIST_SCROLL_TO_BOTTOM", scrollToBottom);
    };
  }, []);

  const loadMoreMessage = () => {
    if (!loadState.hasMoreOld || moreOldLoading) return;

    getMoreOldMessages();
  };

  return (
    <Layout.Content
      className="relative flex h-full overflow-hidden !bg-white"
      id="chat-main"
    >
      {loadState.initLoading ? (
        <div className="flex h-full w-full items-center justify-center bg-white pt-1">
          <Spin spinning />
        </div>
      ) : (
        <Virtuoso
          id="chat-list"
          className="w-full overflow-x-hidden"
          followOutput="smooth"
          firstItemIndex={loadState.firstItemIndex}
          initialTopMostItemIndex={SPLIT_COUNT - 1}
          startReached={loadMoreMessage}
          ref={virtuoso}
          data={loadState.messageList}
          rangeChanged={(range) => {
            if (range) {
              setVisibleRange({ startIndex: range.startIndex, endIndex: range.endIndex });

              // 检测是否已经滚动到底部
              const messageList = loadState.messageList;
              if (messageList.length > 0) {
                const lastMessageIndex = loadState.firstItemIndex + messageList.length - 1;
                // 如果可视区域的结束索引接近最后一条消息，认为已经到达底部
                const isNearBottom = lastMessageIndex - range.endIndex <= 2;
                setIsAtBottom(isNearBottom);
              }
            }
          }}
          components={{
            Header: () =>
              loadState.hasMoreOld ? (
                <div
                  className={clsx(
                    "flex justify-center py-2 opacity-0",
                    moreOldLoading && "opacity-100",
                  )}
                >
                  <Spin />
                </div>
              ) : null,
          }}
          computeItemKey={(_, item) => item.clientMsgID}
          itemContent={(_, message) => {
            if (SystemMessageTypes.includes(message.contentType)) {
              return (
                <NotificationMessage key={message.clientMsgID} message={message} />
              );
            }
            const isSender = selfUserID === message.sendID;
            const isHighlight = message.clientMsgID === highlightMsgID;
            return (
              <MessageItem
                key={message.clientMsgID}
                conversationID={conversationID}
                message={message}
                messageUpdateFlag={message.senderNickname + message.senderFaceUrl}
                isSender={isSender}
                isHighlight={isHighlight}
              />
            );
          }}
        />
      )}

      {/* 向下滚动按钮 - 只在未到达底部时显示 */}
      {!isAtBottom && !loadState.initLoading && (
        <div
          className="absolute bottom-4 right-4 z-50 flex h-10 cursor-pointer items-center rounded-full bg-[#1890ff] px-4 text-white shadow-lg transition-all hover:opacity-80"
          onClick={scrollOneScreen}
          style={{ backgroundColor: '#1890ff' }}
        >
          <span className="text-sm font-medium">向下</span>
          <svg
            className="ml-2 h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      )}
    </Layout.Content>
  );
};

export default memo(ChatContent);
