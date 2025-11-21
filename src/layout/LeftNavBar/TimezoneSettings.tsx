import { CloseOutlined } from "@ant-design/icons";
import { Modal, Radio, RadioChangeEvent, Space } from "antd";
import { t } from "i18next";
import { forwardRef, ForwardRefRenderFunction, memo, useState } from "react";

import { updateBusinessUserInfo } from "@/api/login";
import { useUserStore } from "@/store";
import { feedbackToast } from "@/utils/common";

import { OverlayVisibleHandle, useOverlayVisible } from "../../hooks/useOverlayVisible";

// 常用时区列表
export const TIMEZONE_OPTIONS = [
  { label: "UTC-12:00 (贝克岛)", value: "Etc/GMT+12" },
  { label: "UTC-11:00 (萨摩亚)", value: "Pacific/Samoa" },
  { label: "UTC-10:00 (夏威夷)", value: "Pacific/Honolulu" },
  { label: "UTC-09:00 (阿拉斯加)", value: "America/Anchorage" },
  { label: "UTC-08:00 (洛杉矶)", value: "America/Los_Angeles" },
  { label: "UTC-07:00 (丹佛)", value: "America/Denver" },
  { label: "UTC-06:00 (芝加哥)", value: "America/Chicago" },
  { label: "UTC-05:00 (纽约)", value: "America/New_York" },
  { label: "UTC-04:00 (圣地亚哥)", value: "America/Santiago" },
  { label: "UTC-03:00 (布宜诺斯艾利斯)", value: "America/Argentina/Buenos_Aires" },
  { label: "UTC-02:00 (大西洋中部)", value: "Atlantic/South_Georgia" },
  { label: "UTC-01:00 (亚速尔群岛)", value: "Atlantic/Azores" },
  { label: "UTC+00:00 (伦敦)", value: "Europe/London" },
  { label: "UTC+01:00 (巴黎)", value: "Europe/Paris" },
  { label: "UTC+02:00 (开罗)", value: "Africa/Cairo" },
  { label: "UTC+03:00 (莫斯科)", value: "Europe/Moscow" },
  { label: "UTC+04:00 (迪拜)", value: "Asia/Dubai" },
  { label: "UTC+05:00 (伊斯兰堡)", value: "Asia/Karachi" },
  { label: "UTC+05:30 (新德里)", value: "Asia/Kolkata" },
  { label: "UTC+06:00 (达卡)", value: "Asia/Dhaka" },
  { label: "UTC+07:00 (曼谷)", value: "Asia/Bangkok" },
  { label: "UTC+08:00 (上海)", value: "Asia/Shanghai" },
  { label: "UTC+08:00 (香港)", value: "Asia/Hong_Kong" },
  { label: "UTC+08:00 (台北)", value: "Asia/Taipei" },
  { label: "UTC+08:00 (新加坡)", value: "Asia/Singapore" },
  { label: "UTC+09:00 (东京)", value: "Asia/Tokyo" },
  { label: "UTC+09:00 (首尔)", value: "Asia/Seoul" },
  { label: "UTC+10:00 (悉尼)", value: "Australia/Sydney" },
  { label: "UTC+11:00 (所罗门群岛)", value: "Pacific/Guadalcanal" },
  { label: "UTC+12:00 (奥克兰)", value: "Pacific/Auckland" },
  { label: "UTC+13:00 (努库阿洛法)", value: "Pacific/Tongatapu" },
];

const TimezoneSettings: ForwardRefRenderFunction<OverlayVisibleHandle, unknown> = (_, ref) => {
  const { isOverlayOpen, closeOverlay } = useOverlayVisible(ref);

  return (
    <Modal
      title={null}
      footer={null}
      closable={false}
      open={isOverlayOpen}
      onCancel={closeOverlay}
      centered
      destroyOnClose
      styles={{
        mask: {
          opacity: 0,
          transition: "none",
        },
      }}
      width={520}
      className="no-padding-modal"
      maskTransitionName=""
    >
      <TimezoneSettingsContent closeOverlay={closeOverlay} />
    </Modal>
  );
};

export default memo(forwardRef(TimezoneSettings));

export const TimezoneSettingsContent = ({ closeOverlay }: { closeOverlay?: () => void }) => {
  const appSettings = useUserStore((state) => state.appSettings);
  const updateAppSettings = useUserStore((state) => state.updateAppSettings);

  // 获取当前时区，如果未设置则使用浏览器默认时区
  const currentTimezone = appSettings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [selectedTimezone, setSelectedTimezone] = useState(currentTimezone);

  const handleChange = async (e: RadioChangeEvent) => {
    const newTimezone = e.target.value;
    setSelectedTimezone(newTimezone);
    updateAppSettings({ timezone: newTimezone });

    // 同步到服务器
    try {
      await updateBusinessUserInfo({ timezone: newTimezone });
    } catch (error) {
      console.error("更新时区到服务器失败:", error);
      feedbackToast({ error, msg: t("toast.updateTimezoneFailed") });
    }
  };

  return (
    <div className="flex h-[600px] flex-col bg-[var(--chat-bubble)]">
      <div className="flex items-center justify-between bg-[var(--gap-text)] p-5">
        <span className="text-base font-medium">{t("placeholder.timezoneSettings")}</span>
        <CloseOutlined
          className="app-no-drag cursor-pointer text-[#8e9aaf]"
          rev={undefined}
          onClick={closeOverlay}
        />
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mb-4 text-sm text-gray-600">
          {t("placeholder.timezoneSettingsDesc")}
        </div>
        <Radio.Group onChange={handleChange} value={selectedTimezone}>
          <Space direction="vertical" className="w-full">
            {TIMEZONE_OPTIONS.map((tz) => (
              <Radio key={tz.value} value={tz.value} className="w-full py-2">
                {tz.label}
              </Radio>
            ))}
          </Space>
        </Radio.Group>
      </div>
    </div>
  );
};
