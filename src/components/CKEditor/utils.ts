export const replaceEmoji2Str = (text: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");

  const emojiEls: HTMLImageElement[] = Array.from(doc.querySelectorAll(".emojione"));
  emojiEls.map((face) => {
    // @ts-ignore
    const escapedOut = face.outerHTML.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    text = text.replace(new RegExp(escapedOut, "g"), face.alt);
  });
  return text;
};

export const getCleanText = (html: string) => {
  let text = replaceEmoji2Str(html);
  text = text.replace(/<\/p><p>/g, "\n");
  text = text.replace(/<br\s*[/]?>/gi, "\n");

  // 保留 @mention 标记:将 <span class="mention" data-mention="@用户名">@用户名</span> 替换为 @用户名
  text = text.replace(/<span class="mention"[^>]*data-mention="(@[^"]+)"[^>]*>[^<]*<\/span>/g, '$1');

  text = text.replace(/<[^>]+>/g, "");
  text = convertChar(text);
  text = decodeHtmlEntities(text);
  return text.trim();
};

let textAreaDom: HTMLTextAreaElement | null = null;
const decodeHtmlEntities = (text: string) => {
  if (!textAreaDom) {
    textAreaDom = document.createElement("textarea");
  }
  textAreaDom.innerHTML = text;
  return textAreaDom.value;
};

export const convertChar = (text: string) => text.replace(/&nbsp;/gi, " ");

export const getCleanTextExceptImg = (html: string) => {
  html = replaceEmoji2Str(html);

  const regP = /<\/p><p>/g;
  html = html.replace(regP, "</p><br><p>");

  const regBr = /<br\s*\/?>/gi;
  html = html.replace(regBr, "\n");

  const regWithoutHtmlExceptImg = /<(?!img\s*\/?)[^>]+>/gi;
  return html.replace(regWithoutHtmlExceptImg, "");
};

/**
 * 从HTML中提取@mention信息
 * @param html CKEditor生成的HTML内容
 * @returns 包含被@的用户名列表
 */
export const extractMentions = (html: string): string[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // CKEditor的mention会生成<span class="mention" data-mention="@用户名">@用户名</span>
  const mentionElements = doc.querySelectorAll('span.mention[data-mention]');

  const mentions: string[] = [];
  mentionElements.forEach((el) => {
    const mention = el.getAttribute('data-mention');
    if (mention) {
      // 移除@符号，只保留用户名
      const userName = mention.replace(/^@/, '');
      mentions.push(userName);
    }
  });

  console.log('[提取@信息] HTML:', html);
  console.log('[提取@信息] 提取到的@用户名:', mentions);

  return mentions;
};
