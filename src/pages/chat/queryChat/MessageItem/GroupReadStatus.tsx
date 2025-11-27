import { MessageItem as MessageItemType } from "@openim/wasm-client-sdk";
import { Avatar, List, Popover, Spin } from "antd";
import { FC, useState } from "react";

import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore, useGroupReadStatusStore } from "@/store";

import styles from "./message-item.module.scss";

interface GroupReadStatusProps {
  message: MessageItemType;
}

interface ReadUser {
  userID: string;
  nickname: string;
  faceURL: string;
}

const GroupReadStatus: FC<GroupReadStatusProps> = ({ message }) => {
  const currentGroupInfo = useConversationStore((state) => state.currentGroupInfo);

  // 分开订阅：version 变化时强制重新渲染，然后读取最新的 readStatusMap
  const version = useGroupReadStatusStore((state) => state.version);
  // 直接获取该消息的已读状态（不使用 useShallow，避免浅比较问题）
  const storeReadInfo = useGroupReadStatusStore((state) => state.readStatusMap[message.clientMsgID]);

  // 优先使用 store 中的数据，其次使用消息自带的数据
  const groupHasReadInfo = storeReadInfo || message.attachedInfoElem?.groupHasReadInfo;

  // Popover 状态
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [readUsers, setReadUsers] = useState<ReadUser[]>([]);

  // 调试：打印组件接收到的已读数
  console.log("[GroupReadStatus] 渲染:", {
    clientMsgID: message.clientMsgID?.slice(-8),
    seq: message.seq,
    storeVersion: version,
    storeHasReadCount: storeReadInfo?.hasReadCount,
    msgHasReadCount: message.attachedInfoElem?.groupHasReadInfo?.hasReadCount,
    finalHasReadCount: groupHasReadInfo?.hasReadCount,
  });

  // 直接计算，不使用 useMemo（避免缓存导致实时更新失效）
  const total = groupHasReadInfo?.groupMemberCount
    ? groupHasReadInfo.groupMemberCount - 1
    : currentGroupInfo?.memberCount
      ? Math.max(currentGroupInfo.memberCount - 1, 0)
      : 0;

  const hasReadCount = groupHasReadInfo?.hasReadCount || 0;
  const totalCount = total;
  const isAllRead = total > 0 && hasReadCount >= total;

  // 点击获取已读用户列表
  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // 优先使用 store 中的数据，其次使用消息自带的数据
    const userIDs = (storeReadInfo as any)?.hasReadUserIDList ||
                    message.attachedInfoElem?.groupHasReadInfo?.hasReadUserIDList;

    if (!userIDs || userIDs.length === 0) {
      console.log("[GroupReadStatus] 没有已读用户列表");
      return;
    }

    setOpen(true);
    setLoading(true);

    try {
      const { data } = await IMSDK.getUsersInfo(userIDs);
      setReadUsers(data.map((u: any) => ({
        userID: u.userID,
        nickname: u.nickname || u.userID,
        faceURL: u.faceURL || "",
      })));
    } catch (e) {
      console.error("[GroupReadStatus] 获取用户信息失败:", e);
    } finally {
      setLoading(false);
    }
  };

  // 如果群信息和消息中的群成员数都没有，不显示
  if (!currentGroupInfo?.memberCount && !groupHasReadInfo?.groupMemberCount) {
    return null;
  }

  // 如果总数为0，不显示
  if (totalCount <= 0) {
    return null;
  }

  // Popover 内容
  const popoverContent = (
    <div style={{ width: 200 }}>
      {/* 标题 */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid #f0f0f0",
        fontWeight: 600,
        fontSize: 14,
        color: "#333"
      }}>
        已读成员 {hasReadCount > 0 && `(${hasReadCount})`}
      </div>

      {/* 内容区域 */}
      {loading ? (
        <div style={{ padding: "24px", textAlign: "center" }}>
          <Spin size="small" />
        </div>
      ) : readUsers.length > 0 ? (
        <div style={{ maxHeight: 240, overflow: "auto", padding: "8px 0" }}>
          {readUsers.map((user) => (
            <div
              key={user.userID}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 16px",
                gap: 12,
              }}
            >
              <Avatar
                size={32}
                src={user.faceURL}
                style={{
                  backgroundColor: user.faceURL ? "transparent" : "#1890ff",
                  flexShrink: 0,
                }}
              >
                {user.nickname?.[0]?.toUpperCase()}
              </Avatar>
              <span style={{
                fontSize: 14,
                color: "#333",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {user.nickname}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          padding: "24px 16px",
          color: "#999",
          fontSize: 13,
          textAlign: "center"
        }}>
          暂无已读成员
        </div>
      )}
    </div>
  );

  return (
    <div className={`${styles.suffix} !mr-[3px]`} title="群成员已读状态">
      {isAllRead ? (
        <span className="text-xs text-green-500 whitespace-nowrap">全部已读</span>
      ) : (
        <Popover
          open={open}
          onOpenChange={setOpen}
          trigger="click"
          content={popoverContent}
          placement="topRight"
          overlayInnerStyle={{ padding: 0 }}
        >
          <span
            className="text-xs text-blue-500 font-medium whitespace-nowrap cursor-pointer hover:underline"
            onClick={handleClick}
          >
            {hasReadCount}/{totalCount}
          </span>
        </Popover>
      )}
    </div>
  );
};

// 不使用 memo，确保 store 变化时能重新渲染
export default GroupReadStatus;
