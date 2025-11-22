import type {
  ConversationItem,
  ConversationItem as ConversationItemType,
  MessageItem,
} from "@openim/wasm-client-sdk/lib/types/entity";
import { GroupAtType } from "@openim/wasm-client-sdk";
import { Badge } from "antd";
import clsx from "clsx";
import { t } from "i18next";
import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import OIMAvatar from "@/components/OIMAvatar";
import { useConversationStore, useUserStore } from "@/store";
import { formatConversionTime, getConversationContent } from "@/utils/imCommon";

import styles from "./conversation-item.module.scss";

interface IConversationProps {
  isActive: boolean;
  conversation: ConversationItemType;
}

const ConversationItem = ({ isActive, conversation }: IConversationProps) => {
  const navigate = useNavigate();
  const updateCurrentConversation = useConversationStore(
    (state) => state.updateCurrentConversation,
  );
  const currentUser = useUserStore((state) => state.selfInfo.userID);

  const toSpecifiedConversation = async () => {
    if (isActive) {
      return;
    }
    await updateCurrentConversation({ ...conversation });
    navigate(`/chat/${conversation.conversationID}`);
  };

  const latestMessageContent = useMemo(() => {
    let content = "";
    if (!conversation.latestMsg) {
      return "";
    }
    try {
      content = getConversationContent(
        JSON.parse(conversation.latestMsg) as MessageItem,
      );
    } catch (error) {
      content = t("messageDescription.catchMessage");
    }
    return content;
  }, [conversation.draftText, conversation.latestMsg, isActive, currentUser]);

  const latestMessageTime = formatConversionTime(conversation.latestMsgSendTime);

  // 判断是否显示@提醒标记
  const showAtMark = useMemo(() => {
    // 只有在有未读消息时才显示@标记
    if (conversation.unreadCount === 0) return false;

    // 如果 groupAtType 为 AtNormal(0)，肯定不显示@标记
    if (conversation.groupAtType === GroupAtType.AtNormal) return false;

    // 客户端二次验证:检查最新消息中的 atUserList 是否包含当前用户
    // 这是为了修复服务端bug(服务端会给所有用户设置 groupAtType=1,即使他们没有被@)
    try {
      if (conversation.latestMsg) {
        const latestMessage = JSON.parse(conversation.latestMsg) as MessageItem;

        // 如果最新消息是@消息类型
        if (latestMessage.atTextElem) {
          const atUserList = latestMessage.atTextElem.atUserList || [];

          // 检查是否 @所有人
          const isAtAll = atUserList.includes('AtAllTag');

          // 检查当前用户是否在 atUserList 中
          const isAtMe = atUserList.includes(currentUser);

          console.log('[会话@状态验证]', {
            会话名称: conversation.showName,
            groupAtType: conversation.groupAtType,
            未读数: conversation.unreadCount,
            当前用户ID: currentUser,
            atUserList: atUserList,
            isAtAll,
            isAtMe,
            最终显示: isAtAll || isAtMe
          });

          // 只有在真正被@的情况下才显示@标记
          return isAtAll || isAtMe;
        }
      }
    } catch (error) {
      console.error('[会话@状态验证失败]', error);
    }

    // 如果解析失败或不是@消息,回退到原来的逻辑
    return conversation.groupAtType === GroupAtType.AtMe ||
           conversation.groupAtType === GroupAtType.AtAllAtMe;
  }, [conversation.unreadCount, conversation.groupAtType, conversation.latestMsg, currentUser]);

  return (
    <div
      className={clsx(
        styles["conversation-item"],
        "border border-transparent",
        isActive && `bg-[var(--primary-active)]`,
      )}
      onClick={toSpecifiedConversation}
    >
      <Badge size="small" count={conversation.unreadCount}>
        <OIMAvatar
          src={conversation.faceURL}
          isgroup={Boolean(conversation.groupID)}
          text={conversation.showName}
          userID={conversation.userID}
        />
      </Badge>

      <div className="ml-3 flex h-11 flex-1 flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex-1 truncate font-medium">{conversation.showName}</div>
          <div className="ml-2 text-xs text-[var(--sub-text)]">{latestMessageTime}</div>
        </div>

        <div className="flex items-center">
          {/* @提醒标记 */}
          {showAtMark && (
            <span className="mr-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded bg-[#1890ff] text-xs font-bold text-white">
              @
            </span>
          )}
          <div className="flex min-h-[16px] flex-1 items-center overflow-hidden text-xs">
            <div
              className="truncate text-[rgba(81,94,112,0.5)]"
              dangerouslySetInnerHTML={{
                __html: latestMessageContent,
              }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(ConversationItem);
