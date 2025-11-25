import { useLatest } from "ahooks";
import { useCallback } from "react";

import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore, useUserStore } from "@/store";

export default function useConversationState() {
  const syncState = useUserStore((state) => state.syncState);
  const latestSyncState = useLatest(syncState);
  const currentConversation = useConversationStore(
    (state) => state.currentConversation,
  );
  const latestCurrentConversation = useLatest(currentConversation);

  // 不再自动标记已读，改为手动调用
  // 只有当用户真正看到消息（滚动到底部）时才标记已读
  const markAsRead = useCallback(() => {
    if (
      !latestCurrentConversation.current ||
      latestSyncState.current === "loading"
    )
      return;

    if (latestCurrentConversation.current.unreadCount > 0) {
      console.log("手动标记会话消息为已读:", latestCurrentConversation.current.conversationID);
      IMSDK.markConversationMessageAsRead(
        latestCurrentConversation.current.conversationID,
      );
    }
  }, []);

  return {
    currentConversation,
    markAsRead, // 暴露手动标记已读的方法
  };
}
