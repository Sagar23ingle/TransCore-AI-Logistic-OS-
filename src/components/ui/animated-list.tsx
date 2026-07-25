import * as React from "react";
import { motion, useInView } from "motion/react";
import { cn } from "@/lib/utils";

interface AnimatedListProps {
  children: React.ReactNode[];
  className?: string;
  itemClassName?: string;
  showGradients?: boolean;
  displayScrollbar?: boolean;
  enableArrowNavigation?: boolean;
  onItemSelect?: (index: number) => void;
  maxHeight?: string;
}

function AnimatedItem({
  children,
  index,
  selected,
  onSelect,
  className,
}: {
  children: React.ReactNode;
  index: number;
  selected: boolean;
  onSelect: () => void;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2, once: false });
  return (
    <motion.div
      ref={ref}
      data-index={index}
      data-selected={selected}
      onClick={onSelect}
      initial={{ opacity: 0, scale: 0.94, y: 12 }}
      animate={inView ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.94, y: 12 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        "outline-none transition-shadow",
        selected && "ring-2 ring-primary/60 rounded-2xl",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedList({
  children,
  className,
  itemClassName,
  showGradients = true,
  displayScrollbar = true,
  enableArrowNavigation = true,
  onItemSelect,
  maxHeight,
}: AnimatedListProps) {
  const items = React.Children.toArray(children);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [selected, setSelected] = React.useState<number>(-1);
  const [topFade, setTopFade] = React.useState(0);
  const [botFade, setBotFade] = React.useState(1);

  const onScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const top = el.scrollTop;
    const max = el.scrollHeight - el.clientHeight;
    setTopFade(Math.min(1, top / 40));
    setBotFade(max <= 0 ? 0 : Math.min(1, (max - top) / 40));
  }, []);

  React.useEffect(() => {
    if (!enableArrowNavigation) return;
    const handler = (e: KeyboardEvent) => {
      if (!scrollRef.current?.contains(document.activeElement) && document.activeElement !== scrollRef.current) {
        // only when list focused
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(items.length - 1, s + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(0, s - 1));
      } else if (e.key === "Enter" && selected >= 0) {
        onItemSelect?.(selected);
      }
    };
    const node = scrollRef.current;
    node?.addEventListener("keydown", handler as unknown as EventListener);
    return () => node?.removeEventListener("keydown", handler as unknown as EventListener);
  }, [enableArrowNavigation, items.length, onItemSelect, selected]);

  React.useEffect(() => {
    if (selected < 0) return;
    const node = scrollRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`);
    node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  return (
    <div className={cn("relative", className)}>
      <div
        ref={scrollRef}
        tabIndex={0}
        onScroll={onScroll}
        role="listbox"
        className={cn(
          "flex flex-col gap-2.5 overflow-y-auto overflow-x-hidden focus:outline-none",
          displayScrollbar ? "tc-scroll" : "scrollbar-none",
        )}
        style={{ maxHeight: maxHeight ?? "calc(100dvh - 220px)" }}
      >
        {items.map((child, i) => (
          <AnimatedItem
            key={i}
            index={i}
            selected={selected === i}
            onSelect={() => {
              setSelected(i);
              onItemSelect?.(i);
            }}
            className={itemClassName}
          >
            {child}
          </AnimatedItem>
        ))}
      </div>
      {showGradients && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-background to-transparent transition-opacity"
            style={{ opacity: topFade }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background to-transparent transition-opacity"
            style={{ opacity: botFade }}
          />
        </>
      )}
    </div>
  );
}