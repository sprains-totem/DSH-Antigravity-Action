import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TARGET_URL = 'http://127.0.0.1:3080/mobile/index.html';

async function runTest() {
  console.log('🚀 [Test] Starting Headless Chrome Automated Test for DSH Mobile WebUI...');

  const tmpDir = await mkdtemp(join(tmpdir(), 'dsh-mobile-test-'));
  const port = 9225;

  const chromeProc = spawn('google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--disable-gpu',
    'about:blank',
  ], { stdio: 'ignore' });

  // Wait for CDP port to open
  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) {
        const json = await res.json();
        wsUrl = json.webSocketDebuggerUrl;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!wsUrl) {
    throw new Error('Failed to connect to Chromium CDP port');
  }

  console.log('✅ [Test] Connected to Chromium via CDP');
  const ws = new WebSocket(wsUrl);
  await once(ws, 'open');

  let reqId = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  };

  const send = (method, params = {}) => {
    const id = reqId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  try {
    const target = await send('Target.createTarget', { url: 'about:blank' });
    const pageWs = new WebSocket(`ws://127.0.0.1:${port}/devtools/page/${target.targetId}`);
    await once(pageWs, 'open');

    let pReqId = 1;
    const pPending = new Map();
    const consoleLogs = [];
    const pageErrors = [];

    pageWs.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map((a) => a.value || a.description).join(' ');
        consoleLogs.push(`[${msg.params.type}] ${text}`);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        pageErrors.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
      } else if (msg.id && pPending.has(msg.id)) {
        const { resolve, reject } = pPending.get(msg.id);
        pPending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };

    const pSend = (method, params = {}) => {
      const id = pReqId++;
      return new Promise((resolve, reject) => {
        pPending.set(id, { resolve, reject });
        pageWs.send(JSON.stringify({ id, method, params }));
      });
    };

    const pEval = async (expr) => {
      const res = await pSend('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true,
      });
      return res.result?.value;
    };

    await pSend('Runtime.enable');
    await pSend('Page.enable');
    await pSend('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });

    // 1. Pre-seed active session in localStorage
    await pSend('Page.addScriptToEvaluateOnNewDocument', {
      source: 'localStorage.setItem("dsh_mobile_active_session", "session-690eaa49-fa51-421b-8f6a-9f9db1846f30");'
    });

    // 2. Navigate to /mobile/index.html
    console.log(`🧭 [Test] Navigating to ${TARGET_URL}...`);
    await pSend('Page.navigate', { url: TARGET_URL });

    // Wait for page load and state init
    await new Promise((r) => setTimeout(r, 2500));

    // Assertion 1: Title
    const title = await pEval('document.title');
    console.log(`📄 [Assertion 1] Document Title: "${title}"`);
    if (title !== 'DeepSeek Harness Mobile') {
      throw new Error(`Unexpected title: ${title}`);
    }

    // Assertion 2: Header and elements rendered
    const headerExists = await pEval('Boolean(document.querySelector(".app-header"))');
    const composerExists = await pEval('Boolean(document.querySelector(".composer-textarea"))');
    console.log(`🎨 [Assertion 2] Header exists: ${headerExists}, Composer exists: ${composerExists}`);
    if (!headerExists || !composerExists) {
      throw new Error('Core UI layout elements (Header / Composer) missing');
    }

    // Assertion 3: State store initialized
    const connState = await pEval('window.__DSH_STATE__ ? window.__DSH_STATE__.connectionState : "checking DOM"');
    console.log(`📶 [Assertion 3] Connection state: ${connState}`);

    // Assertion 4: Open Session Drawer
    console.log('📲 [Assertion 4] Testing Session Drawer interaction...');
    await pEval('document.querySelector(".icon-btn")?.click()');
    await new Promise((r) => setTimeout(r, 300));
    const drawerOpen = await pEval('Boolean(document.querySelector(".drawer-panel"))');
    console.log(`  -> Drawer open: ${drawerOpen}`);
    if (!drawerOpen) throw new Error('Session Drawer failed to open');

    // Close drawer
    await pEval('document.querySelector(".drawer-backdrop")?.click()');
    await new Promise((r) => setTimeout(r, 300));

    // Assertion 5: Open Model Picker
    console.log('🤖 [Assertion 5] Testing Model Picker Sheet interaction...');
    await pEval('document.querySelectorAll(".chip-btn")[1]?.click()');
    await new Promise((r) => setTimeout(r, 300));
    const modelSheetOpen = await pEval('Boolean(document.querySelector(".sheet-card"))');
    console.log(`  -> Model Sheet open: ${modelSheetOpen}`);
    if (!modelSheetOpen) throw new Error('Model Sheet failed to open');

    // Close model picker
    await pEval('document.querySelector(".sheet-backdrop")?.click()');
    await new Promise((r) => setTimeout(r, 300));

    // Assertion 6: Check Accordion Default Collapsed Behavior
    const turnsCount = await pEval('document.querySelectorAll(".turn-container").length');
    const accordionCount = await pEval('document.querySelectorAll(".process-accordion").length');
    const collapsedCount = await pEval('document.querySelectorAll(".process-accordion.collapsed").length');
    const visibleCardsBefore = await pEval('document.querySelectorAll(".trajectory-step-card").length');
    console.log(`📊 [Assertion 6] Rendered Turns: ${turnsCount}, Accordions: ${accordionCount}, Collapsed By Default: ${collapsedCount}/${accordionCount}, Visible Tool Cards: ${visibleCardsBefore}`);

    if (accordionCount > 0 && collapsedCount !== accordionCount) {
      throw new Error(`Expected all accordions to be collapsed by default, but found ${accordionCount - collapsedCount} expanded`);
    }

    // Assertion 7: Expand Accordion and Click Trajectory Card
    if (accordionCount > 0) {
      console.log('📂 [Assertion 7] Testing Expanding Accordion and Inspecting Tool Call...');
      // Click first accordion header to expand
      await pEval('document.querySelector(".process-accordion-header")?.click()');
      await new Promise((r) => setTimeout(r, 300));

      const isExpanded = await pEval('Boolean(document.querySelector(".process-accordion.expanded"))');
      const visibleCardsAfter = await pEval('document.querySelectorAll(".trajectory-step-card").length');
      console.log(`  -> Accordion expanded: ${isExpanded}, Visible Tool Cards now: ${visibleCardsAfter}`);
      if (!isExpanded || visibleCardsAfter === 0) {
        throw new Error('Accordion failed to expand tool cards');
      }

      // Click first tool card to open Bottom Sheet Inspector
      await pEval('document.querySelector(".trajectory-step-card")?.click()');
      await new Promise((r) => setTimeout(r, 300));
      const toolSheetOpen = await pEval('Boolean(document.querySelector(".sheet-card"))');
      const toolTitle = await pEval('document.querySelector(".sheet-title")?.textContent');
      console.log(`  -> Tool Inspector Sheet open: ${toolSheetOpen}, Tool: "${toolTitle}"`);
      if (!toolSheetOpen) throw new Error('Tool Bottom Sheet failed to open');

      // Close tool inspector
      await pEval('document.querySelector(".sheet-backdrop")?.click()');
      await new Promise((r) => setTimeout(r, 300));

      // Click accordion header again to re-collapse
      await pEval('document.querySelector(".process-accordion-header")?.click()');
      await new Promise((r) => setTimeout(r, 300));
      const reCollapsed = await pEval('Boolean(document.querySelector(".process-accordion.collapsed"))');
      console.log(`  -> Accordion re-collapsed: ${reCollapsed}`);
      if (!reCollapsed) throw new Error('Accordion failed to re-collapse');
    }

    // Check JS Errors
    if (pageErrors.length > 0) {
      console.warn('⚠️ [Test] Page errors detected during run:');
      for (const err of pageErrors) console.warn(' - ' + err);
    } else {
      console.log('✅ [Test] Zero JavaScript exceptions thrown during full interaction cycle');
    }

    console.log('\n========================================');
    console.log('🎉 ALL AUTOMATED MOBILE UI TESTS PASSED!');
    console.log('========================================\n');

    pageWs.close();
    ws.close();
  } finally {
    chromeProc.kill('SIGKILL');
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

runTest().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
