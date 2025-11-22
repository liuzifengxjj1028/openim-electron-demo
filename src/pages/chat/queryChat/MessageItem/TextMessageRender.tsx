import { FC } from "react";

import { formatBr } from "@/utils/common";

import { IMessageItemProps } from ".";
import styles from "./message-item.module.scss";

const TextMessageRender: FC<IMessageItemProps> = ({ message }) => {
  // 对于@消息,从 atTextElem 中获取内容;对于普通文本消息,从 textElem 中获取
  let content = message.atTextElem?.text || message.textElem?.content;

  content = formatBr(content!);

  return (
    <div className={styles.bubble} dangerouslySetInnerHTML={{ __html: content }}></div>
  );
};

export default TextMessageRender;
