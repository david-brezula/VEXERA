import { cn } from "@/lib/utils";

export function DashboardMockup() {
  return (
    <div
      className="rounded-2xl overflow-hidden shadow-2xl border border-border/50"
      style={{ transform: "perspective(1200px) rotateY(-3deg) rotateX(2deg)" }}
    >
      {/* Browser chrome */}
      <div className="bg-slate-800 px-4 py-3 flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-amber-400" />
        <div className="w-3 h-3 rounded-full bg-emerald-400" />
        <div className="bg-slate-700 rounded-md px-3 py-1 text-xs text-slate-400 flex-1">
          app.vexera.sk/dashboard
        </div>
      </div>

      {/* Dashboard content */}
      <div className="bg-slate-50 p-4 flex gap-3">
        {/* Left sidebar */}
        <div className="w-14 bg-slate-900 rounded-lg py-4 flex flex-col gap-3 shrink-0">
          <div className="w-8 h-2 bg-slate-700 rounded mx-auto" />
          <div className="w-8 h-2 bg-slate-700 rounded mx-auto" />
          <div className="w-8 h-2 bg-slate-700 rounded mx-auto" />
          <div className="w-8 h-2 bg-slate-700 rounded mx-auto" />
          <div className="w-8 h-2 bg-slate-700 rounded mx-auto" />
        </div>

        {/* Main area */}
        <div className="flex-1 min-w-0">
          {/* Top row: 4 stat cards */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="flex items-center gap-1 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span className="text-[10px] text-slate-400">Faktury</span>
              </div>
              <div className="text-sm font-bold text-slate-800">24</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="flex items-center gap-1 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-[10px] text-slate-400">Nepriradene</span>
              </div>
              <div className="text-sm font-bold text-slate-800">3</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="flex items-center gap-1 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-slate-400">Tento mesiac</span>
              </div>
              <div className="text-sm font-bold text-slate-800">&euro;12,450</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="flex items-center gap-1 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span className="text-[10px] text-slate-400">DPH</span>
              </div>
              <div className="text-sm font-bold text-slate-800">&euro;2,490</div>
            </div>
          </div>

          {/* Middle: Fake bar chart */}
          <div className="bg-white rounded-lg p-3 border border-slate-200 mt-2">
            <div className="text-[10px] text-slate-400 mb-2">Mesacny prehlad</div>
            <div className="flex items-end gap-1.5 h-16">
              <div className="w-full h-8 bg-indigo-500 rounded-t" />
              <div className="w-full h-12 bg-indigo-300 rounded-t" />
              <div className="w-full h-6 bg-indigo-500 rounded-t" />
              <div className="w-full h-16 bg-indigo-300 rounded-t" />
              <div className="w-full h-10 bg-indigo-500 rounded-t" />
              <div className="w-full h-14 bg-indigo-300 rounded-t" />
              <div className="w-full h-11 bg-indigo-500 rounded-t" />
            </div>
          </div>

          {/* Bottom: Fake table */}
          <div className="bg-white rounded-lg p-3 border border-slate-200 mt-2">
            <div className="flex gap-2 py-1.5 border-b border-slate-100">
              <div className="h-2 rounded bg-slate-200 w-16" />
              <div className="h-2 rounded bg-slate-200 w-24" />
              <div className="h-2 rounded bg-slate-200 w-12" />
              <div className="h-2 rounded bg-slate-200 w-20" />
            </div>
            <div className="flex gap-2 py-1.5 border-b border-slate-100">
              <div className="h-2 rounded bg-slate-200 w-16" />
              <div className="h-2 rounded bg-slate-200 w-24" />
              <div className="h-2 rounded bg-slate-200 w-12" />
              <div className="h-2 rounded bg-slate-200 w-20" />
            </div>
            <div className="flex gap-2 py-1.5 border-b border-slate-100">
              <div className="h-2 rounded bg-slate-200 w-16" />
              <div className="h-2 rounded bg-slate-200 w-24" />
              <div className="h-2 rounded bg-slate-200 w-12" />
              <div className="h-2 rounded bg-slate-200 w-20" />
            </div>
            <div className="flex gap-2 py-1.5">
              <div className="h-2 rounded bg-slate-200 w-16" />
              <div className="h-2 rounded bg-slate-200 w-24" />
              <div className="h-2 rounded bg-slate-200 w-12" />
              <div className="h-2 rounded bg-slate-200 w-20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
