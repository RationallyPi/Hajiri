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
            <div className="flex h-full w-full flex-col rounded-3xl border border-border bg-card px-8 pb-6 pt-8 shadow-lg">
                {/* Photo */}
                <div className="flex justify-center">
                    <img
                        src={photo}
                        alt={name}
                        className="aspect-square w-4/5 max-w-xs rounded-2xl border border-border object-cover shadow-md"
                    />
                </div>

                {/* Attendance Percentage */}
                <div className="mt-8 flex justify-center">
                    <span
                        className={`rounded-full px-5 py-2 text-lg font-semibold ${isLowAttendance
                                ? "bg-destructive/15 text-destructive"
                                : "bg-primary/15 text-primary"
                            }`}
                    >
                        Attendance: {attendancePercentage.toFixed(0)}%
                    </span>
                </div>

                {/* Student Details */}
                <div className="mt-8 flex flex-col items-center">
                    <h2 className="text-center text-4xl font-bold text-card-foreground">{name}</h2>

                    <p className="mt-3 text-xl text-muted-foreground">Roll No. {rollNumber}</p>

                    {/* Present / Absent buttons — 20px below roll number, kept well apart to avoid mis-clicks */}
                    <div className="mt-5 flex w-full items-center justify-between gap-10">
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