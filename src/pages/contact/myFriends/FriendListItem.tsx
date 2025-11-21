import { FriendUserItem } from "@openim/wasm-client-sdk/lib/types/entity";
import { Popover } from "antd";
import { useState } from "react";

import OIMAvatar from "@/components/OIMAvatar";
import UserCardContent from "./UserCardContent";

const FriendListItem = ({
  friend,
  showUserCard,
  toConversation,
  closeUserCard,
}: {
  friend: FriendUserItem;
  showUserCard: (userID: string) => void;
  toConversation: (userID: string) => void;
  closeUserCard: () => void;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="flex items-center rounded-md px-3.5 pb-3 pt-2.5 transition-colors hover:bg-[var(--primary-active)] cursor-pointer"
      onClick={() => toConversation(friend.userID)}
    >
      <Popover
        content={<UserCardContent userID={friend.userID} />}
        trigger="hover"
        open={open}
        onOpenChange={setOpen}
        placement="right"
        autoAdjustOverflow={false}
        mouseEnterDelay={0.2}
        mouseLeaveDelay={0.3}
        overlayStyle={{ position: 'fixed' }}
        align={{ offset: [10, 0] }}
      >
        <div>
          <OIMAvatar src={friend.faceURL} text={friend.remark || friend.nickname} userID={friend.userID} />
        </div>
      </Popover>
      <div className="ml-3 truncate text-sm">{friend.remark || friend.nickname}</div>
    </div>
  );
};

export default FriendListItem;
