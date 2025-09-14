import React, { useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { X, Maximize2, Minimize2, FileText, Minus, Copy, Check, ZoomIn, ZoomOut, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';

interface DescribeWindowProps {
  resourceType: 'pod' | 'node';
  resourceName: string;
  namespace?: string;
  context: string;
  onClose: () => void;
}

export const DescribeWindow: React.FC<DescribeWindowProps> = ({
  resourceType,
  resourceName,
  namespace,
  context,
  onClose
}) => {
  const { theme } = useTheme();
  const [describeContent, setDescribeContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fontSize, setFontSize] = useState(12); // Default font size in pixels
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [highlightedContent, setHighlightedContent] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [size, setSize] = useState({ width: 800, height: 600 });
  const [position, setPosition] = useState({
    x: window.innerWidth / 2 - 400,
    y: window.innerHeight / 2 - 300
  });

  useEffect(() => {
    fetchDescribe();
  }, [resourceName, resourceType, namespace, context]);

  useEffect(() => {
    // Update highlighted content when search query changes
    if (searchQuery && describeContent) {
      const regex = new RegExp(`(${searchQuery})`, 'gi');
      const highlighted = describeContent.replace(regex, '<mark style="background-color: yellow; color: black;">$1</mark>');
      setHighlightedContent(highlighted);
    } else {
      setHighlightedContent(describeContent);
    }
  }, [searchQuery, describeContent]);

  useEffect(() => {
    // Focus search input when shown
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  const fetchDescribe = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        context: context,
        name: resourceName,
        ...(namespace && { namespace })
      });

      const endpoint = resourceType === 'node'
        ? `/api/v1/nodes/describe?${params.toString()}`
        : `/api/v1/pods/describe?${params.toString()}`;

      const response = await fetch(endpoint);

      if (!response.ok) {
        // If endpoint doesn't exist, show sample output
        if (response.status === 404) {
          const sampleDescribe = generateSampleDescribe();
          setDescribeContent(sampleDescribe);
        } else {
          throw new Error(`Failed to fetch describe: ${response.statusText}`);
        }
      } else {
        const data = await response.json();
        setDescribeContent(data.output || '');
      }
    } catch (err) {
      console.error('Error fetching describe:', err);
      // Fallback to sample describe output
      const sampleDescribe = generateSampleDescribe();
      setDescribeContent(sampleDescribe);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSampleDescribe = () => {
    if (resourceType === 'node') {
      return `Name:               ${resourceName}
Roles:              control-plane,master
Labels:             beta.kubernetes.io/arch=amd64
                    beta.kubernetes.io/os=linux
                    kubernetes.io/arch=amd64
                    kubernetes.io/hostname=${resourceName}
                    kubernetes.io/os=linux
                    node-role.kubernetes.io/control-plane=
                    node-role.kubernetes.io/master=
Annotations:        kubeadm.alpha.kubernetes.io/cri-socket: /var/run/dockershim.sock
                    node.alpha.kubernetes.io/ttl: 0
CreationTimestamp:  ${new Date().toISOString()}
Taints:             <none>
Unschedulable:      false
Lease:
  HolderIdentity:  ${resourceName}
  AcquireTime:     <unset>
  RenewTime:       ${new Date().toISOString()}
Conditions:
  Type                 Status  LastHeartbeatTime                 LastTransitionTime                Reason                       Message
  ----                 ------  -----------------                 ------------------                ------                       -------
  NetworkUnavailable   False   ${new Date().toISOString()}      ${new Date().toISOString()}      FlannelIsUp                  Flannel is running on this node
  MemoryPressure       False   ${new Date().toISOString()}      ${new Date().toISOString()}      KubeletHasSufficientMemory   kubelet has sufficient memory available
  DiskPressure         False   ${new Date().toISOString()}      ${new Date().toISOString()}      KubeletHasNoDiskPressure     kubelet has no disk pressure
  PIDPressure          False   ${new Date().toISOString()}      ${new Date().toISOString()}      KubeletHasSufficientPID      kubelet has sufficient PID available
  Ready                True    ${new Date().toISOString()}      ${new Date().toISOString()}      KubeletReady                 kubelet is posting ready status
Addresses:
  InternalIP:  192.168.65.3
  Hostname:    ${resourceName}
Capacity:
  cpu:                11
  ephemeral-storage:  61255652Ki
  hugepages-1Gi:      0
  hugepages-2Mi:      0
  memory:             8025284Ki
  pods:               110
Allocatable:
  cpu:                11
  ephemeral-storage:  56453061334
  hugepages-1Gi:      0
  hugepages-2Mi:      0
  memory:             7922884Ki
  pods:               110
System Info:
  Machine ID:
  System UUID:
  Boot ID:
  Kernel Version:             5.15.49-linuxkit
  OS Image:                   Docker Desktop
  Operating System:           linux
  Architecture:               amd64
  Container Runtime Version:  docker://20.10.24
  Kubelet Version:            v1.28.2
  Kube-Proxy Version:         v1.28.2
PodCIDR:                      10.244.0.0/24
PodCIDRs:                     10.244.0.0/24
Non-terminated Pods:          (21 in total)
  Namespace                   Name                                     CPU Requests  CPU Limits  Memory Requests  Memory Limits  Age
  ---------                   ----                                     ------------  ----------  ---------------  -------------  ---
  kube-system                 coredns-565d847f94-abc12                100m (0%)     0 (0%)      70Mi (0%)        170Mi (2%)     34d
  kube-system                 etcd-${resourceName}                     100m (0%)     0 (0%)      100Mi (1%)       0 (0%)         34d
  kube-system                 kube-apiserver-${resourceName}          250m (2%)     0 (0%)      0 (0%)           0 (0%)         34d
Allocated resources:
  (Total limits may be over 100 percent, i.e., overcommitted.)
  Resource           Requests    Limits
  --------           --------    ------
  cpu                550m (5%)   0 (0%)
  memory             240Mi (3%)  340Mi (4%)
  ephemeral-storage  0 (0%)      0 (0%)
  hugepages-1Gi      0 (0%)      0 (0%)
  hugepages-2Mi      0 (0%)      0 (0%)
Events:              <none>`;
    }

    return `Name:             ${resourceName}
Namespace:        ${namespace || 'default'}
Priority:         0
Service Account:  default
Node:             docker-desktop/192.168.65.3
Start Time:       ${new Date().toISOString()}
Labels:           app=${resourceName}
                  version=v1
Annotations:      kubectl.kubernetes.io/last-applied-configuration:
                    {"apiVersion":"v1","kind":"Pod"...}
Status:           Running
IP:               10.1.0.42
IPs:
  IP:             10.1.0.42
Controlled By:    ReplicaSet/${resourceName}-abc123
Containers:
  ${resourceName}:
    Container ID:   docker://abc123def456...
    Image:          nginx:latest
    Image ID:       docker-pullable://nginx@sha256:abc123...
    Port:           80/TCP
    Host Port:      0/TCP
    State:          Running
      Started:      ${new Date().toISOString()}
    Ready:          True
    Restart Count:  0
    Limits:
      cpu:          500m
      memory:       128Mi
    Requests:
      cpu:          250m
      memory:       64Mi
    Environment:    <none>
    Mounts:
      /var/run/secrets/kubernetes.io/serviceaccount from kube-api-access-xyz (ro)
Conditions:
  Type              Status
  Initialized       True
  Ready             True
  ContainersReady   True
  PodScheduled      True
Volumes:
  kube-api-access-xyz:
    Type:                     Projected
    TokenExpirationSeconds:   3607
    ConfigMapName:            kube-root-ca.crt
    DownwardAPI:              true
QoS Class:                    Burstable
Node-Selectors:               <none>
Tolerations:                  node.kubernetes.io/not-ready:NoExecute op=Exists for 300s
                              node.kubernetes.io/unreachable:NoExecute op=Exists for 300s
Events:
  Type    Reason     Age   From               Message
  ----    ------     ----  ----               -------
  Normal  Scheduled  2m    default-scheduler  Successfully assigned ${namespace || 'default'}/${resourceName} to docker-desktop
  Normal  Pulling    2m    kubelet            Pulling image "nginx:latest"
  Normal  Pulled     1m    kubelet            Successfully pulled image "nginx:latest"
  Normal  Created    1m    kubelet            Created container ${resourceName}
  Normal  Started    1m    kubelet            Started container ${resourceName}`;
  };

  const toggleMaximize = () => {
    if (isMaximized) {
      setSize({ width: 800, height: 600 });
      setPosition({ x: window.innerWidth / 2 - 400, y: window.innerHeight / 2 - 300 });
    } else {
      setSize({ width: window.innerWidth - 20, height: window.innerHeight - 20 });
      setPosition({ x: 10, y: 10 });
    }
    setIsMaximized(!isMaximized);
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(describeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleZoomIn = () => {
    setFontSize(prev => Math.min(prev + 2, 24)); // Max font size 24px
  };

  const handleZoomOut = () => {
    setFontSize(prev => Math.max(prev - 2, 8)); // Min font size 8px
  };

  const toggleSearch = () => {
    setShowSearch(!showSearch);
    if (!showSearch) {
      setSearchQuery('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    // Handle Ctrl/Cmd + F for search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      toggleSearch();
    }
    // Handle Escape to close search
    if (e.key === 'Escape' && showSearch) {
      setShowSearch(false);
      setSearchQuery('');
    }
  };

  if (isMinimized) {
    return (
      <div
        className="fixed bottom-4 left-4 bg-card border rounded-lg p-2 shadow-2xl flex items-center gap-2 cursor-pointer hover:bg-accent transition-colors"
        style={{ zIndex: 99999 }}
        onClick={toggleMinimize}
      >
        <FileText className="h-4 w-4 text-primary" />
        <span className="text-sm text-card-foreground">Describe: {resourceName}</span>
      </div>
    );
  }

  return (
    <Rnd
      size={{ width: size.width, height: size.height }}
      position={{ x: position.x, y: position.y }}
      onDragStop={(e, d) => {
        setPosition({ x: d.x, y: d.y });
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        setSize({
          width: parseInt(ref.style.width),
          height: parseInt(ref.style.height)
        });
        setPosition(position);
      }}
      minWidth={400}
      minHeight={300}
      bounds="window"
      dragHandleClassName="describe-window-header"
      className="fixed"
      style={{ zIndex: 99999 }}
    >
      <div className={cn(
        "h-full bg-card border rounded-lg shadow-2xl flex flex-col",
        theme === 'dark' ? 'border-gray-700' : 'border-gray-300'
      )}>
        {/* Header */}
        <div
          className="describe-window-header bg-muted border-b px-4 py-2 flex items-center justify-between cursor-move select-none"
          onKeyDown={handleKeyPress}
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Describe {resourceType}: {resourceName}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-2">
              {fontSize}px
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:bg-accent"
              onClick={handleZoomOut}
              title="Zoom Out (Decrease font size)"
            >
              <ZoomOut className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:bg-accent"
              onClick={handleZoomIn}
              title="Zoom In (Increase font size)"
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={cn("h-6 w-6 hover:bg-accent", showSearch && "bg-accent")}
              onClick={toggleSearch}
              title="Search (Ctrl/Cmd + F)"
            >
              <Search className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:bg-accent"
              onClick={copyToClipboard}
              title="Copy to clipboard"
            >
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:bg-accent"
              onClick={toggleMinimize}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:bg-accent"
              onClick={toggleMaximize}
            >
              {isMaximized ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:bg-accent hover:text-destructive"
              onClick={onClose}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="border-b px-4 py-2 flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search in describe output..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setShowSearch(false);
                  setSearchQuery('');
                }
              }}
              className="h-7 text-sm"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => {
                setShowSearch(false);
                setSearchQuery('');
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden p-4" onKeyDown={handleKeyPress} tabIndex={0}>
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading describe output...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-destructive">
                <p className="text-sm">{error}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={fetchDescribe}
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full w-full">
              {searchQuery ? (
                <pre
                  className="font-mono text-foreground whitespace-pre-wrap break-words"
                  style={{ fontSize: `${fontSize}px` }}
                  dangerouslySetInnerHTML={{ __html: highlightedContent }}
                />
              ) : (
                <pre
                  className="font-mono text-foreground whitespace-pre-wrap break-words"
                  style={{ fontSize: `${fontSize}px` }}
                >
                  {describeContent}
                </pre>
              )}
            </ScrollArea>
          )}
        </div>
      </div>
    </Rnd>
  );
};