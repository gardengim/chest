import type { Activity, Instance } from './types';

export type InstanceChoice = 'group' | 'open' | 'action' | 'repair' | 'folder' | 'settings' | 'console' | 'duplicate' | 'export' | 'delete';

export function instanceStatus(instance: Instance, activity?: Activity) {
  return activity?.phase || (instance.version === 'pending' ? 'Modpack queued' : instance.installed ? 'Ready to play' : 'Not installed');
}

// One description of the primary action and mutation guards for every entry point.
export function instanceUI(instance: Instance, activity?: Activity) {
  const status = activity?.status || 'idle';
  const transitional = ['pausing', 'starting', 'stopping'].includes(status);
  const busy = transitional || ['installing', 'paused', 'running'].includes(status);
  const pending = instance.version === 'pending';
  const command = transitional ? null
    : status === 'installing' ? 'pause'
    : status === 'paused' ? 'resume'
    : status === 'running' ? 'stop'
    : !instance.installed || status === 'failed' ? 'install' : 'launch';
  const labels: Record<string, string> = {
    paused: 'Paused', pausing: 'Pausing…', starting: 'Starting…',
    stopping: 'Stopping…', running: 'Running', failed: 'Retry',
  };
  const label = status === 'installing'
    ? activity?.progress == null ? 'Installing…' : `Installing · ${Math.floor(activity.progress * 100)}%`
    : labels[status] || (instance.installed ? 'Play' : 'Install');
  const actionLabel = ({ pause: 'Pause', resume: 'Resume', stop: 'Stop' } as Record<string, string>)[command || ''] || label;
  const icon = status === 'running' ? 'running' : command === 'stop' || status === 'stopping' ? 'stop'
    : command === 'launch' || command === 'resume' || status === 'starting' ? 'play' : 'download';
  return {
    busy, pending, transitional, command, label, actionLabel, icon,
    actionIcon: command === 'stop' ? 'stop' : command === 'pause' ? 'pause' : icon,
    showProgress: ['installing', 'pausing', 'paused'].includes(status),
    canCopy: !busy && !pending,
  };
}
