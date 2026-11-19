import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  MagnifyingGlass, Plus, FloppyDisk, CheckCircle, WarningCircle, SidebarSimple,
  ArrowRight, Command, Power,
} from "@phosphor-icons/react";
import { api } from "../api";
import { useWorkspace } from "../WorkspaceContext";
import { formatDateTime, classNames } from "../utils";
import { Button, IconButton, Modal, Skeleton, ErrorState, Badge } from "./ui";
import { ModuleArtwork, type ModuleArtworkName } from "./ModuleArtwork";
import type { Entity } from "../types";

/** 日常事务工作台只保留 Notion 笔记一种界面风格，不再提供风格切换。 */
const APPEARANCE = "notebook";

/** 暂时隐藏的模块：只从导航、搜索和摘要里拿掉，路由与历史数据完整保留。 */
const hiddenModules = new Set<string>(["sleep"]);

const groups = [
  { label: "日常", links: [
    { to: "/development", label: "开发", module: "development", tone: "blue" },
    { to: "/testing", label: "测试", module: "testing", tone: "purple" },
    { to: "/writing", label: "写作", module: "writing", tone: "orange" },
  ] },
  // 「日常睡眠」暂时隐藏；恢复时把 sleep 链接加回这里，并从 hiddenModules 里移除即可。
  { label: "生活", links: [
    { to: "/fitness", label: "健身", module: "fitness", tone: "green" },
    { to: "/diet", label: "饮食", module: "diet", tone: "orange" },
    { to: "/reading", label: "阅读", module: "reading", tone: "blue" },
  ] },
  { label: "系统", links: [
    { to: "/", label: "首页总览", module: "dashboard", tone: "gray" },
    { to: "/settings", label: "数据与设置", module: "settings", tone: "gray" },
  ] },
] satisfies Array<{ label: string; links: Array<{ to: string; label: string; module: ModuleArtworkName; tone: string }> }>;

const collectionRoutes: Record<string, string> = {
  planItems: "/today", quickMemos: "/",
  mediaContents: "/media", devProjects: "/development", devMilestones: "/development",
  devWorkItems: "/development", devLogs: "/development", clients: "/consulting", consultingProjects: "/consulting",
  consultingInteractions: "/consulting", consultingDeliverables: "/consulting", consultingFollowups: "/consulting",
  consultingTimeEntries: "/consulting", workoutTemplates: "/fitness", workouts: "/fitness", bodyMetrics: "/fitness",
  nutritionTargets: "/diet", foods: "/diet", meals: "/diet", mealItems: "/diet", entertainmentItems: "/entertainment",
  playSessions: "/entertainment",
  testCases: "/testing", writingItems: "/writing", readingItems: "/reading", sleepRecords: "/sleep",
};

const routeMeta: Record<string, { label: string; module: ModuleArtworkName; tone: string }> = {
  "/": { label: "首页总览", module: "dashboard", tone: "gray" },
  "/development": { label: "开发", module: "development", tone: "blue" },
  "/testing": { label: "测试", module: "testing", tone: "purple" },
  "/writing": { label: "写作", module: "writing", tone: "orange" },
  "/fitness": { label: "健身", module: "fitness", tone: "green" },
  "/diet": { label: "饮食", module: "diet", tone: "orange" },
  "/reading": { label: "阅读", module: "reading", tone: "blue" },
  "/sleep": { label: "日常睡眠", module: "sleep", tone: "purple" },
  "/settings": { label: "数据与设置", module: "settings", tone: "gray" },
  // 旧模块保留路由与数据，仅从侧边栏移除。
  "/today": { label: "今日计划", module: "today", tone: "gray" },
  "/media": { label: "自媒体", module: "media", tone: "gray" },
  "/consulting": { label: "咨询工作", module: "consulting", tone: "gray" },
  "/entertainment": { label: "游戏娱乐", module: "entertainment", tone: "gray" },
};

