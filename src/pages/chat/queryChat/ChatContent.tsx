import { MessageItem as MessageItemType, SessionType, ViewType } from "@openim/wasm-client-sdk";
import { Layout, Spin } from "antd";
import axios from "axios";
import clsx from "clsx";
import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { v4 as uuidv4 } from "uuid";

import { SystemMessageTypes } from "@/constants/im";
import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore, useUserStore, useGroupReadStatusStore } from "@/store";
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
  // 强制 Virtuoso 重新渲染的计数器
  const [dataVersion, setDataVersion] = useState(0);
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
  // 跟踪消息列表是否已加载（用于群聊已读轮询）
  const hasMessagesLoadedRef = useRef<boolean>(false);

  const scrollToBottom = () => {
    setTimeout(() => {
      virtuoso.current?.scrollToIndex({
        index: 9999,
        align: "end",
        behavior: "auto",
      });
    });
  };

  const { SPLIT_COUNT, conversationID, loadState, latestLoadState, moreOldLoading, getMoreOldMessages, updateMessageReadStatus } =
    useHistoryMessageList(initialUnreadCount);


  // 检测会话切换或重新进入相同会话，重置滚动状态
  const isNewConversation = conversationID !== prevConversationIDRef.current;
  const isReentryToSameConversation = !isNewConversation && conversationEntryTime !== prevEntryTimeRef.current && prevEntryTimeRef.current !== 0;

  if (isNewConversation || isReentryToSameConversation) {
    prevConversationIDRef.current = conversationID;
    prevEntryTimeRef.current = conversationEntryTime;
    maxViewedUnreadIndexRef.current = -1;
    hasScrolledToUnreadRef.current = false;
    savedUnreadCountRef.current = 0;
    prevInitLoadingRef.current = true;
    hasMarkedAsReadRef.current = false; // 重置已读标记
    markedMsgIDsRef.current = new Set(); // 重置已标记消息集合
    hasMessagesLoadedRef.current = false; // 重置消息加载标记
  }

  // 首次渲染时记录 entryTime
  if (prevEntryTimeRef.current === 0 && conversationEntryTime !== 0) {
    prevEntryTimeRef.current = conversationEntryTime;
  }

  // 会话切换时禁用 followOutput 并重置状态
  useEffect(() => {
    setEnableFollowOutput(false);
    setFirstUnreadMsgID("");
    setHighlightMsgID("");
    hasScrolledToUnreadRef.current = false;
  }, [conversationID, conversationEntryTime]);

  // 计算当前屏幕下方的未读消息数
  useEffect(() => {
    if (loadState.initLoading || !currentConversation) return;

    const messageList = loadState.messageList;
    const unreadCount = initialUnreadCount;

    const actualStartIndex = visibleRange.startIndex - loadState.firstItemIndex;
    const actualEndIndex = visibleRange.endIndex - loadState.firstItemIndex;

    if (unreadCount === 0) {
      setUnreadBelowCount(0);
      return;
    }

    // 找出未读消息的范围（使用实际数组索引）
    const firstUnreadIndex = Math.max(0, messageList.length - unreadCount);
    const lastUnreadIndex = messageList.length - 1;

    // 更新用户已查看到的最大未读消息索引
    if (actualEndIndex >= firstUnreadIndex) {
      const viewedUnreadIndex = Math.min(actualEndIndex, lastUnreadIndex);
      if (viewedUnreadIndex > maxViewedUnreadIndexRef.current) {
        maxViewedUnreadIndexRef.current = viewedUnreadIndex;
      }
    }

    // 统计可视区域下方的未读消息
    const startCountFrom = Math.max(firstUnreadIndex, maxViewedUnreadIndexRef.current + 1);
    let countBelowScreen = 0;
    for (let i = Math.max(startCountFrom, actualEndIndex + 1); i <= lastUnreadIndex; i++) {
      countBelowScreen++;
    }

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
    if (loadState.initLoading) return;
    if (hasScrolledToUnreadRef.current) return;

    const messageList = loadState.messageList;
    if (messageList.length === 0) return;

    const unreadCount = initialUnreadCount;
    savedUnreadCountRef.current = unreadCount;

    if (unreadCount === 0) {
      hasScrolledToUnreadRef.current = true;
      setEnableFollowOutput(true);
      return;
    }

    hasScrolledToUnreadRef.current = true;

    const firstUnreadIndex = Math.max(0, messageList.length - unreadCount);
    const firstUnreadMsg = messageList[firstUnreadIndex];

    if (firstUnreadMsg) {
      setFirstUnreadMsgID(firstUnreadMsg.clientMsgID);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (virtuoso.current) {
            const virtuosoIndex = firstUnreadIndex + loadState.firstItemIndex;
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

          setTimeout(() => {
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

  // 保存 updateMessageReadStatus 的 ref，避免依赖变化导致 useEffect 重复执行
  const updateMessageReadStatusRef = useRef(updateMessageReadStatus);
  updateMessageReadStatusRef.current = updateMessageReadStatus;

  // 群聊已读状态定时刷新（轮询方案）
  // 通过 HTTP API pull_msg_by_seq 获取最新的 groupHasReadInfo
  useEffect(() => {
    // 只在群聊中启用 - 检查 conversationType (SessionType.Group = 3)
    const isGroupChat = currentConversation?.conversationType === SessionType.Group;
    if (!currentConversation || !isGroupChat) {
      return;
    }

    // 还在加载中或没有 conversationID，跳过
    if (loadState.initLoading || !conversationID) {
      return;
    }

    // 等消息列表首次加载完成后再启动轮询
    // 使用 ref 跟踪，避免依赖 messageList.length 导致轮询频繁重启
    if (loadState.messageList.length > 0) {
      hasMessagesLoadedRef.current = true;
    }

    if (!hasMessagesLoadedRef.current) {
      console.log("[群聊已读刷新] 消息列表尚未加载，等待...");
      return;
    }

    console.log("[群聊已读刷新] 初始化轮询, conversationID:", conversationID);

    let isActive = true; // 用于清理时取消pending请求

    const refreshGroupReadStatus = async () => {
      if (!isActive) return;

      console.log("[群聊已读刷新] ⏰ 执行轮询 (HTTP API)...");

      try {
        // 获取自己发送的消息（使用 ref 获取最新的消息列表）
        const localMsgList = latestLoadState.current?.messageList || [];
        const myMsgs = localMsgList.filter((msg) => msg.sendID === selfUserID);

        console.log("[群聊已读刷新] 消息列表长度:", localMsgList.length, "自己的消息数:", myMsgs.length);

        if (myMsgs.length === 0) {
          console.log("[群聊已读刷新] 没有自己发送的消息，跳过");
          return;
        }

        // 获取最近的 20 条自己的消息的 seq 用于查询
        // 使用 slice(-20) 获取最后 20 条（最新的），而不是 slice(0, 20)（最旧的）
        const recentMyMsgs = myMsgs.slice(-20);
        const seqs = recentMyMsgs.map((msg) => msg.seq).filter((seq) => seq > 0);

        if (seqs.length === 0) {
          console.log("[群聊已读刷新] 没有有效的 seq，跳过");
          return;
        }

        // 检查是否有新发送的消息（seq=0 的消息）
        // 新消息可能还没有分配 seq，需要扩展查询范围
        const hasNewMessages = recentMyMsgs.some((msg) => msg.seq === 0);
        const minSeq = Math.min(...seqs);
        const maxSeq = Math.max(...seqs);
        // 如果有新消息，扩展查询范围 +50，以便捕获刚发送的消息
        // +50 是为了覆盖群内其他用户可能发送的消息导致的 seq 跳跃
        const endSeq = hasNewMessages ? maxSeq + 50 : maxSeq;

        console.log("[群聊已读刷新] seq范围:", minSeq, "-", endSeq, "hasNewMessages:", hasNewMessages, "最新消息seqs:", seqs.slice(-5));

        // 获取 token（使用正确的 localForage 存储）
        const token = await getIMToken() as string;
        if (!token) {
          console.warn("[群聊已读刷新] 未找到 token，跳过");
          return;
        }

        // 构建请求参数
        // num 应该是范围内可能的消息数量
        const seqRanges = [{
          conversationID: conversationID!,
          begin: minSeq,
          end: endSeq,
          num: endSeq - minSeq + 1,
        }];

        // 调用 HTTP API 获取最新消息数据
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:10002";
        const response = await fetch(`${apiUrl}/msg/pull_msg_by_seq`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "operationID": `poll-${Date.now()}`,
            "token": token,
          },
          body: JSON.stringify({
            userID: selfUserID,
            seqRanges: seqRanges,
          }),
        });

        if (!isActive) return;

        const result = await response.json();
        console.log("[群聊已读刷新] API 响应:", JSON.stringify(result).slice(0, 500));

        if (result.errCode !== 0) {
          console.warn("[群聊已读刷新] API 错误:", result.errMsg);
          return;
        }

        // 解析返回的消息
        const serverMsgs = result.data?.msgs?.[conversationID!]?.Msgs || [];
        console.log("[群聊已读刷新] 服务器返回消息数:", serverMsgs.length);

        let updateCount = 0;

        for (const serverMsg of serverMsgs) {
          if (!isActive) break;

          // 解析 attachedInfo
          let groupHasReadInfo = null;
          if (serverMsg.attachedInfo) {
            try {
              const attachedInfo = JSON.parse(serverMsg.attachedInfo);
              groupHasReadInfo = attachedInfo.groupHasReadInfo;
            } catch {
              // ignore
            }
          }

          if (!groupHasReadInfo) continue;

          const freshReadCount = groupHasReadInfo.hasReadCount || 0;

          // 检查是否需要更新
          const storeReadInfo = useGroupReadStatusStore.getState().readStatusMap[serverMsg.clientMsgID];
          const localMsg = localMsgList.find((m) => m.clientMsgID === serverMsg.clientMsgID);
          const localReadCount = localMsg?.attachedInfoElem?.groupHasReadInfo?.hasReadCount || 0;
          const storeReadCount = storeReadInfo?.hasReadCount ?? localReadCount;

          console.log("[群聊已读刷新] 检查消息:", {
            clientMsgID: serverMsg.clientMsgID?.slice(-8),
            seq: serverMsg.seq,
            freshReadCount,
            storeReadCount,
            needUpdate: freshReadCount !== storeReadCount,
          });

          if (freshReadCount !== storeReadCount) {
            console.log("[群聊已读刷新] 🔄 更新:", serverMsg.clientMsgID?.slice(-8), storeReadCount, "->", freshReadCount);

            // 直接更新 store（这会触发 GroupReadStatus 重新渲染）
            useGroupReadStatusStore.getState().updateReadStatus(serverMsg.clientMsgID, {
              hasReadCount: freshReadCount,
              groupMemberCount: groupHasReadInfo.groupMemberCount || 4,
              hasReadUserIDList: groupHasReadInfo.hasReadUserIDList || [],
            });

            // 同时更新 loadState（保持数据一致性）- 使用 ref 调用
            updateMessageReadStatusRef.current(serverMsg.clientMsgID, {
              hasReadCount: freshReadCount,
              hasReadUserIDList: groupHasReadInfo.hasReadUserIDList || [],
              groupMemberCount: groupHasReadInfo.groupMemberCount || 4,
            }, serverMsg.seq);
            updateCount++;
          }
        }

        if (updateCount > 0) {
          console.log("[群聊已读刷新] ✅ 更新了", updateCount, "条消息");
        }
      } catch (error: any) {
        if (isActive) {
          console.error("[群聊已读刷新] 失败:", error?.message);
        }
      }
    };

    // 延迟 500ms 再开始第一次轮询，确保消息列表完全加载
    const initialTimeoutId = setTimeout(() => {
      if (isActive) {
        refreshGroupReadStatus();
      }
    }, 500);

    // 每 3 秒刷新一次
    const intervalId = setInterval(refreshGroupReadStatus, 3000);

    return () => {
      console.log("[群聊已读刷新] 清理轮询");
      isActive = false;
      clearTimeout(initialTimeoutId);
      clearInterval(intervalId);
    };
  // 移除 loadState.messageList.length > 0 依赖，使用 hasMessagesLoadedRef 追踪状态
  // 这样可以避免消息列表变化时轮询被频繁重启
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationID, currentConversation?.conversationType, selfUserID, loadState.initLoading]);

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
          context={{ messageList: loadState.messageList, dataVersion, firstItemIndex: loadState.firstItemIndex }}
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
                      conversationType: currentConversation.conversationType,
                      isGroup: currentConversation.conversationType === SessionType.Group,
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
                    if (currentConversation.conversationType === SessionType.Group) {
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
          computeItemKey={(_, item, context) => {
            // 使用顶层 _groupReadCount 触发重新渲染（模仿单聊的 isRead 字段）
            const { dataVersion: ver } = context as { dataVersion: number };
            const readCount = (item as any)._groupReadCount ?? item.attachedInfoElem?.groupHasReadInfo?.hasReadCount ?? 0;
            return `${item.clientMsgID}-r${readCount}-v${ver}`;
          }}
          itemContent={(index, _message, context) => {
            // 直接使用 latestLoadState.current 获取最新消息（绕过 Virtuoso 缓存）
            const { dataVersion: ver } = context as { dataVersion: number };
            // 使用 latestLoadState.current.firstItemIndex 确保一致性
            const currentFirstItemIndex = latestLoadState.current?.firstItemIndex ?? 0;
            const currentMessageList = latestLoadState.current?.messageList ?? [];
            const actualIndex = index - currentFirstItemIndex;
            const message = currentMessageList[actualIndex] || _message;

            // 调试：检查消息数据
            if (message.sendID === selfUserID && message.sessionType === 3) {
              console.log("[itemContent] 渲染自己的群消息:", {
                clientMsgID: message.clientMsgID?.slice(-8),
                _groupReadCount: (message as any)._groupReadCount,
                hasReadCount: message.attachedInfoElem?.groupHasReadInfo?.hasReadCount,
                dataVersion: ver,
                index,
                actualIndex,
              });
            }

            if (SystemMessageTypes.includes(message.contentType)) {
              return (
                <NotificationMessage key={message.clientMsgID} message={message} />
              );
            }
            const isSender = selfUserID === message.sendID;
            const isHighlight = message.clientMsgID === highlightMsgID;
            const isFirstUnread = message.clientMsgID === firstUnreadMsgID;
            // 使用顶层 _groupReadCount 作为 key 的一部分
            const readCount = (message as any)._groupReadCount ?? message.attachedInfoElem?.groupHasReadInfo?.hasReadCount ?? 0;

            return (
              <MessageItem
                key={`${message.clientMsgID}-r${readCount}-v${ver}`}
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
