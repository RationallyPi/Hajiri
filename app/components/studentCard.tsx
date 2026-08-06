interface StudentCardProps {
    name: string;
    rollNumber: number;
    photo: string;
    attendancePercentage: number;
}

export default function StudentCard({
    name,
    rollNumber,
    photo,
    attendancePercentage,
}: StudentCardProps) {
    const isLowAttendance = attendancePercentage < 80;

    return (
        <div className="flex h-full w-full p-4">
            <div className="flex h-full w-full flex-col rounded-3xl border border-border bg-card p-8 shadow-lg">
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
                <div className="mt-8 flex flex-1 flex-col items-center">
                    <h2 className="text-center text-4xl font-bold text-card-foreground">
                        {name}
                    </h2>

                    <p className="mt-3 text-xl text-muted-foreground">
                        Roll No. {rollNumber}
                    </p>

                    <div className="flex-1" />
                </div>
            </div>
        </div>
    );
}