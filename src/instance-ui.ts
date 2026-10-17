import type { Activity, Instance } from './types';

export type InstanceChoice = 'shortcut' | 'group' | 'open' | 'action' | 'repair' | 'folder' | 'settings' | 'console' | 'duplicate' | 'export' | 'delete';

export function instanceStatus(instance: Instance, activity?: Activity) {
  return activity?.phase || (instance.version === 'pending' ? 'Modpack queued' : instance.installed ? 'Ready to play' : 'Not installed');
}

// One description of the primary action and mutation guards for every entry point.
export function instanceUI(instance: Instance, activity?: Activity) {
  const status = activity?.status || 'idle';
  const transitional = ['pausing', 'starting', 'stopping', 'working'].includes(status);
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
  const label = status === 'working' ? activity?.phase || 'Loading…' : status === 'installing'
    ? activity?.progress == null ? 'Installing…' : 'Installing · {percent}%'
    : labels[status] || (instance.installed ? 'Launch' : 'Install');
  const actionLabel = ({ pause: 'Pause', resume: 'Resume', stop: 'Stop' } as Record<string, string>)[command || ''] || label;
  const icon = status === 'working' ? 'folder' : status === 'running' ? 'triangle' : command === 'stop' || status === 'stopping' ? 'square'
    : command === 'launch' || command === 'resume' || status === 'starting' ? 'triangle' : 'arrow-down-tray';
  return {
    iconRotation:icon==='triangle'?90:0,
    actionIconRotation:command==='stop' || command==='pause'?0:icon==='triangle'?90:0,
    busy, pending, transitional, command, label, labelValues:{percent:Math.floor((activity?.progress || 0)*100)}, actionLabel, icon,
    actionIcon: command === 'stop' ? 'square' : command === 'pause' ? 'bars-vertical' : icon,
    showProgress: ['installing', 'pausing', 'paused'].includes(status),
    canCopy: !busy && !pending,
  };
}
