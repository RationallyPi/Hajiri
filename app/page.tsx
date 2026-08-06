
import Link from "next/link";
export default function Home() {
  const classes = [
    "BSc Agriculture",
    "BSc CS",
    "BCA",
    "BBS",
    "BSc Forestry",
  ];

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex w-full max-w-md flex-col items-center">
        <h1 className="mb-2 text-4xl font-bold text-foreground">
          Hajiri
        </h1>

        <p className="mb-10 text-muted-foreground">
          Select a class to begin attendance
        </p>

        <div className="flex w-full flex-col gap-4">
          {classes.map((cls) => (
            <Link href={`/session`}>
              <button
                className="
          w-full
          rounded-lg
          border
          border-border
          bg-card
          px-6
          py-4
          text-left
          text-lg
          font-medium
          text-card-foreground
          shadow-sm
          transition-all
          duration-200
          hover:bg-accent
          hover:text-accent-foreground
          hover:shadow-md
          active:scale-[0.98]
        "
              >
                {cls}
              </button>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}