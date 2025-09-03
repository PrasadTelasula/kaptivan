import { useState } from 'react'
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar-new'
import { useClusterStore } from '@/stores/cluster.store'
import { ManifestViewer } from './manifest-viewer/index'
import { cn } from '@/utils/cn'

export function ManifestViewerPage() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const { selectedContexts, clusters } = useClusterStore()
  const selectedClusters = clusters.filter(c => selectedContexts.includes(c.context) && c.connected)
  
  console.log('ManifestViewerPage - clusters:', clusters)
  console.log('ManifestViewerPage - selectedContexts:', selectedContexts)
  console.log('ManifestViewerPage - selectedClusters:', selectedClusters)

  return (
    <div className="h-screen bg-background flex flex-col">
      {!isFullscreen && <Header />}
      <div className={cn("flex flex-1 overflow-hidden", isFullscreen && "h-screen")}>
        {!isFullscreen && <Sidebar className="border-r" />}
        <main className="flex-1 overflow-hidden">
          <ManifestViewer 
            selectedClusters={selectedClusters || []} 
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
          />
        </main>
      </div>
    </div>
  )
}