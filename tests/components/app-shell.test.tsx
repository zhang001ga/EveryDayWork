import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/App";
import { useWorkspace, WorkspaceProvider } from "../../src/WorkspaceContext";

const collections = ["planItems", "quickMemos", "mediaContents", "devProjects", "devMilestones", "devWorkItems", "devLogs", "clients", "consultingProjects", "consultingInteractions", "consultingDeliverables", "consultingFollowups", "consultingTimeEntries", "workoutTemplates", "workoutTemplateExercises", "workouts", "workoutExercises", "workoutSets", "bodyMetrics", "nutritionTargets", "foods", "meals", "mealItems", "entertainmentItems", "playSessions"];

function mockApi(theme = "light", backupStatus: Record<string, any> | null = null, appearance?: unknown) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    let data: any = null;
    if (url.startsWith("/api/state")) data = { ...Object.fromEntries(collections.map((name) => [name, []])), settings: { theme, ...(appearance === undefined ? {} : { appearance }) }, trash: [] };
    else if (url.startsWith("/api/dashboard")) data = { date: "2026-08-02", overview: { completed: 0, total: 0, progress: 0, scheduledMinutes: 0 }, timeline: [], unscheduled: [], attention: [], summaries: { media: [], development: [], consulting: [], fitness: [], diet: [], entertainment: [] } };
    else if (url.startsWith("/api/system/status")) data = { latestBackup: null, backupStatus };
    else if (url.startsWith("/api/system/save")) data = { savedAt: "2026-08-02T12:00:00.000Z", database: "ok", dataFile: "/tmp/app.sqlite" };
    return { ok: true, status: 200, json: async () => ({ data }) } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function SaveFailureTrigger() {
  const { run } = useWorkspace();
  return <button onClick={() => void run(async () => { throw new Error("数据文件不可写"); }).catch(() => undefined)}>制造保存失败</button>;
}

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><WorkspaceProvider><App /></WorkspaceProvider></QueryClientProvider>);
}

afterEach(() => { vi.unstubAllGlobals(); document.documentElement.removeAttribute("data-theme"); document.documentElement.removeAttribute("data-appearance"); window.history.pushState({}, "", "/"); });

describe("application shell", () => {
  it("renders the daily, life and system navigation groups with the new module list", async () => {
    mockApi();
    const { container } = renderApp();
    for (const label of ["开发", "测试", "写作", "健身", "饮食", "阅读", "首页总览", "数据与设置"]) {
      expect(await screen.findByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(Array.from(container.querySelectorAll(".nav-label")).map((node) => node.textContent)).toEqual(["日常", "生活", "系统"]);
    for (const removed of ["今日计划", "自媒体", "咨询工作", "游戏娱乐", "日常睡眠"]) {
      expect(screen.queryByRole("link", { name: removed })).not.toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /搜索所有内容/ })).toBeInTheDocument();
    expect(screen.getByText("仅保存在这台电脑")).toBeInTheDocument();
    expect(container.querySelector(".brand-copy strong")).toHaveTextContent("日常事务工作台");
    expect(container.querySelector(".brand-mark img")).toHaveAttribute("src", "/assets/brand/daily-workspace-mark.svg");
    expect(container.querySelector(".brand-mark")).toHaveTextContent("");
  });

  it("applies the persisted theme to the document", async () => {
    mockApi("dark");
    renderApp();
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
  });

  it("always uses the single notebook appearance regardless of missing, legacy or removed settings", async () => {
    mockApi("light", null, "glass");
    const first = renderApp();
    await waitFor(() => expect(document.documentElement.dataset.appearance).toBe("notebook"));
    expect(first.container.querySelector(".notebook-environment")).toBeInTheDocument();
    expect(first.container.querySelector(".ambient-environment")).not.toBeInTheDocument();
    expect(first.container.querySelector(".neo-shell")).not.toBeInTheDocument();
    first.unmount();

    mockApi("light", null, "liquid");
    const second = renderApp();
    await waitFor(() => expect(document.documentElement.dataset.appearance).toBe("notebook"));
    second.unmount();

    mockApi("dark", null, "neo");
    const third = renderApp();
    await waitFor(() => expect(document.documentElement.dataset.appearance).toBe("notebook"));
    expect(third.container.querySelector(".app-shell")).not.toHaveClass("neo-shell");
    expect(third.container.querySelectorAll(".neo-nav-emblem")).toHaveLength(0);
    third.unmount();

    mockApi();
    renderApp();
    await waitFor(() => expect(document.documentElement.dataset.appearance).toBe("notebook"));
  });

  it("keeps the notebook environment in dark theme without liquid or neo layers", async () => {
    mockApi("dark", null, "notebook");
    const { container } = renderApp();
    await waitFor(() => expect(document.documentElement.dataset.appearance).toBe("notebook"));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    expect(container.querySelector(".notebook-environment")).toBeInTheDocument();
    expect(container.querySelector(".ambient-environment")).not.toBeInTheDocument();
    expect(container.querySelector(".neo-shell")).not.toBeInTheDocument();
  });

  it("does not expose any appearance switcher in the shell", async () => {
    mockApi("dark", null, "neo");
    const { container } = renderApp();
    await waitFor(() => expect(document.documentElement.dataset.appearance).toBe("notebook"));
    expect(container.querySelector(".appearance-toggle")).not.toBeInTheDocument();
    expect(container.querySelector(".style-toggle")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "界面风格" })).not.toBeInTheDocument();
    expect(container.querySelector(".brand-mark img")).toHaveAttribute("src", "/assets/brand/daily-workspace-mark.svg");
  });

  it("shows save failure instead of a false saved state", async () => {
    mockApi();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><WorkspaceProvider><SaveFailureTrigger /><App /></WorkspaceProvider></QueryClientProvider>);
    await userEvent.click(await screen.findByRole("button", { name: "制造保存失败" }));
    expect(await screen.findByRole("status")).toHaveTextContent("保存失败");
  });

  it("offers a manual save button and confirms a successful disk save", async () => {
    const fetchMock = mockApi();
    renderApp();
    await userEvent.click(await screen.findByRole("button", { name: "手动保存" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/system/save",
      expect.objectContaining({ method: "POST" }),
    ));
    expect(await screen.findByRole("status")).toHaveTextContent("已保存");
  });

  it("saves pending data before requesting a safe service exit", async () => {
    const fetchMock = mockApi();
    renderApp();
    await userEvent.click(await screen.findByRole("button", { name: "保存并退出" }));
    expect(await screen.findByText("数据已保存，日常事务工作台已安全退出")).toBeInTheDocument();
    const calls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(calls).toContain("/api/system/save");
    expect(calls).toContain("/api/system/save-and-exit");
    expect(calls.indexOf("/api/system/save")).toBeLessThan(calls.indexOf("/api/system/save-and-exit"));
  });

  it("surfaces automatic backup failure in the application shell", async () => {
    mockApi("light", { state: "error", lastError: "备份目录不可写" });
    renderApp();
    expect(await screen.findByText("自动备份失败")).toBeInTheDocument();
    expect(screen.getByText("备份目录不可写")).toBeInTheDocument();
  });
});
