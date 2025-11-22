import { SessionType, CbEvents } from "@openim/wasm-client-sdk";
import { GroupMemberItem, WSEvent } from "@openim/wasm-client-sdk/lib/types/entity";
import { useLatest } from "ahooks";
import { Button } from "antd";
import { t } from "i18next";
import { forwardRef, ForwardRefRenderFunction, memo, useEffect, useState } from "react";

import { BusinessUserInfo, getBusinessUserInfo } from "@/api/login";
import CKEditor, { MentionFeed } from "@/components/CKEditor";
import { getCleanText, extractMentions } from "@/components/CKEditor/utils";
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
  const latestMentionFeeds = useLatest(mentionFeeds);

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
    console.log('[useEffect触发] isGroupSession:', isGroupSession, 'groupID:', currentConversation?.groupID);

    if (!isGroupSession || !currentConversation?.groupID) {
      console.log('[useEffect] 清空mentionFeeds，原因：', !isGroupSession ? '不是群聊' : '没有groupID');
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
        console.log('[setMentionFeeds] 设置mentionFeeds，数量:', feeds.length);
        setMentionFeeds(feeds);
      } catch (error) {
        console.error("获取群成员失败:", error);
      }
    };

    fetchGroupMembers();
  }, [isGroupSession, currentConversation?.groupID]);

  // 监听群成员变化,实时更新@列表
  useEffect(() => {
    if (!isGroupSession || !currentConversation?.groupID) {
      return;
    }

    const groupID = currentConversation.groupID;

    const handleGroupMemberAdded = ({ data }: WSEvent<GroupMemberItem>) => {
      // 只处理当前群组的成员变化
      if (data.groupID === groupID) {
        console.log('[群成员增加]', data);
        // 重新获取群成员列表
        IMSDK.getGroupMemberList({
          groupID,
          filter: 0,
          offset: 0,
          count: 1000,
        }).then(({ data }) => {
          const feeds: MentionFeed[] = data.map((member) => ({
            id: member.userID,
            name: member.nickname || member.userID,
            avatar: member.faceURL,
          }));
          console.log('[群成员增加后] 更新mentionFeeds，数量:', feeds.length);
          setMentionFeeds(feeds);
        }).catch((error) => {
          console.error("重新获取群成员失败:", error);
        });
      }
    };

    const handleGroupMemberDeleted = ({ data }: WSEvent<GroupMemberItem>) => {
      // 只处理当前群组的成员变化
      if (data.groupID === groupID) {
        console.log('[群成员减少]', data);
        // 重新获取群成员列表
        IMSDK.getGroupMemberList({
          groupID,
          filter: 0,
          offset: 0,
          count: 1000,
        }).then(({ data }) => {
          const feeds: MentionFeed[] = data.map((member) => ({
            id: member.userID,
            name: member.nickname || member.userID,
            avatar: member.faceURL,
          }));
          console.log('[群成员减少后] 更新mentionFeeds，数量:', feeds.length);
          setMentionFeeds(feeds);
        }).catch((error) => {
          console.error("重新获取群成员失败:", error);
        });
      }
    };

    // 注册事件监听
    IMSDK.on(CbEvents.OnGroupMemberAdded, handleGroupMemberAdded);
    IMSDK.on(CbEvents.OnGroupMemberDeleted, handleGroupMemberDeleted);

    // 清理函数:组件卸载或群组变化时移除监听
    return () => {
      IMSDK.off(CbEvents.OnGroupMemberAdded, handleGroupMemberAdded);
      IMSDK.off(CbEvents.OnGroupMemberDeleted, handleGroupMemberDeleted);
    };
  }, [isGroupSession, currentConversation?.groupID]);

  const onChange = (value: string) => {
    setHtml(value);
  };

  const enterToSend = async () => {
    const cleanText = getCleanText(latestHtml.current);

    // 先验证内容是否为空，再执行后续操作
    if (!cleanText || !cleanText.trim()) {
      return;
    }

    // 提取@信息
    const mentionedUserNames = extractMentions(latestHtml.current);

    let messageData;

    if (mentionedUserNames.length > 0) {
      // 将用户名映射到用户ID
      const atUserIDList: string[] = [];
      const atUsersInfo: Array<{atUserID: string; groupNickname: string}> = [];
      const currentMentionFeeds = latestMentionFeeds.current;

      console.log('[映射调试] mentionedUserNames:', mentionedUserNames);
      console.log('[映射调试] currentMentionFeeds:', currentMentionFeeds);

      mentionedUserNames.forEach((userName) => {
        if (userName === "所有人") {
          // @所有人
          atUserIDList.push("AtAllTag");
          atUsersInfo.push({
            atUserID: "AtAllTag",
            groupNickname: "所有人"
          });
          console.log('[映射调试] 添加所有人: AtAllTag');
        } else {
          // 从mentionFeeds中查找对应的用户ID
          const member = currentMentionFeeds.find((m) => m.name === userName);
          console.log(`[映射调试] 查找用户 "${userName}":`, member);

          if (member && member.id) {
            atUserIDList.push(member.id);
            atUsersInfo.push({
              atUserID: member.id,
              groupNickname: member.name
            });
            console.log(`[映射调试] 找到用户ID: ${member.id}`);
          } else {
            console.error(`[映射调试] 未找到用户 "${userName}" 的ID`);
          }
        }
      });

      console.log('[发送@消息]', {
        text: cleanText,
        mentionedUserNames,
        atUserIDList,
        atUsersInfo,
      });

      // 使用createTextAtMessage发送@消息
      const result = await IMSDK.createTextAtMessage({
        text: cleanText,
        atUserIDList,
        atUsersInfo,
      });

      console.log('[createTextAtMessage返回结果]', {
        fullResult: result,
        dataField: result.data,
        dataType: typeof result.data
      });

      messageData = result.data;
    } else {
      // 普通文本消息
      messageData = (await IMSDK.createTextMessage(cleanText)).data;
    }

    setHtml("");
    sendMessage({ message: messageData });
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
