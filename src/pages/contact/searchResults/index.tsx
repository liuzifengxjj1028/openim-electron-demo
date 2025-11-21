import { SessionType } from "@openim/wasm-client-sdk";
import { FriendUserItem, GroupItem } from "@openim/wasm-client-sdk/lib/types/entity";
import { Empty, Tabs } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";

import { useConversationToggle } from "@/hooks/useConversationToggle";
import { useContactStore } from "@/store";
import { emit } from "@/utils/events";

import FriendListItem from "../myFriends/FriendListItem";
import GroupListItem from "../myGroups/GroupListItem";

type SearchResultItem = {
  type: "friend" | "group";
  data: FriendUserItem | GroupItem;
};

export const SearchResults = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("q") || "";

  const friendList = useContactStore((state) => state.friendList);
  const groupList = useContactStore((state) => state.groupList);
  const { toSpecifiedConversation } = useConversationToggle();

  // 搜索逻辑 - 支持多字段搜索
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { friends: [], groups: [] };

    const query = searchQuery.toLowerCase().trim();

    // 搜索好友 - 搜索字段: nickname, remark, userID, phoneNumber, email
    const friends = friendList.filter((friend) => {
      return (
        friend.nickname?.toLowerCase().includes(query) ||
        friend.remark?.toLowerCase().includes(query) ||
        friend.userID?.toLowerCase().includes(query) ||
        friend.phoneNumber?.toLowerCase().includes(query) ||
        friend.email?.toLowerCase().includes(query)
      );
    });

    // 搜索群组 - 搜索字段: groupName, groupID
    const groups = groupList.filter((group) => {
      return (
        group.groupName?.toLowerCase().includes(query) ||
        group.groupID?.toLowerCase().includes(query)
      );
    });

    return { friends, groups };
  }, [searchQuery, friendList, groupList]);

  const showUserCard = (userID: string) => {
    emit("OPEN_USER_CARD", { userID });
  };

  const toConversation = (userID: string) => {
    toSpecifiedConversation({
      sourceID: userID,
      sessionType: SessionType.Single,
    });
  };

  const showGroupCard = (group: GroupItem) => {
    emit("OPEN_GROUP_CARD", group);
  };

  const closeUserCard = () => {
    emit("CLOSE_USER_CARD");
  };

  const totalResults = searchResults.friends.length + searchResults.groups.length;

  const tabItems = [
    {
      key: "all",
      label: `${t("placeholder.all")} (${totalResults})`,
      children: (
        <div className="h-full overflow-y-auto">
          {totalResults === 0 ? (
            <Empty className="mt-[30%]" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Virtuoso
              className="h-full"
              data={[
                ...searchResults.friends.map((f) => ({ type: "friend" as const, data: f })),
                ...searchResults.groups.map((g) => ({ type: "group" as const, data: g })),
              ]}
              itemContent={(_, item) => {
                if (item.type === "friend") {
                  return (
                    <FriendListItem
                      key={item.data.userID}
                      friend={item.data as FriendUserItem}
                      showUserCard={showUserCard}
                      toConversation={toConversation}
                      closeUserCard={closeUserCard}
                    />
                  );
                }
                return (
                  <GroupListItem
                    key={item.data.groupID}
                    source={item.data as GroupItem}
                    showGroupCard={showGroupCard}
                  />
                );
              }}
            />
          )}
        </div>
      ),
    },
    {
      key: "friends",
      label: `${t("placeholder.friends")} (${searchResults.friends.length})`,
      children: (
        <div className="h-full overflow-y-auto">
          {searchResults.friends.length === 0 ? (
            <Empty className="mt-[30%]" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Virtuoso
              className="h-full"
              data={searchResults.friends}
              itemContent={(_, friend) => (
                <FriendListItem
                  key={friend.userID}
                  friend={friend}
                  showUserCard={showUserCard}
                  toConversation={toConversation}
                  closeUserCard={closeUserCard}
                />
              )}
            />
          )}
        </div>
      ),
    },
    {
      key: "groups",
      label: `${t("placeholder.groups")} (${searchResults.groups.length})`,
      children: (
        <div className="h-full overflow-y-auto">
          {searchResults.groups.length === 0 ? (
            <Empty className="mt-[30%]" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Virtuoso
              className="h-full"
              data={searchResults.groups}
              itemContent={(_, group) => (
                <GroupListItem
                  key={group.groupID}
                  source={group}
                  showGroupCard={showGroupCard}
                />
              )}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <div className="m-5.5 text-base font-extrabold">
        {t("placeholder.searchResults")}: "{searchQuery}"
      </div>
      <div className="flex-1 overflow-hidden px-2">
        <Tabs
          defaultActiveKey="all"
          items={tabItems}
          className="h-full [&_.ant-tabs-content]:h-full [&_.ant-tabs-tabpane]:h-full"
          tabBarStyle={{ marginBottom: 0 }}
        />
      </div>
    </div>
  );
};
