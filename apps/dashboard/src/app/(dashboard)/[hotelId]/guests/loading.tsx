export default function GuestsLoading() {
  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="grid gap-2">
          <div className="h-6 w-28 animate-pulse rounded-md bg-slate-200" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-slate-200" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-md bg-slate-200" />
      </div>

      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="h-10 animate-pulse rounded-md bg-slate-100" />
          <div className="h-10 animate-pulse rounded-md bg-slate-100" />
        </div>
      </section>

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="grid grid-cols-[2fr_2fr_1.5fr_1fr] gap-4" key={index}>
              <div className="h-10 animate-pulse rounded-md bg-slate-100" />
              <div className="h-10 animate-pulse rounded-md bg-slate-100" />
              <div className="h-10 animate-pulse rounded-md bg-slate-100" />
              <div className="h-10 animate-pulse rounded-md bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
