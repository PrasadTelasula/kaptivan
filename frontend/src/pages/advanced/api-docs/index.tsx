import React, { useState, useEffect } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar-new';
import { useClusterStore } from '@/stores/cluster.store';
import APITreeView from './components/APITreeView';
import APIDocumentationPanel from './components/APIDocumentationPanelV3';
import type { TreeNode } from './types';

export default function APIDocsPage() {
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const { clusters, currentContext, setCurrentContext, fetchClusters } = useClusterStore();
  const [selectedContext, setSelectedContext] = useState<string>(currentContext || 'docker-desktop');

  const handleNodeSelect = (node: TreeNode) => {
    setSelectedNode(node);
  };

  const handleContextChange = (context: string) => {
    setSelectedContext(context);
    setCurrentContext(context);
    setSelectedNode(null); // Reset selected node when context changes
  };

  // Fetch clusters on mount
  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  // Update selected context when currentContext changes
  useEffect(() => {
    if (currentContext) {
      setSelectedContext(currentContext);
    }
  }, [currentContext]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search on '/' key
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search resources"]') as HTMLInputElement;
        searchInput?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-screen bg-background flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar className="hidden lg:block border-r" />
        <main className="flex-1 overflow-hidden">
          <div className="h-full">
            <ResizablePanelGroup direction="horizontal" className="h-full">
              <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
                <div className="h-full border-r overflow-hidden">
                  <APITreeView
                    context={selectedContext}
                    clusters={clusters}
                    onContextChange={handleContextChange}
                    onNodeSelect={handleNodeSelect}
                    selectedNode={selectedNode}
                  />
                </div>
              </ResizablePanel>
              
              <ResizableHandle withHandle />
              
              <ResizablePanel defaultSize={70} minSize={60}>
                <div className="h-full overflow-hidden">
                  <APIDocumentationPanel
                    context={selectedContext}
                    selectedNode={selectedNode}
                  />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </main>
      </div>
    </div>
  );
}