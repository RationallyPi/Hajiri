"use client";

import { useRef, useState, type PointerEvent } from "react";
import type { AttendanceStatus } from "../lib/db";

export type { AttendanceStatus };

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

// Colors the number, the dot, and the shading behind each item according to
// that student's attendance status — so scanning the strip alone tells you
// who's marked and how, not just the currently-active one.
const STATUS_COLORS: Record<AttendanceStatus, { text: string; dot: string; bg: string; border: string }> = {
    present: { text: "text-emerald-600", dot: "bg-emerald-500", bg: "bg-emerald-500/15", border: "border-emerald-500/15" },
    absent: { text: "text-destructive", dot: "bg-destructive", bg: "bg-destructive/15", border: "border-destructive/15" },
    unmarked: { text: "text-muted-foreground", dot: "bg-border", bg: "bg-muted", border: "border-muted" },
};

// A transform-driven carousel instead of native scroll + scroll-snap +
// scrollIntoView. The active item's position is derived purely from
// `activeIndex` (idx * ITEM_W), so it is *always* exactly centered — no
// dependency on the browser's scroll/snap behavior, which is what caused
// the old version to jump instead of slide, and occasionally drift out of
// sync with `activeIndex`. Same "pure function of props" principle the
// original scale/opacity math already used, just extended to position.
export default function RollNumberPicker({ students, activeIndex, onSelect }: RollNumberPickerProps) {
    const dragState = useRef({ dragging: false, startX: 0, dx: 0 });
    const [dragDx, setDragDx] = useState(0);
    const [dragging, setDragging] = useState(false);

    const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
        dragState.current = { dragging: true, startX: e.clientX, dx: 0 };
        setDragging(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
        if (!dragState.current.dragging) return;
        const dx = e.clientX - dragState.current.startX;
        dragState.current.dx = dx;
        setDragDx(dx);
    };

    // Drag right (+dx) reveals earlier items -> decreases index.
    // Drag left (-dx) reveals later items -> increases index.
    const endDrag = () => {
        if (!dragState.current.dragging) return;
        const dx = dragState.current.dx;
        dragState.current.dragging = false;
        setDragging(false);
        setDragDx(0);

        const stepsMoved = Math.round(-dx / ITEM_W);
        if (stepsMoved !== 0) {
            const next = Math.max(0, Math.min(students.length - 1, activeIndex + stepsMoved));
            if (next !== activeIndex) onSelect(next);
        }
    };

    // Shift the row left by half an item (so item 0 centers by default),
    // then by activeIndex whole items, then by the live drag offset.
    const baseOffset = -(ITEM_W / 2) - activeIndex * ITEM_W;
    const translateX = baseOffset + dragDx;

    return (
        <div className="relative h-20 touch-pan-y select-none overflow-hidden">
            <div
                className="absolute left-1/2 top-1/2 flex items-center"
                style={{
                    transform: `translate(${translateX}px, -50%)`,
                    transition: dragging ? "none" : "transform 0.28s cubic-bezier(.22,1,.36,1)",
                    cursor: dragging ? "grabbing" : "grab",
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
            >
                {students.map((s, idx) => {
                    // Pure function of props — always correct, no DOM measurement involved.
                    const distance = Math.abs(idx - activeIndex);
                    const norm = Math.min(distance / 2.5, 1);
                    // Active item stays at its natural size; neighbors shrink and
                    // ease downward as distance grows, reading as "pushed back".
                    const scale = 1.15 - norm * 0.75;
                    const opacity = 1 - norm * 0.75;
                    const pushBack = norm * 8; // px, vertical recede
                    const colors = STATUS_COLORS[s.status];
                    const isActive = idx === activeIndex;

                    return (
                        <button
                            key={s.rollNumber}
                            type="button"
                            onClick={() => {
                                // Ignore the click a drag-release generates on the same pointer.
                                if (dragging) return;
                                onSelect(idx);
                            }}
                            style={{
                                flexBasis: ITEM_W,
                                width: ITEM_W,
                                transform: `translateY(${pushBack.toFixed(2)}px) scale(${scale.toFixed(3)})`,
                                opacity: opacity.toFixed(2),
                            }}
                            className={`flex h-16 shrink-0 origin-center flex-col items-center justify-center gap-1.5 rounded-2xl border-2 transition-transform ${colors.bg
                                } ${isActive ? "border-primary" : colors.border}`}
                        >
                            <span className={`text-lg font-semibold tabular-nums ${colors.text}`}>{s.rollNumber}</span>
                            <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}