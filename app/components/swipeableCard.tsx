"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";

interface SwipeableCardProps {
    children: ReactNode;
    onSwipeRight: () => void; // present
    onSwipeLeft: () => void; // absent
    threshold?: number;
}

export default function SwipeableCard({
    children,
    onSwipeRight,
    onSwipeLeft,
    threshold = 90,
}: SwipeableCardProps) {
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

    const endDrag = () => {
        if (!dragState.current.dragging) return;
        const dx = dragState.current.dx;
        dragState.current.dragging = false;
        setDragging(false);

        if (dx > threshold) {
            setDragDx(600);
            setTimeout(() => {
                setDragDx(0);
                onSwipeRight();
            }, 160);
        } else if (dx < -threshold) {
            setDragDx(-600);
            setTimeout(() => {
                setDragDx(0);
                onSwipeLeft();
            }, 160);
        } else {
            setDragDx(0);
        }
    };

    const rotation = Math.max(-10, Math.min(10, dragDx / 12));
    const stampOpacity = Math.min(Math.abs(dragDx) / 100, 1);

    return (
        <div
            className="relative h-full w-full touch-pan-y select-none"
            style={{
                transform: `translateX(${dragDx}px) rotate(${rotation}deg)`,
                transition: dragging ? "none" : "transform 0.28s cubic-bezier(.22,1,.36,1)",
                cursor: dragging ? "grabbing" : "grab",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
        >
            <div
                className="pointer-events-none absolute left-8 top-8 z-10 rounded-lg border-2 border-emerald-500 px-3 py-1 text-sm font-extrabold tracking-wider text-emerald-500"
                style={{ opacity: dragDx > 0 ? stampOpacity : 0, transform: "rotate(-8deg)" }}
            >
                PRESENT
            </div>
            <div
                className="pointer-events-none absolute right-8 top-8 z-10 rounded-lg border-2 border-destructive px-3 py-1 text-sm font-extrabold tracking-wider text-destructive"
                style={{ opacity: dragDx < 0 ? stampOpacity : 0, transform: "rotate(8deg)" }}
            >
                ABSENT
            </div>

            {children}
        </div>
    );
}