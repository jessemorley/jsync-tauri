import { ReactNode, useEffect, useRef } from 'react';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import type { OverlayScrollbarsComponentRef } from 'overlayscrollbars-react';
import 'overlayscrollbars/overlayscrollbars.css';

interface ScrollContainerProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  defer?: boolean; // For handling animation states
  enableScroll?: boolean; // Explicitly control scrollbar visibility
}

export function ScrollContainer({
  children,
  className,
  style,
  defer = false,
  enableScroll = true
}: ScrollContainerProps) {
  const osRef = useRef<OverlayScrollbarsComponentRef>(null);

  // Update scrollbars when defer changes (useful for animations)
  useEffect(() => {
    if (!defer && osRef.current) {
      osRef.current.osInstance()?.update();
    }
  }, [defer]);

  return (
    <OverlayScrollbarsComponent
      ref={osRef}
      element="div"
      options={{
        scrollbars: {
          theme: 'os-theme-dark',
          visibility: 'auto',
          autoHide: 'move',
          autoHideDelay: 800,
          dragScroll: true,
          clickScroll: true,
        },
        overflow: {
          x: 'hidden',
          y: defer ? 'hidden' : (enableScroll ? 'scroll' : 'hidden')
        },
        paddingAbsolute: true,
      }}
      className={className}
      style={style}
      defer={defer}
    >
      {children}
    </OverlayScrollbarsComponent>
  );
}
