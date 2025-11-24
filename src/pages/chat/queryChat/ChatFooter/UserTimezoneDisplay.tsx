import { ClockCircleOutlined } from "@ant-design/icons";
import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";

interface UserTimezoneDisplayProps {
  // 用户时区标识符（例如："Asia/Shanghai", "America/New_York"）
  // 如果不提供，将使用用户本地时区
  timezone?: string;
  // 用户昵称
  userName?: string;
}

export const UserTimezoneDisplay = ({
  timezone,
  userName,
}: UserTimezoneDisplayProps) => {
  const { t } = useTranslation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [tickCount, setTickCount] = useState(0); // 添加一个计数器来强制更新

  // 如果没有提供timezone，使用浏览器自动检测的时区
  const effectiveTimezone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    console.log('[UserTimezoneDisplay] 组件挂载，启动定时器, timezone:', timezone);
    // 每秒更新一次时间
    const timer = setInterval(() => {
      const newTime = new Date();
      console.log('[UserTimezoneDisplay] 定时器触发，更新时间:', newTime.toLocaleTimeString());
      setCurrentTime(newTime);
      setTickCount((prev) => prev + 1); // 强制触发重新渲染
    }, 1000);

    return () => {
      console.log('[UserTimezoneDisplay] 组件卸载，清理定时器');
      clearInterval(timer);
    };
  }, [timezone]); // 添加timezone依赖，当timezone变化时重新创建定时器

  // 格式化时间显示（使用用户时区）
  const { date, time } = useMemo(() => {
    console.log('[UserTimezoneDisplay] 重新计算时间格式, currentTime:', currentTime.toLocaleTimeString(), 'timezone:', timezone, 'tickCount:', tickCount);
    try {
      // 如果提供了时区，使用指定时区；否则使用浏览器本地时区
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      };

      const formatter = new Intl.DateTimeFormat("zh-CN", options);
      const parts = formatter.formatToParts(currentTime);

      const dateTimeParts: Record<string, string> = {};
      parts.forEach((part) => {
        dateTimeParts[part.type] = part.value;
      });

      const date = `${dateTimeParts.year}-${dateTimeParts.month}-${dateTimeParts.day}`;
      const time = `${dateTimeParts.hour}:${dateTimeParts.minute}:${dateTimeParts.second}`;

      return { date, time };
    } catch (error) {
      console.error("时区格式化错误:", error);
      // 如果时区格式化失败，使用本地时间
      const year = currentTime.getFullYear();
      const month = String(currentTime.getMonth() + 1).padStart(2, "0");
      const day = String(currentTime.getDate()).padStart(2, "0");
      const hours = String(currentTime.getHours()).padStart(2, "0");
      const minutes = String(currentTime.getMinutes()).padStart(2, "0");
      const seconds = String(currentTime.getSeconds()).padStart(2, "0");

      return {
        date: `${year}-${month}-${day}`,
        time: `${hours}:${minutes}:${seconds}`,
      };
    }
  }, [currentTime, timezone, tickCount]); // 依赖currentTime、timezone和tickCount

  // 获取时区显示名称 - 使用useMemo缓存
  const timezoneDisplay = useMemo(() => {
    if (!timezone) {
      return null;
    }

    try {
      // 获取时区的 UTC 偏移量
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        timeZoneName: "short",
      };
      const formatter = new Intl.DateTimeFormat("en-US", options);
      const parts = formatter.formatToParts(currentTime);
      const timeZonePart = parts.find((part) => part.type === "timeZoneName");

      return timeZonePart?.value || timezone;
    } catch (error) {
      return timezone;
    }
  }, [currentTime, timezone]); // 依赖currentTime和timezone

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500">
      <ClockCircleOutlined />
      <span>
        {userName ? `${userName} ${t("placeholder.localTime")}` : t("placeholder.contactLocalTime")}:{" "}
        <span className="font-medium text-gray-700">
          {date} {time}
        </span>
        {timezoneDisplay && (
          <span className="ml-2 text-gray-400">({timezoneDisplay})</span>
        )}
      </span>
    </div>
  );
};
