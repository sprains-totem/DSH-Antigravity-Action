import { h, VNode } from 'preact';
import { ConnectionState } from '../store/types';
import { LoaderIcon } from './Icons';

export function ConnectionStatus({ state }: { state: ConnectionState }): VNode {
  if (state === 'connected') {
    return (
      <div class="flex items-center gap-1.5" title="在线">
        <span style="width: 7px; height: 7px; border-radius: 50%; background: var(--success); display: inline-block;"></span>
      </div>
    );
  }

  if (state === 'reconnecting' || state === 'connecting') {
    return (
      <div class="flex items-center gap-1 text-xs" style="color: var(--warning);" title="正在重连中...">
        <LoaderIcon size={12} />
        <span style="font-size: 11px;">连接中</span>
      </div>
    );
  }

  return (
    <div class="flex items-center gap-1 text-xs" style="color: var(--danger);" title="已离线">
      <span style="width: 7px; height: 7px; border-radius: 50%; background: var(--danger); display: inline-block;"></span>
      <span style="font-size: 11px;">离线</span>
    </div>
  );
}
