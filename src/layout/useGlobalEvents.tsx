import { CbEvents, LogLevel } from "@openim/wasm-client-sdk";
import { MessageType, SessionType } from "@openim/wasm-client-sdk";
import {
  BlackUserItem,
  ConversationItem,
  FriendApplicationItem,
  FriendUserItem,
  GroupApplicationItem,
  GroupItem,
  GroupMemberItem,
  GroupMessageReceiptInfo,
  MessageItem,
  ReceiptInfo,
  RevokedInfo,
  SelfUserInfo,
  WSEvent,
  WsResponse,
} from "@openim/wasm-client-sdk/lib/types/entity";
import { t } from "i18next";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { CustomType } from "@/constants";
import {
  pushNewMessage,
  updateOneMessage,
} from "@/pages/chat/queryChat/useHistoryMessageList";
import { useConversationStore, useUserStore } from "@/store";
import { useContactStore } from "@/store/contact";
import { feedbackToast } from "@/utils/common";
import { initStore } from "@/utils/imCommon";
import { clearIMProfile, getIMToken, getIMUserID } from "@/utils/storage";
import { notificationManager } from "@/utils/notification";

import { IMSDK } from "./MainContentWrap";

export function useGlobalEvent() {
  const navigate = useNavigate();
  const resume = useRef(false);

  // user
  const updateSyncState = useUserStore((state) => state.updateSyncState);
  const updateProgressState = useUserStore((state) => state.updateProgressState);
  const updateReinstallState = useUserStore((state) => state.updateReinstallState);
  const updateIsLogining = useUserStore((state) => state.updateIsLogining);
  const updateConnectState = useUserStore((state) => state.updateConnectState);
  const updateSelfInfo = useUserStore((state) => state.updateSelfInfo);
  const userLogout = useUserStore((state) => state.userLogout);
  // conversation
  const updateConversationList = useConversationStore(
    (state) => state.updateConversationList,
  );
  const updateUnReadCount = useConversationStore((state) => state.updateUnReadCount);
  const updateCurrentGroupInfo = useConversationStore(
    (state) => state.updateCurrentGroupInfo,
  );
  const getCurrentGroupInfoByReq = useConversationStore(
    (state) => state.getCurrentGroupInfoByReq,
  );
  const setCurrentMemberInGroup = useConversationStore(
    (state) => state.setCurrentMemberInGroup,
  );
  const getCurrentMemberInGroupByReq = useConversationStore(
    (state) => state.getCurrentMemberInGroupByReq,
  );
  const tryUpdateCurrentMemberInGroup = useConversationStore(
    (state) => state.tryUpdateCurrentMemberInGroup,
  );
  const getConversationListByReq = useConversationStore(
    (state) => state.getConversationListByReq,
  );
  const getUnReadCountByReq = useConversationStore(
    (state) => state.getUnReadCountByReq,
  );
  // contact
  const getFriendListByReq = useContactStore((state) => state.getFriendListByReq);
  const getGroupListByReq = useContactStore((state) => state.getGroupListByReq);
  const updateFriend = useContactStore((state) => state.updateFriend);
  const pushNewFriend = useContactStore((state) => state.pushNewFriend);
  const updateBlack = useContactStore((state) => state.updateBlack);
  const pushNewBlack = useContactStore((state) => state.pushNewBlack);
  const updateGroup = useContactStore((state) => state.updateGroup);
  const pushNewGroup = useContactStore((state) => state.pushNewGroup);
  const updateRecvFriendApplication = useContactStore(
    (state) => state.updateRecvFriendApplication,
  );
  const updateSendFriendApplication = useContactStore(
    (state) => state.updateSendFriendApplication,
  );
  const updateRecvGroupApplication = useContactStore(
    (state) => state.updateRecvGroupApplication,
  );
  const updateSendGroupApplication = useContactStore(
    (state) => state.updateSendGroupApplication,
  );

  useEffect(() => {
    loginCheck();
    setIMListener();
    setIpcListener();

    window.addEventListener("online", () => {
      IMSDK.networkStatusChanged();
    });
    window.addEventListener("offline", () => {
      IMSDK.networkStatusChanged();
    });

    // Register notification permission change handler
    notificationManager.onPermissionChange(async (permission) => {
      if (permission === "denied") {
        const isElectron = notificationManager.isElectronEnvironment();

        if (isElectron) {
          // Electron environment: Test system notification
          const systemWorking = await notificationManager.testSystemNotification();

          if (!systemWorking) {
            feedbackToast({
              msg: "系统通知已被关闭",
              error: "您的 macOS 系统设置中关闭了通知权限。\n\n请在控制台运行以下命令打开系统设置：\nwindow.electronAPI.openNotificationSettings()\n\n或手动前往：系统设置 → 通知 → OpenIM → 开启通知",
              duration: 15000,
            });
          } else {
            feedbackToast({
              msg: "浏览器通知权限已被关闭",
              error: "请点击地址栏左侧图标，选择「网站设置」→「通知」→「允许」",
              duration: 10000,
            });
          }
        } else {
          // Web browser environment
          feedbackToast({
            msg: "通知权限已被关闭",
            error: "您已关闭消息通知权限。如需重新启用：\n\n1. 点击地址栏左侧的锁图标\n2. 选择「网站设置」\n3. 找到「通知」\n4. 改为「允许」",
            duration: 10000,
          });
        }
      }
    });

    return () => {
      disposeIMListener();
      notificationManager.stopPermissionMonitoring();
    };
  }, []);

  const loginCheck = async () => {
    const IMToken = (await getIMToken()) as string;
    const IMUserID = (await getIMUserID()) as string;
    if (!IMToken || !IMUserID) {
      clearIMProfile();
      navigate("/login");
      return;
    }
    tryLogin();
  };

  const tryLogin = async () => {
    updateIsLogining(true);
    const IMToken = (await getIMToken()) as string;
    const IMUserID = (await getIMUserID()) as string;
    try {
      const apiAddr = import.meta.env.VITE_API_URL;
      const wsAddr = import.meta.env.VITE_WS_URL;
      if (window.electronAPI) {
        await IMSDK.initSDK({
          platformID: window.electronAPI?.getPlatform() ?? 5,
          apiAddr,
          wsAddr,
          dataDir: window.electronAPI.getDataPath("sdkResources") || "./",
          logFilePath: window.electronAPI.getDataPath("logsPath") || "./",
          logLevel: LogLevel.Debug,
          isLogStandardOutput: false,
          systemType: "electron",
        });
        await IMSDK.login({
          userID: IMUserID,
          token: IMToken,
        });
      } else {
        await IMSDK.login({
          userID: IMUserID,
          token: IMToken,
          platformID: 5,
          apiAddr,
          wsAddr,
          logLevel: LogLevel.Debug,
        });
      }
      initStore();
      // Request notification permission after successful login
      setTimeout(async () => {
        const granted = await notificationManager.requestPermission();

        // If permission is denied, show a helpful message
        if (!granted && notificationManager.getSettings().permission === "denied") {
          const isElectron = notificationManager.isElectronEnvironment();

          if (isElectron) {
            // Test if system notifications work
            const systemWorking = await notificationManager.testSystemNotification();

            if (!systemWorking) {
              feedbackToast({
                msg: "系统通知权限被阻止",
                error: "macOS 系统设置中关闭了通知权限。\n\n快捷方式：在控制台运行\nwindow.electronAPI.openNotificationSettings()\n\n手动设置：系统设置 → 通知 → OpenIM → 开启通知",
                duration: 15000,
              });
            }
          } else {
            feedbackToast({
              msg: "通知权限已被阻止",
              error: "无法接收消息通知。请按以下步骤启用：\n\n1. 点击地址栏左侧的锁图标\n2. 选择「网站设置」\n3. 找到「通知」\n4. 改为「允许」",
              duration: 10000,
            });
          }
        }
      }, 1000);
    } catch (error) {
      console.error(error);
      if ((error as WsResponse).errCode !== 10102) {
        navigate("/login");
      }
    }
    updateIsLogining(false);
  };

  const setIMListener = () => {
    // account
    IMSDK.on(CbEvents.OnSelfInfoUpdated, selfUpdateHandler);
    IMSDK.on(CbEvents.OnConnecting, connectingHandler);
    IMSDK.on(CbEvents.OnConnectFailed, connectFailedHandler);
    IMSDK.on(CbEvents.OnConnectSuccess, connectSuccessHandler);
    IMSDK.on(CbEvents.OnKickedOffline, kickHandler);
    IMSDK.on(CbEvents.OnUserTokenExpired, expiredHandler);
    IMSDK.on(CbEvents.OnUserTokenInvalid, expiredHandler);
    // sync
    IMSDK.on(CbEvents.OnSyncServerStart, syncStartHandler);
    IMSDK.on(CbEvents.OnSyncServerProgress, syncProgressHandler);
    IMSDK.on(CbEvents.OnSyncServerFinish, syncFinishHandler);
    IMSDK.on(CbEvents.OnSyncServerFailed, syncFailedHandler);
    // message
    IMSDK.on(CbEvents.OnRecvNewMessages, newMessageHandler);
    IMSDK.on(CbEvents.OnNewRecvMessageRevoked, revokedMessageHandler);
    IMSDK.on(CbEvents.OnRecvC2CReadReceipt, c2cReadReceiptHandler);
    IMSDK.on(CbEvents.OnRecvGroupReadReceipt, groupReadReceiptHandler);
    // conversation
    IMSDK.on(CbEvents.OnConversationChanged, conversationChnageHandler);
    IMSDK.on(CbEvents.OnNewConversation, newConversationHandler);
    IMSDK.on(CbEvents.OnTotalUnreadMessageCountChanged, totalUnreadChangeHandler);
    // friend
    IMSDK.on(CbEvents.OnFriendInfoChanged, friednInfoChangeHandler);
    IMSDK.on(CbEvents.OnFriendAdded, friednAddedHandler);
    IMSDK.on(CbEvents.OnFriendDeleted, friednDeletedHandler);
    // blacklist
    IMSDK.on(CbEvents.OnBlackAdded, blackAddedHandler);
    IMSDK.on(CbEvents.OnBlackDeleted, blackDeletedHandler);
    // group
    IMSDK.on(CbEvents.OnJoinedGroupAdded, joinedGroupAddedHandler);
    IMSDK.on(CbEvents.OnJoinedGroupDeleted, joinedGroupDeletedHandler);
    IMSDK.on(CbEvents.OnGroupDismissed, joinedGroupDismissHandler);
    IMSDK.on(CbEvents.OnGroupInfoChanged, groupInfoChangedHandler);
    IMSDK.on(CbEvents.OnGroupMemberAdded, groupMemberAddedHandler);
    IMSDK.on(CbEvents.OnGroupMemberDeleted, groupMemberDeletedHandler);
    IMSDK.on(CbEvents.OnGroupMemberInfoChanged, groupMemberInfoChangedHandler);
    // application
    IMSDK.on(CbEvents.OnFriendApplicationAdded, friendApplicationProcessedHandler);
    IMSDK.on(CbEvents.OnFriendApplicationAccepted, friendApplicationProcessedHandler);
    IMSDK.on(CbEvents.OnFriendApplicationRejected, friendApplicationProcessedHandler);
    IMSDK.on(CbEvents.OnGroupApplicationAdded, groupApplicationProcessedHandler);
    IMSDK.on(CbEvents.OnGroupApplicationAccepted, groupApplicationProcessedHandler);
    IMSDK.on(CbEvents.OnGroupApplicationRejected, groupApplicationProcessedHandler);
  };

  const selfUpdateHandler = ({ data }: WSEvent<SelfUserInfo>) => {
    updateSelfInfo(data);
  };
  const connectingHandler = () => {
    updateConnectState("loading");
    console.log("connecting...");
  };
  const connectFailedHandler = ({ errCode, errMsg }: WSEvent) => {
    updateConnectState("failed");
    console.error("connectFailedHandler", errCode, errMsg);

    if (errCode === 705) {
      tryOut(t("toast.loginExpiration"));
    }
  };
  const connectSuccessHandler = () => {
    updateConnectState("success");
    console.log("connect success...");
  };
  const kickHandler = () => tryOut(t("toast.accountKicked"));
  const expiredHandler = () => tryOut(t("toast.loginExpiration"));

  const tryOut = (msg: string) =>
    feedbackToast({
      msg,
      error: msg,
      onClose: () => {
        userLogout(true);
      },
    });

  // sync
  const syncStartHandler = ({ data }: WSEvent<boolean>) => {
    updateSyncState("loading");
    updateReinstallState(data);
  };
  const syncProgressHandler = ({ data }: WSEvent<number>) => {
    updateProgressState(data);
  };
  const syncFinishHandler = () => {
    updateSyncState("success");
    getFriendListByReq();
    getGroupListByReq();
    getConversationListByReq(false);
    getUnReadCountByReq();
  };
  const syncFailedHandler = () => {
    updateSyncState("failed");
    feedbackToast({ msg: t("toast.syncFailed"), error: t("toast.syncFailed") });
  };

  // message
  const newMessageHandler = ({ data }: WSEvent<MessageItem[]>) => {
    if (useUserStore.getState().syncState === "loading" || resume.current) {
      return;
    }
    data.map((message) => {
      handleNewMessage(message);
      // Show notification for messages NOT in current conversation
      handleMessageNotification(message);
    });
  };

  const revokedMessageHandler = ({ data }: WSEvent<RevokedInfo>) => {
    updateOneMessage({
      clientMsgID: data.clientMsgID,
      contentType: MessageType.RevokeMessage,
      notificationElem: {
        detail: JSON.stringify(data),
      },
    } as MessageItem);
  };

  const c2cReadReceiptHandler = ({ data }: WSEvent<ReceiptInfo[]>) => {
    console.log('[已读回执] 收到单聊已读回执:', data);
    data.forEach((receipt) => {
      receipt.msgIDList.forEach((clientMsgID) => {
        console.log('[已读回执] 更新消息已读状态:', clientMsgID);
        updateOneMessage({
          clientMsgID,
          isRead: true,
        } as MessageItem);
      });
    });
  };

  const groupReadReceiptHandler = ({ data }: WSEvent<GroupMessageReceiptInfo>) => {
    console.log('[群聊已读回执] ===== 收到群聊已读回执 =====', data);
    const { conversationID, groupMessageReadInfo } = data;

    // 检查是否是当前会话
    const currentConversation = useConversationStore.getState().currentConversation;
    console.log('[群聊已读回执] 当前会话:', currentConversation?.conversationID, '接收到的会话:', conversationID);
    if (!currentConversation || currentConversation.conversationID !== conversationID) {
      console.log('[群聊已读回执] ⚠️ 不是当前会话，跳过');
      return;
    }

    // 更新每条消息的已读信息
    groupMessageReadInfo.forEach((readInfo) => {
      console.log('[群聊已读回执] 更新消息已读状态:', {
        clientMsgID: readInfo.clientMsgID,
        hasReadCount: readInfo.hasReadCount,
        unreadCount: readInfo.unreadCount,
      });

      // 更新消息的 attachedInfoElem.groupHasReadInfo
      updateOneMessage({
        clientMsgID: readInfo.clientMsgID,
        attachedInfoElem: {
          groupHasReadInfo: {
            hasReadCount: readInfo.hasReadCount,
            unreadCount: readInfo.unreadCount,
            hasReadUserIDList: readInfo.readMembers?.map(m => m.userID) || [],
            groupMemberCount: (readInfo.hasReadCount || 0) + (readInfo.unreadCount || 0) + 1, // +1 for sender
          },
        },
      } as unknown as MessageItem);
    });
  };

  const notPushType = [MessageType.TypingMessage, MessageType.RevokeMessage];

  const handleNewMessage = (newServerMsg: MessageItem) => {
    if (newServerMsg.contentType === MessageType.CustomMessage) {
      const customData = JSON.parse(newServerMsg.customElem!.data);
      if (
        CustomType.CallingInvite <= customData.customType &&
        customData.customType <= CustomType.CallingHungup
      ) {
        return;
      }
    }

    if (!inCurrentConversation(newServerMsg)) return;

    if (!notPushType.includes(newServerMsg.contentType)) {
      pushNewMessage(newServerMsg);
    }
  };

  const inCurrentConversation = (newServerMsg: MessageItem) => {
    switch (newServerMsg.sessionType) {
      case SessionType.Single:
        return (
          newServerMsg.sendID ===
            useConversationStore.getState().currentConversation?.userID ||
          (newServerMsg.sendID === useUserStore.getState().selfInfo.userID &&
            newServerMsg.recvID ===
              useConversationStore.getState().currentConversation?.userID)
        );
      case SessionType.Group:
      case SessionType.WorkingGroup:
        return (
          newServerMsg.groupID ===
          useConversationStore.getState().currentConversation?.groupID
        );
      case SessionType.Notification:
        return (
          newServerMsg.sendID ===
          useConversationStore.getState().currentConversation?.userID
        );
      default:
        return false;
    }
  };

  const handleMessageNotification = async (message: MessageItem) => {
    console.log("[useGlobalEvents] handleMessageNotification called", {
      sendID: message.sendID,
      sessionType: message.sessionType,
      contentType: message.contentType,
    });

    // Don't notify if message is in current conversation (already visible)
    if (inCurrentConversation(message)) {
      console.log("[useGlobalEvents] Message in current conversation, skipping notification");
      return;
    }

    // Don't notify for own messages
    const selfUserID = useUserStore.getState().selfInfo.userID;
    if (message.sendID === selfUserID) {
      console.log("[useGlobalEvents] Own message, skipping notification");
      return;
    }

    try {
      // Get conversation ID
      const conversationID = message.sessionType === SessionType.Single
        ? `si_${message.sendID}_${selfUserID}`
        : `sg_${message.groupID}`;

      // Get conversation info to get the name
      const { data: conversationInfo } = await IMSDK.getOneConversation({
        sourceID: message.sessionType === SessionType.Single ? message.sendID : message.groupID,
        sessionType: message.sessionType,
      });

      const conversationName = conversationInfo.showName || "New Message";
      console.log("[useGlobalEvents] Calling notificationManager.showMessageNotification", {
        conversationName,
        conversationID,
      });

      // Show notification with click handler
      await notificationManager.showMessageNotification(
        message,
        conversationName,
        () => {
          // Navigate to conversation when notification is clicked
          navigate(`/chat?conversationID=${conversationID}`);
        }
      );
    } catch (error) {
      console.error("[useGlobalEvents] Failed to show message notification:", error);
    }
  };

  // conversation
  const conversationChnageHandler = ({ data }: WSEvent<ConversationItem[]>) => {
    updateConversationList(data, "filter");
  };
  const newConversationHandler = ({ data }: WSEvent<ConversationItem[]>) => {
    updateConversationList(data, "push");
  };
  const totalUnreadChangeHandler = ({ data }: WSEvent<number>) => {
    if (data === useConversationStore.getState().unReadCount) return;
    updateUnReadCount(data);
  };

  // friend
  const friednInfoChangeHandler = ({ data }: WSEvent<FriendUserItem>) => {
    updateFriend(data);
  };
  const friednAddedHandler = ({ data }: WSEvent<FriendUserItem>) => {
    pushNewFriend(data);
  };
  const friednDeletedHandler = ({ data }: WSEvent<FriendUserItem>) => {
    updateFriend(data, true);
  };

  // blacklist
  const blackAddedHandler = ({ data }: WSEvent<BlackUserItem>) => {
    pushNewBlack(data);
  };
  const blackDeletedHandler = ({ data }: WSEvent<BlackUserItem>) => {
    IMSDK.getSpecifiedFriendsInfo({
      friendUserIDList: [data.userID],
    }).then(({ data }) => {
      if (data.length) {
        pushNewFriend(data[0]);
      }
    });
    updateBlack(data, true);
  };

  // group
  const joinedGroupAddedHandler = ({ data }: WSEvent<GroupItem>) => {
    if (data.groupID === useConversationStore.getState().currentConversation?.groupID) {
      updateCurrentGroupInfo(data);
      getCurrentMemberInGroupByReq(data.groupID);
    }
    pushNewGroup(data);
  };
  const joinedGroupDeletedHandler = ({ data }: WSEvent<GroupItem>) => {
    if (data.groupID === useConversationStore.getState().currentConversation?.groupID) {
      getCurrentGroupInfoByReq(data.groupID);
      setCurrentMemberInGroup();
    }
    updateGroup(data, true);
  };
  const joinedGroupDismissHandler = ({ data }: WSEvent<GroupItem>) => {
    if (data.groupID === useConversationStore.getState().currentConversation?.groupID) {
      getCurrentMemberInGroupByReq(data.groupID);
    }
  };
  const groupInfoChangedHandler = ({ data }: WSEvent<GroupItem>) => {
    updateGroup(data);
    if (data.groupID === useConversationStore.getState().currentConversation?.groupID) {
      updateCurrentGroupInfo(data);
    }
  };
  const groupMemberAddedHandler = ({ data }: WSEvent<GroupMemberItem>) => {
    if (
      data.groupID === useConversationStore.getState().currentConversation?.groupID &&
      data.userID === useUserStore.getState().selfInfo.userID
    ) {
      getCurrentMemberInGroupByReq(data.groupID);
    }
  };
  const groupMemberDeletedHandler = ({ data }: WSEvent<GroupMemberItem>) => {
    if (
      data.groupID === useConversationStore.getState().currentConversation?.groupID &&
      data.userID === useUserStore.getState().selfInfo.userID
    ) {
      getCurrentMemberInGroupByReq(data.groupID);
    }
  };
  const groupMemberInfoChangedHandler = ({ data }: WSEvent<GroupMemberItem>) => {
    if (data.groupID === useConversationStore.getState().currentConversation?.groupID) {
      tryUpdateCurrentMemberInGroup(data);
    }
  };

  //application
  const friendApplicationProcessedHandler = ({
    data,
  }: WSEvent<FriendApplicationItem>) => {
    const isRecv = data.toUserID === useUserStore.getState().selfInfo.userID;
    if (isRecv) {
      updateRecvFriendApplication(data);
    } else {
      updateSendFriendApplication(data);
    }
  };
  const groupApplicationProcessedHandler = ({
    data,
  }: WSEvent<GroupApplicationItem>) => {
    const isRecv = data.userID !== useUserStore.getState().selfInfo.userID;
    if (isRecv) {
      updateRecvGroupApplication(data);
    } else {
      updateSendGroupApplication(data);
    }
  };

  const disposeIMListener = () => {
    IMSDK.off(CbEvents.OnSelfInfoUpdated, selfUpdateHandler);
    IMSDK.off(CbEvents.OnConnecting, connectingHandler);
    IMSDK.off(CbEvents.OnConnectFailed, connectFailedHandler);
    IMSDK.off(CbEvents.OnConnectSuccess, connectSuccessHandler);
    IMSDK.off(CbEvents.OnKickedOffline, kickHandler);
    IMSDK.off(CbEvents.OnUserTokenExpired, expiredHandler);
    IMSDK.off(CbEvents.OnUserTokenInvalid, expiredHandler);
    // sync
    IMSDK.off(CbEvents.OnSyncServerStart, syncStartHandler);
    IMSDK.off(CbEvents.OnSyncServerProgress, syncProgressHandler);
    IMSDK.off(CbEvents.OnSyncServerFinish, syncFinishHandler);
    IMSDK.off(CbEvents.OnSyncServerFailed, syncFailedHandler);
    // message
    IMSDK.off(CbEvents.OnRecvNewMessages, newMessageHandler);
    IMSDK.off(CbEvents.OnRecvC2CReadReceipt, c2cReadReceiptHandler);
    IMSDK.off(CbEvents.OnRecvGroupReadReceipt, groupReadReceiptHandler);
    // conversation
    IMSDK.off(CbEvents.OnConversationChanged, conversationChnageHandler);
    IMSDK.off(CbEvents.OnNewConversation, newConversationHandler);
    IMSDK.off(CbEvents.OnTotalUnreadMessageCountChanged, totalUnreadChangeHandler);
    // friend
    IMSDK.off(CbEvents.OnFriendInfoChanged, friednInfoChangeHandler);
    IMSDK.off(CbEvents.OnFriendAdded, friednAddedHandler);
    IMSDK.off(CbEvents.OnFriendDeleted, friednDeletedHandler);
    // blacklist
    IMSDK.off(CbEvents.OnBlackAdded, blackAddedHandler);
    IMSDK.off(CbEvents.OnBlackDeleted, blackDeletedHandler);
    // group
    IMSDK.off(CbEvents.OnJoinedGroupAdded, joinedGroupAddedHandler);
    IMSDK.off(CbEvents.OnJoinedGroupDeleted, joinedGroupDeletedHandler);
    IMSDK.off(CbEvents.OnGroupDismissed, joinedGroupDismissHandler);
    IMSDK.off(CbEvents.OnGroupInfoChanged, groupInfoChangedHandler);
    IMSDK.off(CbEvents.OnGroupMemberAdded, groupMemberAddedHandler);
    IMSDK.off(CbEvents.OnGroupMemberDeleted, groupMemberDeletedHandler);
    IMSDK.off(CbEvents.OnGroupMemberInfoChanged, groupMemberInfoChangedHandler);
    // application
    IMSDK.off(CbEvents.OnFriendApplicationAdded, friendApplicationProcessedHandler);
    IMSDK.off(CbEvents.OnFriendApplicationAccepted, friendApplicationProcessedHandler);
    IMSDK.off(CbEvents.OnFriendApplicationRejected, friendApplicationProcessedHandler);
    IMSDK.off(CbEvents.OnGroupApplicationAdded, groupApplicationProcessedHandler);
    IMSDK.off(CbEvents.OnGroupApplicationAccepted, groupApplicationProcessedHandler);
    IMSDK.off(CbEvents.OnGroupApplicationRejected, groupApplicationProcessedHandler);
  };

  const setIpcListener = () => {
    window.electronAPI?.subscribe("appResume", () => {
      if (resume.current) {
        return;
      }
      resume.current = true;
      setTimeout(() => {
        resume.current = false;
      }, 5000);
    });
  };
}
