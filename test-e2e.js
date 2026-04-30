import puppeteer from "puppeteer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXTENSION_PATH = path.resolve(__dirname);

async function runTest() {
  console.log("🚀 Starting E2E Tests for MiniMax Browser Agent...");
  
  if (!process.env.MINIMAX_API_KEY) {
    console.warn("⚠️  No API keys found in .env. The agent will fail to get AI responses.");
  }

  // Launch browser with the extension
  const browser = await puppeteer.launch({
    headless: "new", // Headless mode that supports extensions
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      `--window-size=1280,800`
    ]
  });

  try {
    console.log("⏳ Waiting for extension Service Worker...");
    const workerTarget = await browser.waitForTarget(
      target => target.type() === 'service_worker' && target.url().endsWith('background.js')
    );
    
    const extensionId = workerTarget.url().split('/')[2];
    console.log(`✅ Extension loaded. ID: ${extensionId}`);

    const page = await browser.newPage();
    await page.goto("https://example.com", { waitUntil: "networkidle2" });
    console.log("✅ Target page loaded (https://example.com)");

    // Give content.js (document_idle) time to load completely
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Inject commands directly into the Service Worker context
    // This tests the core functions that handle BROWSER_ACTION and GET_PAGE_CONTENT
    const worker = await workerTarget.worker();

    console.log("⏳ Testing GET_PAGE_CONTENT...");
    const pageContent = await worker.evaluate(async () => {
      return await getActiveTabContent({ mode: "full" });
    });
    if (pageContent && pageContent.title && pageContent.title.includes("Example Domain")) {
      console.log("✅ GET_PAGE_CONTENT passed");
    } else {
      console.error("❌ GET_PAGE_CONTENT failed", pageContent);
      throw new Error("Page content failed");
    }

    console.log("⏳ Testing BROWSER_ACTION: navigate...");
    const navResult = await worker.evaluate(async () => {
      return await executeBrowserAction("navigate", { url: "https://example.com" });
    });
    // BROWSER_ACTION for navigate returns { done: true, url }
    if (navResult && navResult.done) console.log("✅ BROWSER_ACTION (navigate) passed");
    else throw new Error("Navigate failed");

    // Wait a bit for navigation to finish
    await page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {});

    console.log("⏳ Testing BROWSER_ACTION: click (by text)...");
    const clickResult = await worker.evaluate(async () => {
      return await executeBrowserAction("click", { text: "Learn more" });
    });
    if (clickResult && clickResult.success) {
      console.log("✅ BROWSER_ACTION (click) passed");
    } else {
      console.error("❌ Click failed", clickResult);
      throw new Error("Click failed");
    }

    console.log("⏳ Testing TAKE_SCREENSHOT...");
    const ssResult = await worker.evaluate(async () => {
      return await takeScreenshot();
    });
    if (ssResult && ssResult.startsWith("data:image/png")) {
      console.log("✅ TAKE_SCREENSHOT passed");
    } else throw new Error("Screenshot failed");

    console.log("🎉 All core browser extension features passed E2E testing!");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    console.log("Closing browser in 3 seconds...");
    setTimeout(() => browser.close(), 3000);
  }
}

runTest();
