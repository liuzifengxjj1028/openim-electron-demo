import { SessionType } from "@openim/wasm-client-sdk";
import { useLatest } from "ahooks";
import { Button } from "antd";
import { t } from "i18next";
import { forwardRef, ForwardRefRenderFunction, memo, useEffect, useState } from "react";

import { BusinessUserInfo, getBusinessUserInfo } from "@/api/login";
import CKEditor, { MentionFeed } from "@/components/CKEditor";
import { getCleanText } from "@/components/CKEditor/utils";
import i18n from "@/i18n";
import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore, useUserStore } from "@/store";

import SendActionBar from "./SendActionBar";
import { UserTimezoneDisplay } from "./UserTimezoneDisplay";
import { useFileMessage } from "./SendActionBar/useFileMessage";
import { useSendMessage } from "./useSendMessage";

const sendActions = [
  { label: t("placeholder.sendWithEnter"), key: "enter" },
  { label: t("placeholder.sendWithShiftEnter"), key: "enterwithshift" },
];

i18n.on("languageChanged", () => {
  sendActions[0].label = t("placeholder.sendWithEnter");
  sendActions[1].label = t("placeholder.sendWithShiftEnter");
});

const ChatFooter: ForwardRefRenderFunction<unknown, unknown> = (_, ref) => {
  const [html, setHtml] = useState("");
  const [mentionFeeds, setMentionFeeds] = useState<MentionFeed[]>([]);
  const [otherUserInfo, setOtherUserInfo] = useState<BusinessUserInfo | null>(null);
  const latestHtml = useLatest(html);

  const currentConversation = useConversationStore((state) => state.currentConversation);
  const isGroupSession = currentConversation?.conversationType === SessionType.Group;

  const { getImageMessage } = useFileMessage();
  const { sendMessage } = useSendMessage();

  // 获取对方用户信息（用于显示时区）
  useEffect(() => {
    if (isGroupSession || !currentConversation?.userID) {
      setOtherUserInfo(null);
      return;
    }

    const fetchOtherUserInfo = async () => {
      try {
        const { data } = await getBusinessUserInfo([currentConversation.userID]);
        if (data.users && data.users.length > 0) {
          setOtherUserInfo(data.users[0]);
        }
      } catch (error) {
        console.error("获取对方用户信息失败:", error);
      }
    };

    fetchOtherUserInfo();
  }, [isGroupSession, currentConversation?.userID]);

  // 获取群成员列表
  useEffect(() => {
    if (!isGroupSession || !currentConversation?.groupID) {
      setMentionFeeds([]);
      return;
    }

    const fetchGroupMembers = async () => {
      try {
        const { data } = await IMSDK.getGroupMemberList({
          groupID: currentConversation.groupID,
          filter: 0, // 0 表示获取所有成员
          offset: 0,
          count: 1000,
        });

        const feeds: MentionFeed[] = data.map((member) => ({
          id: member.userID,
          name: member.nickname || member.userID,
          avatar: member.faceURL,
        }));

        console.log("获取到的群成员列表:", feeds);
        setMentionFeeds(feeds);
      } catch (error) {
        console.error("获取群成员失败:", error);
      }
    };

    fetchGroupMembers();
  }, [isGroupSession, currentConversation?.groupID]);

  const onChange = (value: string) => {
    setHtml(value);
  };

  const enterToSend = async () => {
    const cleanText = getCleanText(latestHtml.current);
    const message = (await IMSDK.createTextMessage(cleanText)).data;
    setHtml("");
    if (!cleanText) return;

    sendMessage({ message });
  };

  return (
    <footer className="relative h-full bg-white py-px">
      <div className="flex h-full flex-col border-t border-t-[var(--gap-text)]">
        {/* 在单聊时显示对方时区时间 */}
        {!isGroupSession && currentConversation && otherUserInfo && (
          <UserTimezoneDisplay
            timezone={otherUserInfo.timezone}
            userName={currentConversation.showName}
          />
        )}
        <SendActionBar sendMessage={sendMessage} getImageMessage={getImageMessage} />
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <CKEditor
            value={html}
            mentionFeeds={mentionFeeds}
            onEnter={enterToSend}
            onChange={onChange}
          />
          <div className="flex items-center justify-end py-2 pr-3">
            <Button className="w-fit px-6 py-1" type="primary" onClick={enterToSend}>
              {t("placeholder.send")}
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default memo(forwardRef(ChatFooter));
