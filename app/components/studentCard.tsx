import type { MouseEvent, PointerEvent } from "react";

interface StudentCardProps {
    name: string;
    rollNumber: number;
    photo: string;
    attendancePercentage: number;
    onMarkPresent?: () => void;
    onMarkAbsent?: () => void;
}

export default function StudentCard({
    name,
    rollNumber,
    photo,
    attendancePercentage,
    onMarkPresent,
    onMarkAbsent,
}: StudentCardProps) {
    const isLowAttendance = attendancePercentage < 80;

    // Buttons sit inside a card that SwipeableCard wraps in a pointer-drag
    // handler — stop propagation so a tap never gets mistaken for the start
    // of a swipe gesture.
    const stopPointer = (e: PointerEvent<HTMLButtonElement>) => e.stopPropagation();

    const handleAbsent = (e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        onMarkAbsent?.();
    };

    const handlePresent = (e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        onMarkPresent?.();
    };

    return (
        <div className="flex h-full w-full p-4">
            {/* h-full + overflow-hidden pin the card to exactly the space the parent
                gives it — nothing inside (long names included) can push it taller,
                so there's never a reason to scroll. */}
            <div className="flex h-full w-full min-h-0 flex-col overflow-hidden rounded-3xl border border-border bg-card px-8 pb-6 pt-6 shadow-lg">
                {/* Attendance Percentage — small, above the photo */}
                <div className="flex shrink-0 justify-center">
                    <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${isLowAttendance
                            ? "bg-destructive/15 text-destructive"
                            : "bg-primary/15 text-primary"
                            }`}
                    >
                        Attendance: {attendancePercentage.toFixed(0)}%
                    </span>
                </div>

                {/* Photo — takes whatever space is left; object-cover crops instead
                    of forcing the card to grow to the image's natural size. */}
                <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-2xl border border-border shadow-md">
                    <img src={photo} alt={name} className="h-full w-full object-cover" />
                </div>

                {/* Student Details — fixed height; the name truncates instead of
                    wrapping, so it can never expand the card. */}
                <div className="mt-4 flex shrink-0 flex-col items-center">
                    <h2 className="w-full truncate text-center text-2xl font-bold text-card-foreground" title={name}>
                        {name}
                    </h2>

                    <p className="mt-1 text-base text-muted-foreground">Roll No. {rollNumber}</p>

                    {/* Present / Absent buttons, kept well apart to avoid mis-clicks */}
                    <div className="mt-4 flex w-full items-center justify-between gap-10">
                        <button
                            type="button"
                            onClick={handleAbsent}
                            onPointerDown={stopPointer}
                            className="flex-1 rounded-2xl border border-destructive/30 bg-destructive/10 py-4 text-base font-semibold text-destructive transition-transform active:scale-95"
                        >
                            ✕ Absent
                        </button>
                        <button
                            type="button"
                            onClick={handlePresent}
                            onPointerDown={stopPointer}
                            className="flex-1 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 py-4 text-base font-semibold text-emerald-600 transition-transform active:scale-95"
                        >
                            ✓ Present
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}