"use client";

import { useCallback, useEffect, useRef } from "react";

export type AttendanceStatus = "unmarked" | "present" | "absent";

export interface RollNumberPickerStudent {
    rollNumber: number;
    status: AttendanceStatus;
}

interface RollNumberPickerProps {
    students: RollNumberPickerStudent[];
    activeIndex: number;
    onSelect: (index: number) => void;
}

const ITEM_W = 56; // px

export default function RollNumberPicker({
    students,
    activeIndex,
    onSelect,
}: RollNumberPickerProps) {
    const scrollerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const rafRef = useRef<number | null>(null);
    const suppressScrollSync = useRef(false);

    // scale/fade items by distance from center, iOS-picker style,
    // and figure out which roll number is currently centered
    const syncActiveFromScroll = useCallback(() => {
        const scroller = scrollerRef.current;
        if (!scroller || suppressScrollSync.current) return;
        const scrollerRect = scroller.getBoundingClientRect();
        const centerX = scrollerRect.left + scrollerRect.width / 2;

        let closestIdx = 0;
        let closestDist = Infinity;

        itemRefs.current.forEach((el, idx) => {
            if (!el) return;
            const r = el.getBoundingClientRect();
            const itemCenter = r.left + r.width / 2;
            const dist = Math.abs(itemCenter - centerX);

            const norm = Math.min(dist / (ITEM_W * 2.5), 1);
            el.style.transform = `scale(${(1.15 - norm * 0.45).toFixed(3)})`;
            el.style.opacity = (1 - norm * 0.75).toFixed(2);

            if (dist < closestDist) {
                closestDist = dist;
                closestIdx = idx;
            }
        });

        if (closestIdx !== activeIndex) onSelect(closestIdx);
    }, [activeIndex, onSelect]);

    const onWheelScroll = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(syncActiveFromScroll);
    };

    const scrollToIndex = useCallback(
        (idx: number, smooth = true) => {
            const el = itemRefs.current[idx];
            if (!el) return;
            suppressScrollSync.current = true;
            el.scrollIntoView({
                behavior: smooth ? "smooth" : "auto",
                inline: "center",
                block: "nearest",
            });
            window.setTimeout(
                () => {
                    suppressScrollSync.current = false;
                    syncActiveFromScroll();
                },
                smooth ? 350 : 50,
            );
        },
        [syncActiveFromScroll],
    );

    // keep the wheel synced when activeIndex changes from elsewhere
    // (e.g. auto-advance after a swipe-to-mark on the card)
    useEffect(() => {
        scrollToIndex(activeIndex);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeIndex]);

    useEffect(() => {
        scrollToIndex(0, false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="relative h-20">
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-muted" />
            <div
                ref={scrollerRef}
                onScroll={onWheelScroll}
                className="hide-scrollbar flex h-full items-center overflow-x-auto"
                style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
            >
                <div className="shrink-0" style={{ flexBasis: `calc(50% - ${ITEM_W / 2}px)` }} />
                {students.map((s, idx) => (
                    <button
                        key={s.rollNumber}
                        ref={(el) => {
                            itemRefs.current[idx] = el;
                        }}
                        type="button"
                        onClick={() => onSelect(idx)}
                        className={`flex h-16 shrink-0 origin-center flex-col items-center justify-center gap-1.5 ${idx === activeIndex ? "text-primary" : "text-muted-foreground"
                            }`}
                        style={{ flexBasis: ITEM_W, width: ITEM_W, scrollSnapAlign: "center" }}
                    >
                        <span className="text-lg font-semibold tabular-nums">{s.rollNumber}</span>
                        <span
                            className={`h-1.5 w-1.5 rounded-full ${s.status === "present"
                                    ? "bg-emerald-500"
                                    : s.status === "absent"
                                        ? "bg-destructive"
                                        : "bg-border"
                                }`}
                        />
                    </button>
                ))}
                <div className="shrink-0" style={{ flexBasis: `calc(50% - ${ITEM_W / 2}px)` }} />
            </div>

            <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          scrollbar-width: none;
        }
      `}</style>
        </div>
    );
}