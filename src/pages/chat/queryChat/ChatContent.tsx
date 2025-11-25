import { MessageItem as MessageItemType, SessionType } from "@openim/wasm-client-sdk";
import { Layout, Spin } from "antd";
import axios from "axios";
import clsx from "clsx";
import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { v4 as uuidv4 } from "uuid";

import { SystemMessageTypes } from "@/constants/im";
import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore, useUserStore } from "@/store";
import emitter from "@/utils/events";
import { getIMToken } from "@/utils/storage";

import MessageItem from "./MessageItem";
import NotificationMessage from "./NotificationMessage";
import { useHistoryMessageList } from "./useHistoryMessageList";

// 调用服务端 API 按消息序列号标记已读
const markMsgsAsReadBySeqs = async (
  userID: string,
  conversationID: string,
  seqs: number[]
) => {
  if (seqs.length === 0) return;

  try {
    const apiUrl = import.meta.env.VITE_API_URL;
    const token = await getIMToken();

    const response = await axios.post(
      `${apiUrl}/msg/mark_msgs_as_read`,
      {
        userID,
        conversationID,
        seqs,
      },
      {
        headers: {
          token,
          operationID: uuidv4(),
        },
      }
    );

    console.log("服务端标记已读成功:", response.data);
    return response.data;
  } catch (error) {
    console.error("服务端标记已读失败:", error);
    throw error;
  }
};

