import { GroupMemberItem } from "@openim/wasm-client-sdk/lib/types/entity";
import { Empty, Spin, Modal, message } from "antd";
import { t } from "i18next";
import { FC, memo, useEffect, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { DeleteOutlined } from "@ant-design/icons";

import OIMAvatar from "@/components/OIMAvatar";
import { useCurrentMemberRole } from "@/hooks/useCurrentMemberRole";
import useGroupMembers from "@/hooks/useGroupMembers";
import { useUserStore } from "@/store";
import { IMSDK } from "@/layout/MainContentWrap";

import styles from "./group-setting.module.scss";
import { GroupMemberRole } from "@openim/wasm-client-sdk";

const GroupMemberList: FC = () => {
  const selfUserID = useUserStore((state) => state.selfInfo.userID);
  const { currentMemberInGroup } = useCurrentMemberRole();
  const { fetchState, getMemberData, resetState } = useGroupMembers();

  useEffect(() => {
    if (currentMemberInGroup?.groupID) {
      getMemberData(true);
    }
    return () => {
      resetState();
    };
  }, [currentMemberInGroup?.groupID]);

  const endReached = () => {
    getMemberData();
  };

  return (
    <div className="h-full px-2 py-2.5">
      {fetchState.groupMemberList.length === 0 ? (
        <Empty
          className="flex h-full flex-col items-center justify-center"
          description={t("empty.noSearchResults")}
        />
      ) : (
        <Virtuoso
          className="h-full overflow-x-hidden"
          data={fetchState.groupMemberList}
          endReached={endReached}
          components={{
            Header: () => (fetchState.loading ? <Spin /> : null),
          }}
          itemContent={(_, member) => (
            <MemberItem
              member={member}
              selfUserID={selfUserID}
              onDeleteMember={() => getMemberData(true)}
            />
          )}
        />
      )}
    </div>
  );
};

export default GroupMemberList;

interface IMemberItemProps {
  member: GroupMemberItem;
  selfUserID: string;
  onDeleteMember?: () => void;
}

const MemberItem = memo(({ member, onDeleteMember }: IMemberItemProps) => {
  const isOwner = member.roleLevel === GroupMemberRole.Owner;
  const { currentMemberInGroup } = useCurrentMemberRole();
  const selfUserID = useUserStore((state) => state.selfInfo.userID);

  // 判断当前用户是否有权限删除
  const canDelete =
    currentMemberInGroup?.roleLevel === GroupMemberRole.Owner ||
    currentMemberInGroup?.roleLevel === GroupMemberRole.Admin;

  // 不能删除自己和群主
  const showDeleteButton = canDelete && member.userID !== selfUserID && !isOwner;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();

    Modal.confirm({
      title: t("toast.kickMemberConfirmTitle") || "确认删除",
      content: `确定要删除成员 "${member.nickname}" 吗？`,
      okText: t("placeholder.confirm") || "确定",
      cancelText: t("placeholder.cancel") || "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await IMSDK.kickGroupMember({
            groupID: member.groupID,
            userIDList: [member.userID],
            reason: "",
          });
          message.success(t("toast.kickMemberSuccess") || "删除成功");
          onDeleteMember?.();
        } catch (error) {
          message.error(t("toast.kickMemberFailed") || "删除失败");
          console.error("删除成员失败:", error);
        }
      },
    });
  };

  return (
    <div className={styles["list-member-item"]}>
      <div className="flex items-center justify-between w-full">
        <div
          className="flex items-center overflow-hidden flex-1"
          onClick={() => window.userClick(member.userID, member.groupID)}
        >
          <OIMAvatar src={member.faceURL} text={member.nickname} userID={member.userID} />
          <div className="ml-3 flex items-center">
            <div className="max-w-[120px] truncate">{member.nickname}</div>
            {isOwner && (
              <span className="ml-2 rounded border border-[#FF9831] px-1 text-xs text-[#FF9831]">
                {t("placeholder.groupOwner")}
              </span>
            )}
          </div>
        </div>
        {showDeleteButton && (
          <button
            onClick={handleDelete}
            className="ml-2 px-3 py-1 text-red-500 hover:text-white hover:bg-red-500 border border-red-500 rounded transition-colors duration-200"
            style={{ flexShrink: 0 }}
          >
            <DeleteOutlined /> 删除
          </button>
        )}
      </div>
    </div>
  );
});
