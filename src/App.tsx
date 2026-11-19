import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppLayout } from "./components/Layout";
import { ErrorState, Skeleton } from "./components/ui";

const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const TodayPage = lazy(() => import("./pages/TodayPage").then((module) => ({ default: module.TodayPage })));
const MediaPage = lazy(() => import("./pages/MediaPage").then((module) => ({ default: module.MediaPage })));
const DevelopmentPage = lazy(() => import("./pages/DevelopmentPage").then((module) => ({ default: module.DevelopmentPage })));
const ConsultingPage = lazy(() => import("./pages/ConsultingPage").then((module) => ({ default: module.ConsultingPage })));
const FitnessPage = lazy(() => import("./pages/FitnessPage").then((module) => ({ default: module.FitnessPage })));
const DietPage = lazy(() => import("./pages/DietPage").then((module) => ({ default: module.DietPage })));
const EntertainmentPage = lazy(() => import("./pages/EntertainmentPage").then((module) => ({ default: module.EntertainmentPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const TestingPage = lazy(() => import("./pages/TestingPage").then((module) => ({ default: module.TestingPage })));
const WritingPage = lazy(() => import("./pages/WritingPage").then((module) => ({ default: module.WritingPage })));
const ReadingPage = lazy(() => import("./pages/ReadingPage").then((module) => ({ default: module.ReadingPage })));
const SleepPage = lazy(() => import("./pages/SleepPage").then((module) => ({ default: module.SleepPage })));

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Skeleton lines={8} />}>{children}</Suspense>;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <div className="route-error"><ErrorState message="页面无法打开，请返回首页后重试。" /></div>,
    children: [
      { index: true, element: <LazyPage><DashboardPage /></LazyPage> },
      // 新清单：日常 / 生活
      { path: "development", element: <LazyPage><DevelopmentPage /></LazyPage> },
      { path: "testing", element: <LazyPage><TestingPage /></LazyPage> },
      { path: "writing", element: <LazyPage><WritingPage /></LazyPage> },
      { path: "fitness", element: <LazyPage><FitnessPage /></LazyPage> },
      { path: "diet", element: <LazyPage><DietPage /></LazyPage> },
      { path: "reading", element: <LazyPage><ReadingPage /></LazyPage> },
      { path: "sleep", element: <LazyPage><SleepPage /></LazyPage> },
      { path: "settings", element: <LazyPage><SettingsPage /></LazyPage> },
      // 旧模块从侧边栏移除，但保留路由与全部历史数据，仍可通过搜索或直接访问打开。
      { path: "today", element: <LazyPage><TodayPage /></LazyPage> },
      { path: "media", element: <LazyPage><MediaPage /></LazyPage> },
      { path: "consulting", element: <LazyPage><ConsultingPage /></LazyPage> },
      { path: "entertainment", element: <LazyPage><EntertainmentPage /></LazyPage> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
