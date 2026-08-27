/**
 * dsh-fail-soft - Host half:
 * Installs global process unhandledRejection / uncaughtException traps
 * to prevent broken plugin async errors from crashing the entire DSH process.
 * Injects immutable A/B Slot self-healing & development Hard Invariants into SystemPrompt.
 */

export const name = 'fail-soft';
export const inject = ['systemPrompt'];

export function apply(ctx) {
  const logger = ctx.logger || console;

  // 1. Process-level safety net for unhandled rejections from buggy plugins
  const onUnhandledRejection = (reason, promise) => {
    logger.warn('[fail-soft] Intercepted unhandled promise rejection from plugin runtime:', reason);
  };

  const onUncaughtException = (error) => {
    logger.error('[fail-soft] Intercepted uncaught exception from plugin runtime:', error);
  };

  process.on('unhandledRejection', onUnhandledRejection);
  process.on('uncaughtException', onUncaughtException);

  ctx.effect(() => {
    return () => {
      process.removeListener('unhandledRejection', onUnhandledRejection);
      process.removeListener('uncaughtException', onUncaughtException);
    };
  }, 'fail-soft: process traps');

  // 2. System Prompt Injection: A/B 槽位自愈与自我演进铁律 (Hard Invariants)
  ctx.inject(['systemPrompt'], (promptCtx) => {
    try {
      promptCtx.systemPrompt.section({
        name: 'guardian:ab-testing-hard-invariants',
        order: -95,
        text: `# DSH Antigravity Action 架构规范与行为铁律 (Hard Invariants)

你作为运行在 GitHub Actions Runner 云端自愈容器中的 AI Agent，必须无条件严格遵守以下铁律：

1. 🚫 严禁越权干预自愈槽位 (~/.dsh/slots/)：
   - ~/.dsh/slots/slot-a 是宿主守护程序独占的黄金稳定快照；
   - 绝对禁止 Agent 使用任何手段手动覆盖、修改、删除或调用 promote 固化 Slot A；
   - 晋升与回滚只能由 start.sh 守护程序在通过 Slot B 深度健康探针后全自动执行。
2. 🔄 A/B 测试标准闭环工作流（修改代码后）：
   - 阶段 1 (代码开发与测试)：在工作区完成代码修改与语义级测试；
   - 阶段 2 (暂存至 B 槽)：执行 \`./start.sh stage-b\` 将最新修改暂存至 Slot B 候选槽；
   - 阶段 3 (守护程序接管与探针)：守护程序自动以 Slot B 重启并执行进程存活、HTTP 200 握手、启动日志扫描的三位一体深度健康探针；
   - 阶段 4 (全自动晋升闭环)：健康探针通过后，执行 \`git commit && git push\`；守护程序检测到干净提交后全自动将 Slot B 晋升为 Slot A 黄金快照。
3. 🚫 严禁臆断「服务没崩即配置正常」：
   - dsh-fail-soft 会全局捕获未处理的异常，插件加载失败或 Schema 错误不会导致 Node 进程退出；
   - 任何涉及功能变更的修改，必须进行端到端语义级实测验证（调用工具测试、HTTP 握手、API 探针），严禁仅凭进程存活宣称完成。
4. 🚫 严禁在 GitHub Actions 运行期修改工作流文件：
   - 严禁直接改动 .github/workflows/ 目录下的任何文件；所有逻辑、依赖与生命周期调整统一在 start.sh 中完成。`,
      });
      logger.info?.('[fail-soft] Injected A/B slot guardian rules into systemPrompt.');
    } catch (e) {
      logger.warn?.('[fail-soft] Failed to inject systemPrompt section:', e);
    }
  });

  logger.info?.('[fail-soft] Global fault isolation and error boundary active.');
}
