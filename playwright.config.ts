import path from "node:path";
import { chromium, defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // 完整验收覆盖单一 Notion 外观下的新模块清单、内联图标与本地数据链路；
  // 共享 CI runner 的冷启动明显慢于本机，给完整用例留出足够执行时间。
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    launchOptions: { executablePath: chromium.executablePath() },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000/api/health",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: "test",
      MUZI_DATA_DIR: path.resolve(".test-data/e2e"),
      MUZI_PORT: "4327",
    },
  },
});
