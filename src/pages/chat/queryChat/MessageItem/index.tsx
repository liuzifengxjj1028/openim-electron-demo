import { MessageItem as MessageItemType, MessageType, SessionType } from "@openim/wasm-client-sdk";
import clsx from "clsx";
import { FC, memo, useCallback, useEffect, useRef, useState } from "react";

import OIMAvatar from "@/components/OIMAvatar";
import { formatMessageTime } from "@/utils/imCommon";

import CatchMessageRender from "./CatchMsgRenderer";
import GroupReadStatus from "./GroupReadStatus";
import MediaMessageRender from "./MediaMessageRender";
import styles from "./message-item.module.scss";
import MessageItemErrorBoundary from "./MessageItemErrorBoundary";
import MessageSuffix from "./MessageSuffix";
import TextMessageRender from "./TextMessageRender";

export interface IMessageItemProps {
  message: MessageItemType;
  isSender: boolean;
  disabled?: boolean;
  conversationID?: string;
  messageUpdateFlag?: string;
  isHighlight?: boolean;
  isFirstUnread?: boolean;
}

const components: Record<number, FC<IMessageItemProps>> = {
  [MessageType.TextMessage]: TextMessageRender,
  [MessageType.AtTextMessage]: TextMessageRender,
  [MessageType.PictureMessage]: MediaMessageRender,
};

const MessageItem: FC<IMessageItemProps> = ({
  message,
  disabled,
  isSender,
  conversationID,
  isHighlight = false,
  isFirstUnread = false,
}) => {
  const messageWrapRef = useRef<HTMLDivElement>(null);
  const [showMessageMenu, setShowMessageMenu] = useState(false);
  const [showUnreadIndicator, setShowUnreadIndicator] = useState(true);
  const MessageRenderComponent = components[message.contentType] || CatchMessageRender;

  // 当 isFirstUnread 变化时，重置或启动定时器
  useEffect(() => {
    if (isFirstUnread) {
      // 重置为可见状态
      setShowUnreadIndicator(true);
      // 10秒后隐藏
      const timer = setTimeout(() => {
        setShowUnreadIndicator(false);
      }, 10000);
      return () => clearTimeout(timer);
    } else {
      // 当不再是第一条未读消息时，重置状态以备下次使用
      setShowUnreadIndicator(true);
    }
  }, [isFirstUnread]);

  const closeMessageMenu = useCallback(() => {
    setShowMessageMenu(false);
  }, []);

  const canShowMessageMenu = !disabled;

  // 检查是否显示单聊已读标记：只在单聊中显示，且是自己发送的消息，且消息已被阅读
  const showSingleReadIndicator = isSender && message.sessionType === SessionType.Single && message.isRead;

  // 检查是否显示群聊已读状态：群聊中自己发送的消息
  const showGroupReadStatus = isSender && message.sessionType === SessionType.Group;

  return (
    <>
      {/* 最早未读消息提示 - 蓝色，10秒后淡出，不影响布局 */}
      {isFirstUnread && (
        <div
          className="flex w-full items-center justify-center py-2 transition-opacity duration-500"
          style={{ opacity: showUnreadIndicator ? 1 : 0 }}
        >
          <div className="flex items-center">
            <div className="h-px w-16 bg-blue-400"></div>
            <span className="mx-3 text-xs font-medium text-blue-500">最早未读消息</span>
            <div className="h-px w-16 bg-blue-400"></div>
          </div>
        </div>
      )}
      <div
        id={`chat_${message.clientMsgID}`}
        className={clsx(
          "relative flex w-full select-text px-5 py-3 transition-colors duration-300",
          isSender && "justify-end",
          isHighlight && styles["animate-container"]
        )}
      >
        <div
          className={clsx(
            styles["message-container"],
            isSender && styles["message-container-sender"],
          )}
        >
          <OIMAvatar
            size={36}
            src={message.senderFaceUrl}
            text={message.senderNickname}
            userID={message.sendID}
          />

          <div
            className={clsx(
              styles["message-wrap"]
            )}
            ref={messageWrapRef}
          >
            <div className={styles["message-profile"]}>
              <div
                title={message.senderNickname}
                className={clsx(
                  "max-w-[30%] truncate text-[var(--sub-text)]",
                  isSender ? "ml-2" : "mr-2",
                )}
              >
                {message.senderNickname}
              </div>
              <div className="text-[var(--sub-text)]">
                {formatMessageTime(message.sendTime)}
              </div>
            </div>

            <div className={styles["menu-wrap"]}>
              <MessageItemErrorBoundary message={message}>
                <MessageRenderComponent
                  message={message}
                  isSender={isSender}
                  disabled={disabled}
                />
              </MessageItemErrorBoundary>

              <MessageSuffix
                message={message}
                isSender={isSender}
                disabled={false}
                conversationID={conversationID}
              />

              {/* 单聊已读标记 - 使用与MessageSuffix相同的样式，距离气泡3px */}
              {showSingleReadIndicator && (
                <div className={`${styles.suffix} !mr-[3px]`}>
                  <span className="text-base text-green-500">✅</span>
                </div>
              )}

              {/* 群聊已读状态 */}
              {showGroupReadStatus && (
                <GroupReadStatus message={message} />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// 自定义比较函数，确保 groupHasReadInfo 变化时重新渲染
const areEqual = (prevProps: IMessageItemProps, nextProps: IMessageItemProps) => {
  // 如果消息ID不同，重新渲染
  if (prevProps.message.clientMsgID !== nextProps.message.clientMsgID) {
    console.log("[MessageItem areEqual] clientMsgID changed, re-render");
    return false;
  }

  // 检查顶层的 _groupReadCount（用于触发 React 变化检测）
  const prevGroupReadCount = (prevProps.message as any)._groupReadCount;
  const nextGroupReadCount = (nextProps.message as any)._groupReadCount;
  if (prevGroupReadCount !== nextGroupReadCount) {
    console.log("[MessageItem areEqual] _groupReadCount changed:", {
      clientMsgID: nextProps.message.clientMsgID?.slice(-8),
      prevGroupReadCount,
      nextGroupReadCount,
    });
    return false;
  }

  // 检查嵌套的 groupHasReadInfo 是否变化（兜底）
  const prevReadCount = prevProps.message.attachedInfoElem?.groupHasReadInfo?.hasReadCount;
  const nextReadCount = nextProps.message.attachedInfoElem?.groupHasReadInfo?.hasReadCount;
  if (prevReadCount !== nextReadCount) {
    console.log("[MessageItem areEqual] hasReadCount changed:", {
      clientMsgID: nextProps.message.clientMsgID?.slice(-8),
      prevReadCount,
      nextReadCount,
    });
    return false;
  }

  // 检查其他常见变化
  if (prevProps.message.status !== nextProps.message.status) {
    return false;
  }
  if (prevProps.message.isRead !== nextProps.message.isRead) {
    return false;
  }
  if (prevProps.isSender !== nextProps.isSender) {
    return false;
  }
  if (prevProps.isHighlight !== nextProps.isHighlight) {
    return false;
  }

  return true;
};

// 使用 memo 和自定义 areEqual 函数，包含 _groupReadCount 检测
export default memo(MessageItem, areEqual);
