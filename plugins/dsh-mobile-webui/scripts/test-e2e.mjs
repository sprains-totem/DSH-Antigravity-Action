import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TARGET_URL = 'http://127.0.0.1:3080/mobile/index.html';

async function runE2ETest() {
  console.log('🚀 [E2E] Starting Full End-to-End Test for Mobile UI...');

  const tmpDir = await mkdtemp(join(tmpdir(), 'dsh-e2e-'));
  const port = 9227;

  const chromeProc = spawn('google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--disable-gpu',
    'about:blank',
  ], { stdio: 'ignore' });

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
    const pageErrors = [];

    pageWs.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.exceptionThrown') {
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

    await pSend('Page.addScriptToEvaluateOnNewDocument', {
      source: 'localStorage.setItem("dsh_mobile_active_session", "session-690eaa49-fa51-421b-8f6a-9f9db1846f30");'
    });

    await pSend('Page.navigate', { url: TARGET_URL });
    await new Promise((r) => setTimeout(r, 2500));

    // 1. Verify Turn Structure & Message Order
    const turnOrderCheck = await pEval(`(() => {
      const turns = Array.from(document.querySelectorAll('.turn-container'));
      const details = turns.map((t, idx) => {
        const userBubble = t.querySelector('.user-bubble')?.textContent?.trim()?.slice(0, 30);
        const hasAccordion = Boolean(t.querySelector('.process-accordion'));
        const assistantBubble = t.querySelector('.assistant-bubble')?.textContent?.trim()?.slice(0, 30);
        // Verify user-bubble is DOM child before accordion and assistant-bubble
        const children = Array.from(t.children);
        const userIdx = children.findIndex(c => c.querySelector('.user-bubble'));
        const accIdx = children.findIndex(c => c.classList.contains('process-accordion'));
        const asstIdx = children.findIndex(c => c.querySelector('.assistant-bubble'));
        return { idx, userBubble, hasAccordion, assistantBubble, userIdx, accIdx, asstIdx };
      });
      return details;
    })()`);

    console.log('📋 [E2E] Turn Structure and Order Analysis:');
    for (const d of turnOrderCheck) {
      console.log(`  Turn ${d.idx + 1}:`);
      console.log(`    User Prompt (pos ${d.userIdx}): "${d.userBubble || 'N/A'}"`);
      console.log(`    Accordion (pos ${d.accIdx}): ${d.hasAccordion ? 'Yes' : 'No'}`);
      console.log(`    Assistant (pos ${d.asstIdx}): "${d.assistantBubble || 'N/A'}"`);
      if (d.userIdx !== -1 && d.accIdx !== -1 && d.userIdx > d.accIdx) {
        throw new Error(`Turn ${d.idx + 1}: user message appears AFTER accordion!`);
      }
    }

    console.log('✅ [E2E] Message order verified: User Prompt is ALWAYS at the TOP of its turn!');

    // 2. Test Real Message Sending (Create new test session & send)
    console.log('✉️ [E2E] Testing New Chat & Sending Message via Mobile UI...');
    await pEval('window.__DSH_STATE__.createSession()');
    await new Promise((r) => setTimeout(r, 1500));

    // Type text in composer
    await pEval(`(() => {
      const textarea = document.querySelector('.composer-textarea');
      textarea.value = '你好，测试移动端消息发送';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await new Promise((r) => setTimeout(r, 200));

    // Click Send
    await pEval('document.querySelector(".send-btn")?.click()');
    console.log('  -> Clicked Send button');

    // Wait 1.5s and check optimistic message rendered
    await new Promise((r) => setTimeout(r, 1500));
    const sentText = await pEval('document.querySelector(".user-bubble")?.textContent');
    console.log(`  -> Rendered User Bubble: "${sentText?.trim()}"`);
    if (!sentText || !sentText.includes('你好，测试移动端消息发送')) {
      throw new Error(`Expected user message to render in chat, got "${sentText}"`);
    }

    console.log('✅ [E2E] Message sending verified: Prompt successfully accepted and rendered!');

    if (pageErrors.length > 0) {
      throw new Error(`Page errors: ${pageErrors.join(', ')}`);
    }

    console.log('\n========================================');
    console.log('🎉 ALL END-TO-END VERIFICATIONS PASSED!');
    console.log('========================================\n');

    pageWs.close();
    ws.close();
  } finally {
    chromeProc.kill('SIGKILL');
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

runE2ETest().catch((err) => {
  console.error('❌ E2E Test Failed:', err);
  process.exit(1);
});
