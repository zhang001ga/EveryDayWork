/**
 * 日常事务工作台现在只保留「Notion 笔记」一种界面风格。
 * 保留 normalizeAppearance 是为了让历史设置里的 liquid / neo 值平滑归一，
 * 不再提供任何切换入口。
 */
export type Appearance = "notebook";

export function normalizeAppearance(value: unknown): Appearance {
  void value;
  return "notebook";
}
