import { ReactElement, cloneElement, useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useTooltip } from '../hooks/useTooltip';

interface TooltipProps {
  content: string | (() => string);
  children: ReactElement;
  delay?: number;
  placement?: 'top' | 'bottom' | 'auto';
  disabled?: boolean;
  offset?: number;
}

export function Tooltip({
  content,
  children,
  delay = 500,
  placement = 'auto',
  disabled = false,
  offset = 8
}: TooltipProps) {
  const { isVisible, position, triggerRef, tooltipRef, show, hide, calculatePosition } = useTooltip({
    delay,
    placement,
    offset,
    disabled
  });

  const tooltipId = useMemo(() => `tooltip-${Math.random().toString(36).substr(2, 9)}`, []);

  const tooltipContent = typeof content === 'function' ? content() : content;

  const handleRef = (node: HTMLElement | null) => {
    (triggerRef as any).current = node;
  };

  const handleTooltipRef = (node: HTMLDivElement | null) => {
    (tooltipRef as any).current = node;
    if (node && isVisible) {
      // Recalculate position when tooltip is mounted
      requestAnimationFrame(() => {
        calculatePosition();
      });
    }
  };

  const childProps = children.props as any;
  const trigger = cloneElement(children, {
    ref: handleRef,
    onMouseEnter: (e: React.MouseEvent) => {
      if (childProps?.onMouseEnter) childProps.onMouseEnter(e);
      show();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      if (childProps?.onMouseLeave) childProps.onMouseLeave(e);
      hide();
    },
    onFocus: (e: React.FocusEvent) => {
      if (childProps?.onFocus) childProps.onFocus(e);
      show();
    },
    onBlur: (e: React.FocusEvent) => {
      if (childProps?.onBlur) childProps.onBlur(e);
      hide();
    },
    'aria-describedby': isVisible ? tooltipId : undefined
  } as any);

  const tooltipVariants: Variants = {
    hidden: {
      opacity: 0,
      scale: 0.95,
      y: position?.placement === 'top' ? 4 : -4
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 700,
        damping: 40,
        mass: 0.8
      }
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: { duration: 0.15 }
    }
  };

  return (
    <>
      {trigger}
      {createPortal(
        <AnimatePresence>
          {isVisible && (
            <motion.div
              ref={handleTooltipRef}
              id={tooltipId}
              role="tooltip"
              aria-live="polite"
              variants={tooltipVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{
                position: 'fixed',
                left: position ? `${position.x}px` : '0px',
                top: position ? `${position.y}px` : '0px',
                visibility: position ? 'visible' : 'hidden'
              }}
              className="z-[9999] px-2.5 py-1.5 bg-[#1c1c1e] border border-white/20 rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.4)] text-[10px] font-medium text-gray-200 pointer-events-none max-w-[200px] text-center whitespace-nowrap"
            >
              {tooltipContent}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
