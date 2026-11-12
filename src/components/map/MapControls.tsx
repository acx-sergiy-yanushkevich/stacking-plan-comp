import { Icon, type IconName } from '../ui';

export interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCompass: () => void;
  onTilt: () => void;
  tilted: boolean;
  presenting: boolean;
  onPresent: () => void;
  /** Reason Present is unavailable (reduced motion); disables the button. */
  presentDisabledReason?: string | null;
  recording: boolean;
  onRecord: () => void;
}

function Ctl({ icon, label, onClick, pressed, disabled, title, className = '' }: { icon: IconName; label: string; onClick: () => void; pressed?: boolean; disabled?: boolean; title?: string; className?: string }) {
  return (
    <button type="button" className={`sp-map-ctl ${className}`.trim()} aria-label={label} title={title ?? label} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      <Icon name={icon} size={16} />
    </button>
  );
}

/** Bottom-right camera and presentation controls (DESIGN.md §2.6). */
export function MapControls({ onZoomIn, onZoomOut, onCompass, onTilt, tilted, presenting, onPresent, presentDisabledReason, recording, onRecord }: MapControlsProps) {
  return (
    <div className="sp-map-controls" role="group" aria-label="Map controls">
      <div className="sp-map-ctl-group">
        <Ctl icon="plus" label="Zoom in" onClick={onZoomIn} />
        <Ctl icon="minus" label="Zoom out" onClick={onZoomOut} />
      </div>
      <div className="sp-map-ctl-group">
        <Ctl icon="compass" label="Back to the top-down view" onClick={onCompass} />
        <Ctl icon="tilt" label={tilted ? 'Show top-down' : 'Show in 3D'} pressed={tilted} onClick={onTilt} />
      </div>
      <div className="sp-map-ctl-group">
        <Ctl
          icon={presenting ? 'pause' : 'play'}
          label={presenting ? 'Stop presenting' : 'Present: orbit the building in 3D'}
          title={presentDisabledReason ?? undefined}
          pressed={presenting}
          disabled={!!presentDisabledReason}
          onClick={onPresent}
        />
        <Ctl icon="record" label={recording ? 'Stop recording' : 'Record a 20-second video'} pressed={recording} onClick={onRecord} className={recording ? 'is-recording' : ''} />
      </div>
    </div>
  );
}
