import { spawn, execFile } from 'node:child_process';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const name = 'easytier';
const inject = [];
const NS = 'easytier';

/**
 * 查找 EasyTier 二进制文件路径
 */
export function findEasyTierBinary(binName = 'easytier-core') {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const searchCandidates = [
    binName, // PATH
    `/usr/local/bin/${binName}`,
    `/usr/bin/${binName}`,
    `/home/runner/work/easytier/bin/easytier-linux-x86_64/${binName}`,
    path.join(home, '.easytier', 'bin', binName),
    path.join(home, '.dsh', 'bin', binName)
  ];

  for (const candidate of searchCandidates) {
    if (candidate === binName) continue; // PATH 由 spawn 自动解析
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return binName;
}

/**
 * 规范化 Peers 列表
 */
function normalizePeers(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(p => String(p).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[\s,;\n]+/)
      .map(p => p.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * EasyTier Mesh 网络与子进程生命周期管理器
 */
export class EasyTierManager {
  ctx;
  config;
  process = null;
  status = 'idle'; // idle | starting | running | stopped | error | unconfigured
  error = null;
  virtualIp = null;
  url = null;
  networkName = null;
  peerId = null;
  peers = [];
  stunInfo = null;

  #pollTimer = null;
  #restartTimer = null;
  #disposed = false;

  constructor(ctx, config) {
    this.ctx = ctx;
    this.config = config || {};
  }

  getEffectiveConfig() {
    const env = process.env;
    const cfg = this.config || {};

    const networkName =
      env.EASYTIER_NETWORK_NAME ||
      env.INPUT_EASYTIER_NETWORK_NAME ||
      cfg.networkName ||
      '';

    const networkSecret =
      env.EASYTIER_NETWORK_SECRET ||
      env.INPUT_EASYTIER_NETWORK_SECRET ||
      cfg.networkSecret ||
      '';

    const ipv4 =
      env.EASYTIER_IPV4 ||
      env.INPUT_EASYTIER_IPV4 ||
      cfg.ipv4 ||
      '';

    const rawPeers =
      env.EASYTIER_PEERS ||
      env.INPUT_EASYTIER_PEERS ||
      cfg.peers ||
      [
        'tcp://39.108.52.138:11010',
        'tcp://easytier-us.slarker.me:11010',
        'tcp://public.easytier.top:11010'
      ];

    const peers = normalizePeers(rawPeers);

    const noTun =
      env.EASYTIER_NO_TUN !== undefined
        ? env.EASYTIER_NO_TUN !== 'false' && env.EASYTIER_NO_TUN !== '0'
        : cfg.noTun !== false; // 容器内默认开启 --no-tun

    const useSmoltcp =
      env.EASYTIER_USE_SMOLTCP !== undefined
        ? env.EASYTIER_USE_SMOLTCP !== 'false' && env.EASYTIER_USE_SMOLTCP !== '0'
        : cfg.useSmoltcp !== false;

    const rpcPortal =
      env.EASYTIER_RPC_PORTAL ||
      env.EASYTIER_RPC_PORT ||
      cfg.rpcPortal ||
      '127.0.0.1:15888';

    const rpcPortNumber = rpcPortal.includes(':') ? rpcPortal.split(':')[1] : rpcPortal;

    const port = Number(cfg.port || env.DSH_PORT || 3080);

    const enabled =
      env.EASYTIER_ENABLED !== undefined
        ? env.EASYTIER_ENABLED !== 'false' && env.EASYTIER_ENABLED !== '0'
        : cfg.enabled !== false;

    return {
      enabled,
      networkName,
      networkSecret,
      ipv4,
      peers,
      noTun,
      useSmoltcp,
      rpcPortal: rpcPortal.includes(':') ? rpcPortal : `127.0.0.1:${rpcPortal}`,
      rpcPortNumber,
      port,
      binPath: cfg.binPath || findEasyTierBinary('easytier-core'),
      cliPath: cfg.cliPath || findEasyTierBinary('easytier-cli'),
      extraArgs: cfg.extraArgs || []
    };
  }

  async start() {
    if (this.process) return this.url;

    const conf = this.getEffectiveConfig();

    if (!conf.networkName) {
      this.status = 'unconfigured';
      this.ctx.logger?.info?.(
        '[easytier] EasyTier is loaded but waiting for network configuration (EASYTIER_NETWORK_NAME or WebUI settings).'
      );
      return null;
    }

    this.status = 'starting';
    this.error = null;
    this.networkName = conf.networkName;

    const args = [
      '--network-name', conf.networkName,
      '--console-log-level', 'info',
      '-r', conf.rpcPortal
    ];

    if (conf.networkSecret) {
      args.push('--network-secret', conf.networkSecret);
    }

    if (conf.ipv4) {
      args.push('-i', conf.ipv4);
    } else {
      // 若未指定固定 IPv4，则默认启用 EasyTier DHCP 自动分配
      args.push('-d', 'true');
    }

    if (conf.noTun) {
      args.push('--no-tun');
    }

    if (conf.useSmoltcp) {
      args.push('--use-smoltcp');
    }

    if (conf.peers && conf.peers.length > 0) {
      for (const peer of conf.peers) {
        args.push('-p', peer);
      }
    }

    if (Array.isArray(conf.extraArgs)) {
      args.push(...conf.extraArgs);
    }

    this.ctx.logger?.info?.(
      `[easytier] Spawning easytier-core (network: ${conf.networkName}, no-tun: ${conf.noTun}, rpc: ${conf.rpcPortal})...`
    );

    try {
      const cp = spawn(conf.binPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NO_COLOR: '1' }
      });
      this.process = cp;

      cp.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        // 尝试从日志中探测 Virtual IP
        const ipMatch = text.match(/(?:Virtual IP|ipv4)[^\d]+(\d+\.\d+\.\d+\.\d+)/i);
        if (ipMatch && !this.virtualIp) {
          this.setVirtualIp(ipMatch[1], conf.port);
        }
      });

      cp.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        if (text.includes('ERROR') || text.includes('error=')) {
          this.ctx.logger?.warn?.(`[easytier-stderr] ${text.trim()}`);
        }
      });

      cp.on('error', (err) => {
        this.status = 'error';
        this.error = err.message;
        this.ctx.logger?.error?.(`[easytier] Failed to launch ${conf.binPath}: ${err.message}`);
      });

      cp.on('close', (code, signal) => {
        this.ctx.logger?.warn?.(`[easytier] Process exited (code: ${code}, signal: ${signal})`);
        const wasRunning = this.status === 'running' || this.status === 'starting';
        this.status = 'stopped';
        this.process = null;
        this.virtualIp = null;
        this.url = null;
        this.ctx.emit('easytier/close', { code, signal });

        if (wasRunning && conf.enabled !== false && !this.#disposed) {
          this.ctx.logger?.info?.('[easytier] Attempting restart in 5 seconds...');
          this.#restartTimer = setTimeout(() => {
            if (!this.#disposed) this.start();
          }, 5000);
        }
      });

      // 启动状态轮询
      this.startPolling(conf);

      return this.url;
    } catch (err) {
      this.status = 'error';
      this.error = err.message;
      this.ctx.logger?.error?.(`[easytier] Spawn exception: ${err.message}`);
      return null;
    }
  }

  setVirtualIp(ip, port) {
    if (!ip) return;
    const cleanIp = ip.split('/')[0].trim();
    if (!cleanIp) return;

    this.virtualIp = cleanIp;
    this.url = `http://${this.virtualIp}:${port}`;
    this.status = 'running';

    this.ctx.logger?.info?.(
      `[easytier] ✅ EasyTier Virtual Mesh Node is active! Access URL: ${this.url}`
    );

    // 动态注入 trustedHosts
    try {
      const runtime = this.ctx.get('webRuntime');
      if (runtime && Array.isArray(runtime.trustedHosts)) {
        if (!runtime.trustedHosts.includes(this.virtualIp)) {
          runtime.trustedHosts.push(this.virtualIp);
        }
      }
    } catch {}

    // 保存状态到持久化文件
    this.recordStatus(port);

    this.ctx.emit('easytier/ready', {
      virtualIp: this.virtualIp,
      url: this.url,
      networkName: this.networkName
    });
  }

  recordStatus(port) {
    try {
      const home = process.env.HOME || process.env.USERPROFILE || '';
      const statusData = {
        networkName: this.networkName,
        virtualIp: this.virtualIp,
        url: this.url,
        port,
        status: this.status,
        peerId: this.peerId,
        peersCount: this.peers.length,
        timestamp: new Date().toISOString()
      };

      const filePaths = [
        path.join(home, '.dsh', 'easytier_status.json'),
        path.join(process.cwd(), 'status.json')
      ];

      for (const fp of filePaths) {
        try {
          let merged = { ...statusData };
          if (fp.endsWith('status.json') && existsSync(fp)) {
            try {
              const existing = JSON.parse(readFileSync(fp, 'utf8'));
              merged = { ...existing, easytier: statusData };
            } catch {}
          }
          writeFileSync(fp, JSON.stringify(merged, null, 2), 'utf8');
        } catch {}
      }

      if (process.env.GITHUB_STEP_SUMMARY) {
        try {
          const summaryText = `\n### 🌐 EasyTier Mesh Network Status\n- **Virtual IP**: \`${this.virtualIp}\`\n- **Web Access**: [${this.url}](${this.url})\n- **Network Name**: \`${this.networkName}\`\n- **Mode**: No-TUN (User-space Transparent Forwarding)\n`;
          writeFileSync(process.env.GITHUB_STEP_SUMMARY, summaryText, { flag: 'a' });
        } catch {}
      }
    } catch {}
  }

  startPolling(conf) {
    if (this.#pollTimer) clearInterval(this.#pollTimer);

    const poll = async () => {
      if (this.#disposed || !this.process) return;
      try {
        const cli = conf.cliPath;
        // 查询 node 信息
        const { stdout: nodeJson } = await execFileAsync(
          cli,
          ['-p', conf.rpcPortal, '-o', 'json', 'node'],
          { timeout: 3000 }
        );
        const nodeInfo = JSON.parse(nodeJson);
        if (nodeInfo) {
          this.peerId = nodeInfo.peer_id;
          this.stunInfo = nodeInfo.stun_info;
          if (nodeInfo.ipv4_addr && !this.virtualIp) {
            this.setVirtualIp(nodeInfo.ipv4_addr, conf.port);
          }
        }

        // 查询 peer 信息
        const { stdout: peerJson } = await execFileAsync(
          cli,
          ['-p', conf.rpcPortal, '-o', 'json', 'peer'],
          { timeout: 3000 }
        );
        const peerList = JSON.parse(peerJson);
        if (Array.isArray(peerList)) {
          this.peers = peerList;
        }
      } catch (e) {
        // RPC 探针在启动初期可能未就绪，保持优雅等待
      }
    };

    // 快速探测前几次
    setTimeout(poll, 1500);
    setTimeout(poll, 4000);
    setTimeout(poll, 8000);

    // 常规轮询
    this.#pollTimer = setInterval(poll, 15000);
  }

  stop() {
    if (this.#pollTimer) {
      clearInterval(this.#pollTimer);
      this.#pollTimer = null;
    }
    if (this.#restartTimer) {
      clearTimeout(this.#restartTimer);
      this.#restartTimer = null;
    }
    if (this.process) {
      try {
        this.process.kill('SIGTERM');
        setTimeout(() => {
          if (this.process) {
            try { this.process.kill('SIGKILL'); } catch {}
          }
        }, 3000);
      } catch {}
      this.process = null;
    }
    this.status = 'stopped';
    this.virtualIp = null;
    this.url = null;
  }

  async restart() {
    this.stop();
    await new Promise(r => setTimeout(r, 1000));
    return this.start();
  }

  dispose() {
    this.#disposed = true;
    this.stop();
  }
}

export function apply(ctx, config) {
  const manager = new EasyTierManager(ctx, config);

  try {
    ctx.set('easytier', manager);
  } catch {}

  // 1. 动态注入 WebRuntime 白名单
  ctx.inject(['webRuntime'], (runtimeCtx) => {
    try {
      const runtime = runtimeCtx.webRuntime;
      if (runtime && Array.isArray(runtime.trustedHosts) && manager.virtualIp) {
        if (!runtime.trustedHosts.includes(manager.virtualIp)) {
          runtime.trustedHosts.push(manager.virtualIp);
        }
      }
    } catch {}
  });

  // 2. Shell 环境变量集成
  ctx.inject(['shellEnv'], (runtimeCtx) => {
    try {
      runtimeCtx.shellEnv.register({
        name: 'easytier',
        variables: {
          DSH_EASYTIER_IPV4: { description: 'Virtual IP of this node in EasyTier mesh network.' },
          DSH_EASYTIER_URL: { description: 'Full access URL of DeepSeek Harness via EasyTier.' },
          DSH_EASYTIER_NETWORK_NAME: { description: 'Name of the connected EasyTier virtual network.' }
        },
        resolve: () => ({
          DSH_EASYTIER_IPV4: manager.virtualIp || '',
          DSH_EASYTIER_URL: manager.url || '',
          DSH_EASYTIER_NETWORK_NAME: manager.networkName || ''
        })
      });
    } catch {}
  });

  // 3. System Prompt 上下文集成
  ctx.inject(['systemPrompt'], (promptCtx) => {
    try {
      promptCtx.systemPrompt.section({
        name: 'app:easytier',
        order: -84,
        text: () => {
          if (manager.url && manager.virtualIp) {
            return `The DeepSeek Harness Web GUI is also accessible within the EasyTier mesh network at: ${manager.url} (Virtual IP: ${manager.virtualIp}, Network: ${manager.networkName}). Other peers in the same EasyTier network can connect without root/TUN privileges.`;
          }
          return '';
        }
      });
    } catch {}
  });

  // 4. Agent Tools 模型工具集成
  ctx.inject(['tools'], (toolCtx) => {
    try {
      toolCtx.tools.register({
        name: 'get_easytier_status',
        description: 'Get the current status, virtual IP, mesh access URL, and peers count of EasyTier network.',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({
          status: manager.status,
          networkName: manager.networkName,
          virtualIp: manager.virtualIp,
          url: manager.url,
          peerId: manager.peerId,
          peersCount: manager.peers.length,
          stunInfo: manager.stunInfo,
          error: manager.error
        })
      });

      toolCtx.tools.register({
        name: 'get_easytier_peers',
        description: 'Get the detailed list of connected peers in the EasyTier mesh network, including latency, cost, and tunnel protocol.',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({
          networkName: manager.networkName,
          virtualIp: manager.virtualIp,
          peers: manager.peers
        })
      });
    } catch {}
  });

  // 5. 自动启动
  const effective = manager.getEffectiveConfig();
  if (effective.enabled && effective.networkName) {
    manager.start();
  } else {
    manager.status = effective.networkName ? 'stopped' : 'unconfigured';
  }

  ctx.on('dispose', () => {
    manager.dispose();
  });
}

export { name, inject, NS };
