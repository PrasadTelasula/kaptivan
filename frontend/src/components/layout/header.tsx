import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Activity, LogOut } from "lucide-react"
import { useAuthStore } from "@/stores/auth.store"
import { useNavigate } from "react-router-dom"
import { ClusterSelector } from "@/components/cluster-selector"

export function Header() {
  const logout = useAuthStore((state) => state.logout)
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate("/login")
  }
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 lg:px-6">
        <div className="flex flex-1">
          <a className="mr-6 flex items-center space-x-2" href="/">
            <Activity className="h-6 w-6" />
            <span className="font-bold">Kaptivan</span>
          </a>
          <nav className="flex items-center gap-4 text-sm lg:gap-6">
            <a
              className="transition-colors hover:text-foreground/80 text-foreground"
              href="/clusters"
            >
              Clusters
            </a>
            <a
              className="transition-colors hover:text-foreground/80 text-foreground/60"
              href="/resources"
            >
              Resources
            </a>
            <a
              className="transition-colors hover:text-foreground/80 text-foreground/60"
              href="/topology"
            >
              Topology
            </a>
            <a
              className="transition-colors hover:text-foreground/80 text-foreground/60"
              href="/exec"
            >
              Exec
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <ClusterSelector />
          <div className="flex items-center gap-2">
            {user && (
              <span className="text-sm text-muted-foreground mr-2">
                {user.email}
              </span>
            )}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}