import { cloneElement, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';

export interface TooltipProps {
  content: ReactNode;
  children: ReactElement<Record<string, unknown>>;
  placement?: 'top' | 'bottom';
  delay?: number;
}

/** Shows on hover and keyboard focus; wired with aria-describedby so screen readers get it too. */
export function Tooltip({ content, children, placement = 'top', delay = 300 }: TooltipProps) {
  const id = useId();
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const open = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(true), delay);
  };
  const close = () => {
    clearTimeout(timer.current);
    setShow(false);
  };
  const child = cloneElement(children, {
    'aria-describedby': show ? id : children.props['aria-describedby'],
    onMouseEnter: (e: unknown) => {
      (children.props.onMouseEnter as ((e: unknown) => void) | undefined)?.(e);
      open();
    },
    onMouseLeave: (e: unknown) => {
      (children.props.onMouseLeave as ((e: unknown) => void) | undefined)?.(e);
      close();
    },
    onFocus: (e: unknown) => {
      (children.props.onFocus as ((e: unknown) => void) | undefined)?.(e);
      open();
    },
    onBlur: (e: unknown) => {
      (children.props.onBlur as ((e: unknown) => void) | undefined)?.(e);
      close();
    },
  });
  return (
    <span className="sp-tip-wrap" onKeyDown={(e) => e.key === 'Escape' && close()}>
      {child}
      {show && (
        <span role="tooltip" id={id} className={`sp-tip ${placement === 'bottom' ? 'sp-tip--bottom' : ''}`}>
          {content}
        </span>
      )}
    </span>
  );
}
