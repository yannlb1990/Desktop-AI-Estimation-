import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * A wide table with its sideways scrollbar kept at the bottom of the screen while the
 * table is in view, instead of only at the table's very end (which, on a long estimate,
 * meant scrolling all the way down to reach the right-hand columns).
 * The table component scrolls inside its own wrapper, so that wrapper is what is driven.
 */
export function StickyXScroll({ children, className = '' }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [needed, setNeeded] = useState(false);
  const syncing = useRef(false);

  /** the element that actually scrolls: the table's own wrapper when there is one */
  const scroller = (): HTMLElement | null => {
    const el = box.current;
    if (!el) return null;
    const inner = el.querySelector('table')?.parentElement;
    return inner && inner !== el && el.contains(inner) ? inner : el;
  };

  useEffect(() => {
    const el = scroller();
    if (!el) return;
    el.classList.add('[scrollbar-width:none]', '[&::-webkit-scrollbar]:hidden');
    const measure = () => { setWidth(el.scrollWidth); setNeeded(el.scrollWidth > el.clientWidth + 1); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const table = el.querySelector('table');
    if (table) ro.observe(table);
    const onScroll = () => follow(el, bar.current);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener('scroll', onScroll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const follow = (from: HTMLElement | null, to: HTMLElement | null) => {
    if (!from || !to || syncing.current) return;
    syncing.current = true;
    to.scrollLeft = from.scrollLeft;
    requestAnimationFrame(() => { syncing.current = false; });
  };

  return (
    <div className={className}>
      <div ref={box} className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden overflow-x-auto">
        {children}
      </div>
      {needed && (
        <div
          ref={bar}
          onScroll={() => follow(bar.current, scroller())}
          aria-hidden
          className="sticky bottom-0 z-20 h-3.5 overflow-x-auto border-t border-border bg-card/95 backdrop-blur"
        >
          <div style={{ width, height: 1 }} />
        </div>
      )}
    </div>
  );
}
