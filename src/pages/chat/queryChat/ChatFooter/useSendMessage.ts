import { MessageStatus } from "@openim/wasm-client-sdk";
import { MessageItem, WsResponse } from "@openim/wasm-client-sdk/lib/types/entity";
import { SendMsgParams } from "@openim/wasm-client-sdk/lib/types/params";
import { useCallback } from "react";

import { message } from "@/AntdGlobalComp";
import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore } from "@/store";
import { feedbackToast } from "@/utils/common";
import { emit } from "@/utils/events";

import { pushNewMessage, updateOneMessage } from "../useHistoryMessageList";

export type SendMessageParams = Partial<Omit<SendMsgParams, "message">> & {
  message: MessageItem;
  needPush?: boolean;
};

export function useSendMessage() {
  const sendMessage = useCallback(
    async ({ recvID, groupID, message: messageData, needPush }: SendMessageParams) => {
      const currentConversation = useConversationStore.getState().currentConversation;

      // 验证会话上下文是否存在
      const finalRecvID = recvID ?? currentConversation?.userID;
      const finalGroupID = groupID ?? currentConversation?.groupID;

      // 如果没有有效的收件人ID或群组ID，则无法发送消息
      if (!finalRecvID && !finalGroupID) {
        console.error("发送消息失败：没有有效的会话上下文");
        feedbackToast({
          error: "请先选择一个会话",
          msg: "发送失败"
        });
        return;
      }

      const sourceID = recvID || groupID;
      const inCurrentConversation =
        currentConversation?.userID === sourceID ||
        currentConversation?.groupID === sourceID ||
        !sourceID;
      needPush = needPush ?? inCurrentConversation;

      if (needPush) {
        pushNewMessage(messageData);
        emit("CHAT_LIST_SCROLL_TO_BOTTOM");
      }

      const options = {
        recvID: finalRecvID ?? "",
        groupID: finalGroupID ?? "",
        message: messageData,
      };

      try {
        const { data: successMessage } = await IMSDK.sendMessage(options);
        updateOneMessage(successMessage);
      } catch (error) {
        console.error("发送消息失败:", error);

        // 提供用户友好的错误提示
        feedbackToast({
          error,
          msg: "消息发送失败，请重试"
        });

        updateOneMessage({
          ...messageData,
          status: MessageStatus.Failed,
        });
      }
    },
    [],
  );

  return {
    sendMessage,
  };
}
