import { Avatar as AntdAvatar, AvatarProps } from "antd";
import clsx from "clsx";
import * as React from "react";
import { useMemo } from "react";

import default_group from "@/assets/images/contact/group.png";
import { avatarList, getDefaultAvatar, getUserAvatarColor, getAvatarText } from "@/utils/avatar";

const default_avatars = avatarList.map((item) => item.name);

interface IOIMAvatarProps extends AvatarProps {
  text?: string;
  color?: string;
  bgColor?: string;
  isgroup?: boolean;
  isnotification?: boolean;
  size?: number;
  userID?: string; // 用户ID，用于生成默认头像颜色
}

const OIMAvatar: React.FC<IOIMAvatarProps> = (props) => {
  const {
    src,
    text,
    size = 42,
    color = "#fff",
    bgColor,
    isgroup = false,
    isnotification,
    userID,
  } = props;
  const [errorHolder, setErrorHolder] = React.useState<string>();
  const [imageLoadFailed, setImageLoadFailed] = React.useState(false);

  const getAvatarUrl = useMemo(() => {
    // 检查src是否为有效的图片URL（非空字符串）
    const hasValidSrc = src && src.trim() !== "";

    // 如果没有有效的src，直接返回undefined以显示彩色头像（非群组）或默认群组头像
    if (!hasValidSrc) {
      return isgroup ? default_group : undefined;
    }

    // 检查是否是本地IP地址，如果是且为非群组头像，直接显示彩色头像
    if (!isgroup && !default_avatars.includes(src as string)) {
      const isLocalIP = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/i.test(src as string);
      if (isLocalIP) {
        return undefined;
      }
    }

    // 如果图片加载失败，对于非群组头像，返回undefined显示彩色头像
    if (imageLoadFailed && !isgroup) {
      return undefined;
    }

    // 有有效src的情况
    if (default_avatars.includes(src as string)) {
      return getDefaultAvatar(src as string);
    }

    return src;
  }, [src, isgroup, isnotification, imageLoadFailed]);

  // 生成默认头像颜色和文字
  const defaultBgColor = useMemo(() => {
    // 检查是否有有效的图片URL
    const hasValidSrc = src && src.trim() !== "";

    // 如果没有头像图片（或图片加载失败）且有userID，则使用自定义颜色
    if ((!hasValidSrc || imageLoadFailed) && userID && !isgroup) {
      return getUserAvatarColor(userID);
    }
    return bgColor || "#0289FA";
  }, [src, userID, bgColor, isgroup, imageLoadFailed]);

  const displayText = useMemo(() => {
    // 检查是否有有效的图片URL
    const hasValidSrc = src && src.trim() !== "";

    // 如果没有头像图片（或图片加载失败），显示昵称的前3个字符
    if ((!hasValidSrc || imageLoadFailed) && text && !isgroup) {
      return getAvatarText(text);
    }
    return text;
  }, [src, text, isgroup, imageLoadFailed]);

  const avatarProps = { ...props, isgroup: undefined, isnotification: undefined, userID: undefined };

  React.useEffect(() => {
    if (!isgroup) {
      setErrorHolder(undefined);
    }
  }, [isgroup]);

  React.useEffect(() => {
    // 当src变化时，重置imageLoadFailed状态
    setImageLoadFailed(false);
  }, [src]);

  const errorHandler = () => {
    if (isgroup) {
      setErrorHolder(default_group);
    } else {
      // 非群组头像加载失败，标记为失败状态，使用彩色背景
      setImageLoadFailed(true);
    }
  };

  return (
    <AntdAvatar
      style={{
        backgroundColor: defaultBgColor,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        lineHeight: `${size - 2}px`,
        color,
      }}
      shape="circle"
      {...avatarProps}
      className={clsx(
        {
          "cursor-pointer": Boolean(props.onClick),
        },
        props.className,
      )}
      src={errorHolder ?? getAvatarUrl}
      onError={errorHandler as any}
    >
      {displayText}
    </AntdAvatar>
  );
};

export default OIMAvatar;
