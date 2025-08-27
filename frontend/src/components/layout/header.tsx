import { ThemeToggle } from "@/components/theme-toggle"
import { Activity } from "lucide-react"
import { ClusterSelector } from "@/components/cluster-selector"

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 lg:px-6">
        <div className="flex flex-1">
          <a className="flex items-center space-x-2" href="/">
            <Activity className="h-6 w-6" />
            <span className="font-bold">Kaptivan</span>
          </a>
        </div>
        <div className="flex items-center gap-4">
          <ClusterSelector />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}