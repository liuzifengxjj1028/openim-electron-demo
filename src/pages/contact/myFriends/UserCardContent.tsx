import { useQuery } from "react-query";
import { Button, Divider, Spin } from "antd";
import dayjs from "dayjs";
import { t } from "i18next";
import { SessionType } from "@openim/wasm-client-sdk";
import { getBusinessUserInfo } from "@/api/login";
import { IMSDK } from "@/layout/MainContentWrap";
import OIMAvatar from "@/components/OIMAvatar";
import { useContactStore, useUserStore } from "@/store";
import { useConversationToggle } from "@/hooks/useConversationToggle";
import { useCopyToClipboard } from "react-use";
import { feedbackToast } from "@/utils/common";
import EditableContent from "@/components/EditableContent";

type FieldRow = {
  title: string;
  value: string;
  editable?: boolean;
};

const getGender = (gender: number) => {
  if (!gender) return "-";
  return gender === 1 ? t("placeholder.man") : t("placeholder.female");
};

const UserCardContent = ({ userID }: { userID: string }) => {
  const { toSpecifiedConversation } = useConversationToggle();
  const [_, copyToClipboard] = useCopyToClipboard();
  const selfInfo = useUserStore((state) => state.selfInfo);
  const isFriendUser = useContactStore(
    (state) => state.friendList.findIndex((item) => item.userID === userID) !== -1
  );

  const { data: cardInfo, isLoading } = useQuery(
    ["userCardContent", userID],
    async () => {
      const friendInfo = useContactStore
        .getState()
        .friendList.find((item) => item.userID === userID);

      if (friendInfo) {
        try {
          const {
            data: { users },
          } = await getBusinessUserInfo([userID]);
          return { ...friendInfo, ...users[0] };
        } catch (error) {
          return friendInfo;
        }
      }

      const { data } = await IMSDK.getUsersInfo([userID]);
      const userInfo = data[0] ?? {};

      try {
        const {
          data: { users },
        } = await getBusinessUserInfo([userID]);
        return { ...userInfo, ...users[0] };
      } catch (error) {
        return userInfo;
      }
    },
    {
      enabled: Boolean(userID),
      staleTime: 30000,
    }
  );

  const tryUpdateRemark = async (remark: string) => {
    try {
      await IMSDK.updateFriends({
        friendUserIDs: [userID],
        remark,
      });
    } catch (error) {
      feedbackToast({ error });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Spin size="small" />
      </div>
    );
  }

  if (!cardInfo) {
    return null;
  }

  const isSelf = cardInfo.userID === selfInfo.userID;
  let userFields: FieldRow[] = [];

  userFields.push({
    title: t("placeholder.nickName"),
    value: cardInfo.nickname || "",
  });

  const isFriend = cardInfo.remark !== undefined;

  if (isFriend) {
    userFields.push({
      title: t("placeholder.remark"),
      value: cardInfo.remark || "-",
      editable: true,
    });
  }

  if (isFriend || isSelf) {
    userFields = [
      ...userFields,
      {
        title: t("placeholder.gender"),
        value: getGender(cardInfo.gender!),
      },
      {
        title: t("placeholder.birth"),
        value: cardInfo.birth ? dayjs(cardInfo.birth).format("YYYY/M/D") : "-",
      },
      {
        title: t("placeholder.phoneNumber"),
        value: cardInfo.phoneNumber || "-",
      },
      {
        title: t("placeholder.email"),
        value: cardInfo.email || "-",
      },
    ];
  }

  const showAddFriend = !isFriendUser && !isSelf;

  return (
    <div className="flex max-h-[520px] min-h-[420px] w-[332px] flex-col overflow-hidden bg-[url(@/assets/images/common/card_bg.png)] bg-[length:332px_134px] bg-no-repeat px-5.5">
      <div className="h-[104px] min-h-[104px] w-full" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center">
          <OIMAvatar
            size={60}
            src={cardInfo?.faceURL}
            text={cardInfo?.nickname}
            userID={cardInfo?.userID}
          />
          <div className="ml-3 flex h-[60px] flex-1 flex-col justify-around overflow-hidden">
            <div className="flex w-fit max-w-[80%] items-baseline">
              <div
                className="flex-1 select-text truncate text-base font-medium text-white"
                title={cardInfo?.nickname}
              >
                {cardInfo?.nickname}
              </div>
            </div>
            <div className="flex items-center">
              <div
                className="mr-3 cursor-pointer text-xs text-[var(--sub-text)]"
                onClick={() => {
                  copyToClipboard(cardInfo?.userID ?? "");
                  feedbackToast({ msg: t("toast.copySuccess") });
                }}
              >
                {cardInfo?.userID}
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div>
            <div className="my-4 text-[var(--sub-text)]">{t("placeholder.personalInfo")}</div>
            {userFields.map((fieldRow, idx) => (
              <div className="my-4 flex items-center text-xs" key={idx}>
                <div className="w-24 text-[var(--sub-text)]">{fieldRow.title}</div>
                {fieldRow.editable ? (
                  <EditableContent
                    className="!ml-0"
                    textClassName="font-medium"
                    value={fieldRow.value}
                    editable={true}
                    onChange={tryUpdateRemark}
                  />
                ) : (
                  <div className="flex-1 select-text truncate">{fieldRow.value}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mx-1 mb-6 mt-3 flex items-center gap-6">
        {showAddFriend && (
          <Button
            type="primary"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              // 触发添加好友逻辑
            }}
          >
            {t("placeholder.addFriends")}
          </Button>
        )}
        {!isSelf && (
          <Button
            type="primary"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              toSpecifiedConversation({
                sourceID: userID,
                sessionType: SessionType.Single,
              });
            }}
          >
            {t("placeholder.sendMessage")}
          </Button>
        )}
      </div>
    </div>
  );
};

export default UserCardContent;