const ChatContent = () => {
  const virtuoso = useRef<VirtuosoHandle>(null);
  const selfUserID = useUserStore((state) => state.selfInfo.userID);
  const currentConversation = useConversationStore((state) => state.currentConversation);
  const initialUnreadCount = useConversationStore((state) => state.initialUnreadCount);
  const conversationEntryTime = useConversationStore((state) => state.conversationEntryTime);
  const [highlightMsgID, setHighlightMsgID] = useState<string>("");
  const [firstUnreadMsgID, setFirstUnreadMsgID] = useState<string>("");
  const [visibleRange, setVisibleRange] = useState<{ startIndex: number; endIndex: number }>({
    startIndex: 0,
    endIndex: 0,
  });
  const [unreadBelowCount, setUnreadBelowCount] = useState(0);
  // 跟踪用户已经查看到的最大未读消息索引
  const maxViewedUnreadIndexRef = useRef<number>(-1);
  // 跟踪是否已经滚动到底部
  const [isAtBottom, setIsAtBottom] = useState(true);
  // 跟踪是否已经执行过首次滚动到未读消息
  const hasScrolledToUnreadRef = useRef<boolean>(false);
  // 控制是否启用 followOutput（初始滚动完成前禁用）
  const [enableFollowOutput, setEnableFollowOutput] = useState(false);
  // 保存进入会话时的未读数（只在会话切换时更新）
  const savedUnreadCountRef = useRef<number>(0);
  // 跟踪上一次的 conversationID，用于检测会话切换
  const prevConversationIDRef = useRef<string | undefined>(undefined);
  // 跟踪上一次的 initLoading 状态
  const prevInitLoadingRef = useRef<boolean>(true);
  // 跟踪是否已经标记过已读（只有滚动到底部时才标记）
  const hasMarkedAsReadRef = useRef<boolean>(false);
  // 跟踪已经标记为已读的消息ID集合
  const markedMsgIDsRef = useRef<Set<string>>(new Set());
  // 跟踪上一次的 conversationEntryTime，用于检测重新进入相同会话
  const prevEntryTimeRef = useRef<number>(0);

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

  // 检测会话切换或重新进入相同会话，重置滚动状态
  const isNewConversation = conversationID !== prevConversationIDRef.current;
  const isReentryToSameConversation = !isNewConversation && conversationEntryTime !== prevEntryTimeRef.current && prevEntryTimeRef.current !== 0;

  if (isNewConversation || isReentryToSameConversation) {
    console.log("检测到会话切换或重新进入:", {
      isNewConversation,
      isReentryToSameConversation,
      from: prevConversationIDRef.current,
      to: conversationID,
      prevEntryTime: prevEntryTimeRef.current,
      newEntryTime: conversationEntryTime,
    });

    prevConversationIDRef.current = conversationID;
    prevEntryTimeRef.current = conversationEntryTime;
    maxViewedUnreadIndexRef.current = -1;
    hasScrolledToUnreadRef.current = false;
    savedUnreadCountRef.current = 0;
    prevInitLoadingRef.current = true;
    hasMarkedAsReadRef.current = false; // 重置已读标记
    markedMsgIDsRef.current = new Set(); // 重置已标记消息集合
  }

  // 首次渲染时记录 entryTime
  if (prevEntryTimeRef.current === 0 && conversationEntryTime !== 0) {
    prevEntryTimeRef.current = conversationEntryTime;
  }

  // 会话切换时禁用 followOutput 并重置状态
  useEffect(() => {
    setEnableFollowOutput(false);
    setFirstUnreadMsgID(""); // 重置第一条未读消息ID
    setHighlightMsgID(""); // 重置高亮消息ID
    hasScrolledToUnreadRef.current = false; // 重置滚动标记，允许重新处理未读消息
    console.log("会话切换/重新进入，重置状态, conversationEntryTime:", conversationEntryTime);
  }, [conversationID, conversationEntryTime]);

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

  // 使用 useLayoutEffect 在 DOM 渲染后立即滚动到未读消息
  useLayoutEffect(() => {
    console.log("滚动 useLayoutEffect 触发:", {
      initLoading: loadState.initLoading,
      hasScrolled: hasScrolledToUnreadRef.current,
      messageCount: loadState.messageList.length,
      conversationID,
      initialUnreadCount,
    });

    // 还在加载中，跳过
    if (loadState.initLoading) {
      console.log("跳过: 还在加载中");
      return;
    }

    // 如果已经滚动过，跳过
    if (hasScrolledToUnreadRef.current) {
      console.log("跳过: 已经滚动过");
      return;
    }

    const messageList = loadState.messageList;

    // 消息列表为空，跳过
    if (messageList.length === 0) {
      console.log("跳过: 消息列表为空");
      return;
    }

    const unreadCount = initialUnreadCount;
    console.log("准备处理未读消息, initialUnreadCount=", initialUnreadCount);

    savedUnreadCountRef.current = unreadCount;

    if (unreadCount === 0) {
      // 无未读，启用 followOutput 后会自动滚动到底部
      console.log("无未读消息，启用 followOutput");
      hasScrolledToUnreadRef.current = true; // 只有在确定无未读时才标记
      setEnableFollowOutput(true);
      return;
    }

    // 有未读消息，标记为已滚动（在处理之前标记，防止重复处理）
    hasScrolledToUnreadRef.current = true;
    console.log("标记为已滚动，开始处理未读消息");

    // 计算第一条未读消息的索引
    const firstUnreadIndex = Math.max(0, messageList.length - unreadCount);
    const firstUnreadMsg = messageList[firstUnreadIndex];

    console.log("计算第一条未读消息:", {
      firstUnreadIndex,
      firstUnreadMsgID: firstUnreadMsg?.clientMsgID,
      messageListLength: messageList.length,
    });

    if (firstUnreadMsg) {
      // 设置第一条未读消息ID
      console.log("设置 firstUnreadMsgID:", firstUnreadMsg.clientMsgID);
      setFirstUnreadMsgID(firstUnreadMsg.clientMsgID);

      // 使用 requestAnimationFrame 确保 DOM 已更新
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (virtuoso.current) {
            const virtuosoIndex = firstUnreadIndex + loadState.firstItemIndex;
            console.log("执行滚动到:", virtuosoIndex);
            virtuoso.current.scrollToIndex({
              index: virtuosoIndex,
              align: "start",
              behavior: "auto",
            });
          }

          setHighlightMsgID(firstUnreadMsg.clientMsgID);

          setTimeout(() => {
            setEnableFollowOutput(true);
            setHighlightMsgID("");
          }, 1000);

          // 10秒后清除提示
          setTimeout(() => {
            console.log("10秒后清除 firstUnreadMsgID");
            setFirstUnreadMsgID("");
          }, 10000);
        });
      });
    } else {
      setEnableFollowOutput(true);
    }
  }, [loadState.initLoading, loadState.messageList, loadState.firstItemIndex, initialUnreadCount, conversationID, conversationEntryTime]);

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

  // 调试日志：检查 Virtuoso 渲染时的值
  if (!loadState.initLoading) {
    const calculatedIndex = initialUnreadCount > 0
      ? Math.max(0, loadState.messageList.length - initialUnreadCount)
      : loadState.messageList.length - 1;
    console.log("准备渲染 Virtuoso:", {
      initialUnreadCount,
      messageListLength: loadState.messageList.length,
      calculatedIndex,
      conversationEntryTime,
      conversationID,
    });
  }

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
          key={`virtuoso-${conversationID}-${conversationEntryTime}`}
          id="chat-list"
          className="w-full overflow-x-hidden"
          followOutput={enableFollowOutput ? "smooth" : false}
          firstItemIndex={loadState.firstItemIndex}
          initialTopMostItemIndex={
            initialUnreadCount > 0
              ? Math.max(0, loadState.messageList.length - initialUnreadCount)
              : loadState.messageList.length - 1
          }
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

                // 跟踪用户已看到的最大消息索引
                const actualEndIndex = range.endIndex - loadState.firstItemIndex;
                if (actualEndIndex > maxViewedUnreadIndexRef.current) {
                  maxViewedUnreadIndexRef.current = actualEndIndex;
                }

                // 标记屏幕上可见的未读消息为已读
                if (conversationID && currentConversation) {
                  const actualStartIndex = Math.max(0, range.startIndex - loadState.firstItemIndex);
                  const actualEnd = Math.min(actualEndIndex, messageList.length - 1);

                  // 收集屏幕上可见的、还未标记的、不是自己发送的消息的 seq
                  const newSeqsToMark: number[] = [];
                  const newMsgIDsToMark: string[] = [];
                  for (let i = actualStartIndex; i <= actualEnd; i++) {
                    const msg = messageList[i];
                    if (
                      msg &&
                      msg.sendID !== selfUserID && // 不是自己发送的
                      msg.seq > 0 && // 有效的 seq
                      !markedMsgIDsRef.current.has(msg.clientMsgID) // 还未标记过
                    ) {
                      newSeqsToMark.push(msg.seq);
                      newMsgIDsToMark.push(msg.clientMsgID);
                      markedMsgIDsRef.current.add(msg.clientMsgID);
                    }
                  }

                  // 如果有新消息需要标记
                  if (newSeqsToMark.length > 0) {
                    console.log("标记可见消息为已读:", {
                      conversationID,
                      sessionType: currentConversation.sessionType,
                      isGroup: currentConversation.sessionType === SessionType.Group,
                      msgCount: newSeqsToMark.length,
                      seqs: newSeqsToMark,
                      msgIDs: newMsgIDsToMark,
                    });

                    // 调用服务端 API 按消息序列号标记已读（单聊和群聊都支持）
                    markMsgsAsReadBySeqs(selfUserID, conversationID, newSeqsToMark)
                      .then(() => {
                        console.log("服务端按消息标记已读成功");
                      })
                      .catch((err) => {
                        console.error("服务端按消息标记已读失败:", err);
                      });

                    // 群聊额外发送已读回执给消息发送者
                    if (currentConversation.sessionType === SessionType.Group) {
                      console.log("群聊: 发送已读回执", {
                        conversationID,
                        clientMsgIDList: newMsgIDsToMark,
                      });
                      IMSDK.sendGroupMessageReadReceipt({
                        conversationID,
                        clientMsgIDList: newMsgIDsToMark,
                      })
                        .then((res) => {
                          console.log("群聊已读回执发送成功:", res);
                        })
                        .catch((err) => {
                          console.error("群聊已读回执发送失败:", err);
                        });
                    }
                  }
                }
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
            const isFirstUnread = message.clientMsgID === firstUnreadMsgID;
            return (
              <MessageItem
                key={`${message.clientMsgID}-${isFirstUnread ? 'unread' : 'read'}`}
                conversationID={conversationID}
                message={message}
                messageUpdateFlag={message.senderNickname + message.senderFaceUrl}
                isSender={isSender}
                isHighlight={isHighlight}
                isFirstUnread={isFirstUnread}
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
