import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 relative">
          {/* Decorative gradient orbs for glassmorphism depth */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
            <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute top-1/3 -left-20 h-60 w-60 rounded-full bg-violet-500/8 blur-3xl" />
            <div className="absolute bottom-20 right-1/4 h-48 w-48 rounded-full bg-emerald-500/8 blur-3xl" />
          </div>
          <div className="relative z-10">{children}</div>
        </main>
      </div>
    </div>
  )
}
