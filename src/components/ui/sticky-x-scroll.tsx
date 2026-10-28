import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * A wide table with its sideways scrollbar kept at the bottom of the screen while the
 * table is in view, instead of only at the table's very end (which, on a long estimate,
 * meant scrolling all the way down to reach the right-hand columns).
 */
export function StickyXScroll({ children, className = '' }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [needed, setNeeded] = useState(false);
  const syncing = useRef(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => { setWidth(el.scrollWidth); setNeeded(el.scrollWidth > el.clientWidth + 1); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);

  const follow = (from: HTMLDivElement | null, to: HTMLDivElement | null) => {
    if (!from || !to || syncing.current) return;
    syncing.current = true;
    to.scrollLeft = from.scrollLeft;
    requestAnimationFrame(() => { syncing.current = false; });
  };

  return (
    <div className={className}>
      <div
        ref={box}
        onScroll={() => follow(box.current, bar.current)}
        className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {needed && (
        <div
          ref={bar}
          onScroll={() => follow(bar.current, box.current)}
          aria-hidden
          className="sticky bottom-0 z-20 h-3.5 overflow-x-auto border-t border-border bg-card/95 backdrop-blur"
        >
          <div style={{ width, height: 1 }} />
        </div>
      )}
    </div>
  );
}
