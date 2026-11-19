import {
  SquaresFour, CalendarBlank, Code, Flask, PenNib, Barbell, ForkKnife,
  BookOpen, Moon, GearSix, MegaphoneSimple, Briefcase, GameController,
  type Icon,
} from "@phosphor-icons/react";
import { classNames } from "../utils";

/**
 * Notion 风格模块图标：统一的单色线性图标 + 低饱和圆角底，跟随明暗主题。
 * 不再依赖彩色插画位图，全部为内联 SVG，离线可用且可无损缩放。
 * 保留「旧模块」的图标是为了：历史页面与数据仍在，直接访问时不会缺图标。
 */
export const moduleArtworkSources = {
  dashboard: "SquaresFour",
  development: "Code",
  testing: "Flask",
  writing: "PenNib",
  fitness: "Barbell",
  diet: "ForkKnife",
  reading: "BookOpen",
  sleep: "Moon",
  settings: "GearSix",
  today: "CalendarBlank",
  media: "MegaphoneSimple",
  consulting: "Briefcase",
  entertainment: "GameController",
} as const;

export type ModuleArtworkName = keyof typeof moduleArtworkSources;

const icons: Record<ModuleArtworkName, Icon> = {
  dashboard: SquaresFour,
  development: Code,
  testing: Flask,
  writing: PenNib,
  fitness: Barbell,
  diet: ForkKnife,
  reading: BookOpen,
  sleep: Moon,
  settings: GearSix,
  today: CalendarBlank,
  media: MegaphoneSimple,
  consulting: Briefcase,
  entertainment: GameController,
};

export function ModuleArtwork({ module, label, className, loading }: {
  module: ModuleArtworkName;
  label?: string;
  className?: string;
  /** 保留兼容旧调用；内联 SVG 无需懒加载。 */
  loading?: "eager" | "lazy";
}) {
  void loading;
  const Glyph = icons[module];
  return (
    <span
      className={classNames("module-artwork", "notion-module-icon", className)}
      data-module={module}
      data-icon={moduleArtworkSources[module]}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Glyph size={18} weight="regular" aria-hidden="true" />
    </span>
  );
}
