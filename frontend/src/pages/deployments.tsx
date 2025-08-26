import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar-new'
import Deployments from '@/routes/deployments'

export function DeploymentsPage() {
  return (
    <div className="h-screen bg-background flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar className="hidden lg:block border-r shrink-0" />
        <main className="flex-1 flex flex-col p-4 overflow-auto">
          <Deployments />
        </main>
      </div>
    </div>
  )
}