export function AppLayout() {
  const { data, saveNow, saveStatus } = useWorkspace();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [exitState, setExitState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const system = useQuery({ queryKey: ["system"], queryFn: api.systemStatus, staleTime: 30_000 });
  const currentPage = routeMeta[location.pathname] ?? routeMeta["/"];
  const theme = data.settings.theme === "dark" ? "dark" : "light";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.appearance = APPEARANCE;
  }, [theme]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const saveAndExit = async () => {
    if (exitState === "saving" || exitState === "done") return;
    setExitState("saving");
    try {
      await saveNow();
      await api.saveAndExit();
      setExitState("done");
      document.title = "日常事务工作台已安全退出";
    } catch {
      setExitState("error");
    }
  };

  return (
    <div className={classNames("app-shell", collapsed && "sidebar-collapsed")} data-appearance={APPEARANCE} data-module={currentPage.module}>
      <NotebookEnvironment />
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <aside className="sidebar glass-regular">
        <div className="brand"><div className="brand-mark" aria-hidden="true"><img src="/assets/brand/daily-workspace-mark.svg" alt="" draggable={false} /></div><div className="brand-copy"><strong>日常事务工作台</strong><span>本地个人空间</span></div></div>
        <Button className="quick-create" onClick={() => setQuickOpen(true)}><Plus size={18} />快速新增</Button>
        <nav aria-label="主导航">
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-label">{group.label}</span>
              {group.links.map(({ to, label, module, tone }) => (
                <NavLink key={to} to={to} end={to === "/"} data-tone={tone} data-module={module} className={({ isActive }) => classNames("nav-link", isActive && "active")} title={label}>
                  <ModuleArtwork module={module} /><span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className={classNames("local-state", system.data?.backupStatus?.state === "error" && "backup-error")}><span className="status-dot" /><div><strong>{system.data?.backupStatus?.state === "error" ? "自动备份失败" : "仅保存在这台电脑"}</strong><small>{system.data?.backupStatus?.state === "error" ? system.data.backupStatus.lastError : system.data?.latestBackup ? `备份于 ${formatDateTime(system.data.latestBackup.createdAt)}` : "等待首次备份"}</small></div></div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar glass-clear">
          <div className="topbar-left">
            <IconButton label={collapsed ? "展开导航" : "收起导航"} onClick={() => setCollapsed((value) => !value)}><SidebarSimple size={20} /></IconButton>
            <span className="toolbar-page-icon" data-tone={currentPage.tone} aria-hidden="true"><ModuleArtwork module={currentPage.module} /></span>
            <div className="toolbar-context"><strong>{currentPage.label}</strong><span>{new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date())}</span></div>
          </div>
          <div className="topbar-actions">
            <button className="search-trigger glass-clear" aria-label="搜索所有内容" title="搜索所有内容" onClick={() => setSearchOpen(true)}><MagnifyingGlass size={18} /><span>搜索所有内容</span><kbd><Command size={12} />K</kbd></button>
            <Button className="topbar-create" variant="secondary" size="sm" onClick={() => setQuickOpen(true)}><Plus size={16} />快速新建</Button>
            <Button className="manual-save" variant="secondary" size="sm" loading={saveStatus === "saving"} onClick={() => void saveNow().catch(() => undefined)}><FloppyDisk size={16} />手动保存</Button>
            <Button className="save-exit" variant="ghost" size="sm" loading={exitState === "saving"} disabled={exitState === "done"} onClick={() => void saveAndExit()}><Power size={16} />{exitState === "error" ? "退出失败，重试" : "保存并退出"}</Button>
            <SaveIndicator status={saveStatus} />
          </div>
        </header>
        <main className="page-container" id="main-content" tabIndex={-1}><Outlet /></main>
      </div>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <QuickCreateModal open={quickOpen} onClose={() => setQuickOpen(false)} />
      {exitState === "done" ? <ExitScreen /> : null}
    </div>
  );
}

function NotebookEnvironment() {
  return <div className="notebook-environment" aria-hidden="true" />;
}

function ExitScreen() {
  return <div className="exit-screen" role="status"><div className="exit-card"><CheckCircle size={32} weight="fill" /><strong>数据已保存，日常事务工作台已安全退出</strong><p>现在可以关闭这个页面。下次双击启动图标，会重新启动并打开工作台。</p></div></div>;
}

function SaveIndicator({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  const values = {
    idle: { icon: FloppyDisk, label: "自动保存" },
    saving: { icon: FloppyDisk, label: "保存中" },
    saved: { icon: CheckCircle, label: "已保存" },
    error: { icon: WarningCircle, label: "保存失败" },
  } as const;
  const value = values[status];
  const Icon = value.icon;
  return <div className={`save-indicator save-${status}`} role="status"><Icon size={16} /><span>{value.label}</span></div>;
}

function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const search = useQuery({ queryKey: ["search", query], queryFn: () => api.search(query), enabled: open && query.trim().length > 0 });
  const grouped = useMemo(() => {
    return (search.data ?? []).filter((item) => !hiddenModules.has(item.module)).reduce<Record<string, Entity[]>>((result, item) => {
      (result[item.module] ??= []).push(item);
      return result;
    }, {});
  }, [search.data]);
  const moduleNames: Record<string, string> = { dashboard: "首页", today: "今日计划", media: "自媒体", development: "开发", consulting: "咨询工作", fitness: "健身", diet: "饮食", entertainment: "游戏娱乐", testing: "测试", writing: "写作", reading: "阅读", sleep: "日常睡眠" };
  return (
    <Modal open={open} title="搜索工作台" description="按模块查找标题、笔记和记录内容" onClose={onClose} wide>
      <div className="command-search glass-clear"><MagnifyingGlass size={20} /><input autoFocus aria-label="搜索关键词" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入关键词" /></div>
      <div className="search-results">
        {!query ? <div className="search-hint">输入内容开始搜索，按 Esc 关闭。</div> : search.isLoading ? <Skeleton lines={4} /> : search.error ? <ErrorState message={(search.error as Error).message} /> : search.data?.length === 0 ? <div className="search-hint">没有找到匹配内容。</div> : Object.entries(grouped).map(([module, items]) => (
          <section className="search-group" key={module}><h3>{moduleNames[module] ?? module}</h3>{items.map((item) => (
            <button key={`${item.collection}-${item.id}`} onClick={() => { navigate(collectionRoutes[item.collection] ?? "/"); onClose(); }}><span>{item.title || "未命名记录"}</span><ArrowRight size={16} /></button>
          ))}</section>
        ))}
      </div>
    </Modal>
  );
}

function QuickCreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const options = [
    { label: "测试用例", detail: "新增一条测试用例", route: "/testing?new=1", tone: "purple", module: "testing" },
    { label: "写作条目", detail: "记录一个新的写作计划", route: "/writing?new=1", tone: "orange", module: "writing" },
    { label: "阅读书目", detail: "把想读的书加进书架", route: "/reading?new=1", tone: "blue", module: "reading" },
    { label: "训练记录", detail: "开始或安排一次训练", route: "/fitness?new=workout", tone: "green", module: "fitness" },
    { label: "餐食记录", detail: "记录计划或实际饮食", route: "/diet?new=meal", tone: "orange", module: "diet" },
    { label: "今日事项", detail: "安排今天要执行的事情", route: "/today?new=1", tone: "gray", module: "today" },
  ];
  return (
    <Modal open={open} title="快速新增" description="选择要记录的内容类型" onClose={onClose}>
      <div className="quick-grid">{options.map((option) => <button data-tone={option.tone} key={option.label} onClick={() => { navigate(option.route); onClose(); }}><span className="quick-option-icon"><ModuleArtwork module={option.module as ModuleArtworkName} /></span><div><Badge>{option.label}</Badge><p>{option.detail}</p></div><ArrowRight size={18} /></button>)}</div>
    </Modal>
  );
}
