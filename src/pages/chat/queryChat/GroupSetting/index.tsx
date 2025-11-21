import { Drawer } from "antd";
import { t } from "i18next";
import { forwardRef, ForwardRefRenderFunction, memo, useRef, useState, useEffect } from "react";

import { OverlayVisibleHandle, useOverlayVisible } from "@/hooks/useOverlayVisible";
import { useLatestCallback } from "@/hooks/useLatestCallback";
import { on, off } from "@/utils/events";

import GroupMemberList from "./GroupMemberList";
import GroupMemberListHeader from "./GroupMemberListHeader";
import GroupSettings from "./GroupSettings";

const GroupSetting: ForwardRefRenderFunction<OverlayVisibleHandle, unknown> = (
  _,
  ref,
) => {
  const [isPreviewMembers, setIsPreviewMembers] = useState(false);

  const { isOverlayOpen, closeOverlay } = useOverlayVisible(ref);

  const closePreviewMembers = () => {
    setIsPreviewMembers(false);
  };

  const openMemberList = useLatestCallback(() => {
    setIsPreviewMembers(true);
  });

  useEffect(() => {
    on("OPEN_GROUP_MEMBER_LIST", openMemberList);
    return () => {
      off("OPEN_GROUP_MEMBER_LIST", openMemberList);
    };
  }, []);

  return (
    <Drawer
      title={
        !isPreviewMembers ? (
          t("placeholder.setting")
        ) : (
          <GroupMemberListHeader back2Settings={closePreviewMembers} />
        )
      }
      destroyOnClose
      placement="right"
      rootClassName="chat-drawer"
      onClose={closeOverlay}
      afterOpenChange={(visible) => {
        if (!visible) {
          closePreviewMembers();
        }
      }}
      open={isOverlayOpen}
      maskClassName="opacity-0"
      maskMotion={{
        visible: false,
      }}
      width={460}
      getContainer={"#chat-container"}
    >
      {!isPreviewMembers ? (
        <GroupSettings
          closeOverlay={closeOverlay}
          updateTravel={() => setIsPreviewMembers(true)}
        />
      ) : (
        <GroupMemberList />
      )}
    </Drawer>
  );
};

export default memo(forwardRef(GroupSetting));
