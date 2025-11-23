import "./index.scss";
import "ckeditor5/ckeditor5.css";

import { ClassicEditor, Essentials, Mention, Paragraph } from "ckeditor5";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

export type CKEditorRef = {
  focus: (moveToEnd?: boolean) => void;
};

export interface MentionFeed {
  id: string;
  name: string;
  avatar?: string;
}

interface CKEditorProps {
  value: string;
  placeholder?: string;
  mentionFeeds?: MentionFeed[];
  onChange?: (value: string) => void;
  onEnter?: () => void;
}

export interface EmojiData {
  src: string;
  alt: string;
}

const keyCodes = {
  delete: 46,
  backspace: 8,
};

const Index: ForwardRefRenderFunction<CKEditorRef, CKEditorProps> = (
  { value, placeholder, mentionFeeds = [], onChange, onEnter },
  ref,
) => {
  const ckEditor = useRef<ClassicEditor | null>(null);
  const mentionFeedsRef = useRef<MentionFeed[]>(mentionFeeds);

  // 更新 ref 当 mentionFeeds 变化时
  useEffect(() => {
    mentionFeedsRef.current = mentionFeeds;
  }, [mentionFeeds]);

  const focus = (moveToEnd = false) => {
    const editor = ckEditor.current;

    if (editor) {
      const model = editor.model;
      const view = editor.editing.view;
      const root = model.document.getRoot();
      if (moveToEnd && root) {
        const range = model.createRange(model.createPositionAt(root, "end"));

        model.change((writer) => {
          writer.setSelection(range);
        });
      }
      view.focus();
    }
  };

  const listenKeydown = (editor: ClassicEditor) => {
    editor.editing.view.document.on(
      "keydown",
      (evt, data) => {
        if (data.keyCode === 13 && !data.shiftKey) {
          data.preventDefault();
          evt.stop();
          onEnter?.();
          return;
        }
        if (data.keyCode === keyCodes.backspace || data.keyCode === keyCodes.delete) {
          const selection = editor.model.document.selection;
          const hasSelectContent = !editor.model.getSelectedContent(selection).isEmpty;
          const hasEditorContent = Boolean(editor.getData());

          if (!hasEditorContent) {
            return;
          }

          if (hasSelectContent) return;
        }
      },
      { priority: "high" },
    );
  };

  useImperativeHandle(
    ref,
    () => ({
      focus,
    }),
    [],
  );

  return (
    <CKEditor
      editor={ClassicEditor}
      data={value}
      config={{
        placeholder,
        toolbar: [],
        image: {
          toolbar: [],
          insert: {
            type: "inline",
          },
        },
        plugins: [Essentials, Paragraph, Mention],
        mention: {
          feeds: [
            {
              marker: "@",
              feed: (queryText: string) => {
                const feeds = mentionFeedsRef.current;
                console.log("@触发，查询文本:", queryText, "成员列表数量:", feeds.length);

                // 添加"所有人"选项
                const allPeopleOption = {
                  id: "AtAllTag",
                  name: "所有人",
                  avatar: "",
                };

                // 合并"所有人"选项和成员列表
                const allFeeds = [allPeopleOption, ...feeds];

                // 根据输入文本过滤成员列表
                let filtered = allFeeds.filter((member) =>
                  member.name.toLowerCase().includes(queryText.toLowerCase())
                );

                // 按照用户名首字母排序（中文按拼音首字母，英文按字母）
                filtered.sort((a, b) => {
                  // "所有人"始终排在第一位
                  if (a.id === "AtAllTag") return -1;
                  if (b.id === "AtAllTag") return 1;

                  return a.name.localeCompare(b.name, 'zh-CN', { sensitivity: 'base' });
                });

                // 返回对象数组格式，符合CKEditor Mention plugin要求
                // id不包含@符号，避免与marker冲突
                const results = filtered.map((member) => ({
                  id: member.name,    // id不带@符号
                  text: member.name   // 显示文本也不带@符号
                }));

                console.log("过滤并排序后的结果:", results);
                return results;
              },
              minimumCharacters: 0,
            },
          ],
        },
      }}
      onReady={(editor) => {
        ckEditor.current = editor;
        listenKeydown(editor);
        focus(true);
      }}
      onChange={(event, editor) => {
        const data = editor.getData();
        onChange?.(data);
      }}
    />
  );
};

export default memo(forwardRef(Index));
