import { h, VNode } from 'preact';
import { ApprovalRequest } from '../store/types';
import { AlertTriangleIcon, ShieldIcon } from './Icons';

export function ApprovalSheet({
  approval,
  onRespond,
}: {
  approval: ApprovalRequest | null;
  onRespond: (outcome: 'allowed-once' | 'rejected') => void;
}): VNode | null {
  if (!approval) return null;

  return (
    <div class="sheet-backdrop">
      <div class="sheet-card" style="border-top-color: var(--warning);">
        <div class="sheet-handle-bar">
          <div class="sheet-handle"></div>
        </div>

        <div class="sheet-header" style="background: var(--warning-glass);">
          <div class="flex items-center gap-2" style="color: var(--warning);">
            <AlertTriangleIcon size={20} />
            <span class="sheet-title" style="color: var(--warning);">权限审批请求</span>
          </div>
          <span class="status-badge" style="background: var(--warning); color: #000; font-weight: 600;">
            等待确认
          </span>
        </div>

        <div class="sheet-content">
          <div style="margin-bottom: 12px;">
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">请求执行工具</div>
            <div style="font-size: 15px; font-weight: 600; color: var(--text-primary);">
              {approval.toolName}
            </div>
          </div>

          {approval.reason && (
            <div style="margin-bottom: 16px;">
              <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">申请理由</div>
              <div style="font-size: 14px; background: var(--bg-tertiary); padding: 10px 12px; border-radius: var(--radius-md); line-height: 1.5; color: var(--text-primary); word-break: break-word;">
                {approval.reason}
              </div>
            </div>
          )}

          <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); margin-bottom: 20px;">
            <ShieldIcon size={14} />
            <span>执行后将获得单次权限授权</span>
          </div>

          <div style="display: flex; gap: 10px;">
            <button
              style="flex: 1; height: 44px; border-radius: var(--radius-md); border: 1px solid var(--danger); background: transparent; color: var(--danger); font-size: 15px; font-weight: 600; cursor: pointer;"
              onClick={() => onRespond('rejected')}
            >
              拒绝 (Reject)
            </button>
            <button
              style="flex: 1; height: 44px; border-radius: var(--radius-md); border: none; background: var(--success); color: #ffffff; font-size: 15px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px rgba(63, 185, 80, 0.4);"
              onClick={() => onRespond('allowed-once')}
            >
              允许执行 (Allow)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
