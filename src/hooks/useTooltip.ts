import { useState, useRef, useEffect, useCallback } from 'react';

interface TooltipPosition {
  x: number;
  y: number;
  placement: 'top' | 'bottom';
}

interface UseTooltipOptions {
  delay?: number;
  placement?: 'top' | 'bottom' | 'auto';
  offset?: number;
  disabled?: boolean;
}

export function useTooltip(options: UseTooltipOptions = {}) {
  const {
    delay = 500,
    placement: preferredPlacement = 'auto',
    offset = 8,
    disabled = false
  } = options;

  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | undefined>(undefined);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    const spaceAbove = triggerRect.top;
    const spaceBelow = window.innerHeight - triggerRect.bottom;

    let finalPlacement: 'top' | 'bottom' = 'top';

    if (preferredPlacement === 'auto') {
      finalPlacement = spaceAbove > spaceBelow ? 'top' : 'bottom';
    } else if (preferredPlacement === 'top') {
      finalPlacement = spaceAbove >= tooltipRect.height + offset ? 'top' : 'bottom';
    } else {
      finalPlacement = spaceBelow >= tooltipRect.height + offset ? 'bottom' : 'top';
    }

    const centerX = triggerRect.left + triggerRect.width / 2;
    const tooltipX = Math.max(
      8,
      Math.min(centerX - tooltipRect.width / 2, window.innerWidth - tooltipRect.width - 8)
    );

    const tooltipY = finalPlacement === 'top'
      ? triggerRect.top - tooltipRect.height - offset
      : triggerRect.bottom + offset;

    setPosition({ x: tooltipX, y: tooltipY, placement: finalPlacement });
  }, [preferredPlacement, offset]);

  const show = useCallback(() => {
    if (disabled) return;

    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay, disabled]);

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  }, []);

  useEffect(() => {
    if (isVisible) {
      // Use requestAnimationFrame to ensure the tooltip is rendered before calculating position
      const frame = requestAnimationFrame(() => {
        calculatePosition();
      });
      return () => cancelAnimationFrame(frame);
    } else {
      setPosition(null);
    }
  }, [isVisible, calculatePosition]);

  // Recalculate when tooltip ref is set
  useEffect(() => {
    if (isVisible && tooltipRef.current && triggerRef.current) {
      calculatePosition();
    }
  }, [isVisible, calculatePosition]);

  useEffect(() => {
    if (!isVisible) return;

    const handleResize = () => {
      calculatePosition();
    };

    const handleScroll = () => {
      calculatePosition();
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [isVisible, calculatePosition]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isVisible,
    position,
    triggerRef,
    tooltipRef,
    show,
    hide,
    calculatePosition
  };
}
