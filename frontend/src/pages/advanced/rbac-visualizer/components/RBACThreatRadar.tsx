import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { 
  Shield, 
  ShieldAlert,
  AlertTriangle,
  Activity,
  Zap,
  Target,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  RefreshCw,
  Info
} from 'lucide-react';
import type { RBACResources } from '../types';

interface RBACThreatRadarProps {
  resources: RBACResources | null;
  onNodeClick?: (node: any) => void;
}

interface ThreatNode {
  id: string;
  name: string;
  type: 'role' | 'clusterRole' | 'subject';
  threatLevel: number; // 0-100
  permissions: string[];
  angle: number;
  radius: number;
  visible: boolean;
  pulseIntensity: number;
}

interface RadarRing {
  radius: number;
  label: string;
  color: string;
  threatLevel: number;
}

export default function RBACThreatRadar({ resources, onNodeClick }: RBACThreatRadarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [selectedNode, setSelectedNode] = useState<ThreatNode | null>(null);
  const [threatThreshold, setThreatThreshold] = useState(50);
  const [showLabels, setShowLabels] = useState(true);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<ThreatNode | null>(null);
  const [time, setTime] = useState(0);

  // Calculate threat nodes from resources
  const threatNodes = useMemo((): ThreatNode[] => {
    if (!resources) return [];

    const nodes: ThreatNode[] = [];
    
    // Analyze ClusterRoles
    resources.clusterRoles.forEach((role, index) => {
      const hasWildcard = role.rules.some(rule => 
        rule.verbs.includes('*') || rule.resources?.includes('*')
      );
      const hasDelete = role.rules.some(rule => 
        rule.verbs.includes('delete') || rule.verbs.includes('deletecollection')
      );
      const hasCreate = role.rules.some(rule => 
        rule.verbs.includes('create') || rule.verbs.includes('update')
      );
      
      let threatLevel = 20;
      if (hasWildcard) threatLevel = 90;
      else if (hasDelete && hasCreate) threatLevel = 70;
      else if (hasDelete || hasCreate) threatLevel = 50;
      
      const angle = (index / resources.clusterRoles.length) * Math.PI * 2;
      
      nodes.push({
        id: `cr-${role.metadata.uid}`,
        name: role.metadata.name,
        type: 'clusterRole',
        threatLevel,
        permissions: role.rules.flatMap(r => r.verbs),
        angle,
        radius: 150 + (threatLevel / 100) * 100,
        visible: threatLevel >= threatThreshold,
        pulseIntensity: threatLevel / 100
      });
    });

    // Analyze Roles
    resources.roles.forEach((role, index) => {
      const hasDelete = role.rules.some(rule => 
        rule.verbs.includes('delete')
      );
      const hasCreate = role.rules.some(rule => 
        rule.verbs.includes('create') || rule.verbs.includes('update')
      );
      
      let threatLevel = 10;
      if (hasDelete && hasCreate) threatLevel = 60;
      else if (hasDelete || hasCreate) threatLevel = 40;
      
      const angle = (index / resources.roles.length) * Math.PI * 2 + Math.PI;
      
      nodes.push({
        id: `r-${role.metadata.uid}`,
        name: role.metadata.name,
        type: 'role',
        threatLevel,
        permissions: role.rules.flatMap(r => r.verbs),
        angle,
        radius: 100 + (threatLevel / 100) * 80,
        visible: threatLevel >= threatThreshold,
        pulseIntensity: threatLevel / 100
      });
    });

    return nodes;
  }, [resources, threatThreshold]);

  // Radar rings configuration
  const radarRings: RadarRing[] = [
    { radius: 80, label: 'LOW RISK', color: '#10b981', threatLevel: 25 },
    { radius: 140, label: 'MEDIUM RISK', color: '#f59e0b', threatLevel: 50 },
    { radius: 200, label: 'HIGH RISK', color: '#ef4444', threatLevel: 75 },
    { radius: 260, label: 'CRITICAL', color: '#991b1b', threatLevel: 100 }
  ];

  // Animation loop
  useEffect(() => {
    const animate = () => {
      setTime(prev => prev + 0.016 * animationSpeed);
      animationRef.current = requestAnimationFrame(animate);
    };
    
    if (animationSpeed > 0) {
      animationRef.current = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animationSpeed]);

  // Draw radar visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Clear canvas
    ctx.fillStyle = 'rgba(2, 6, 23, 0.95)';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid lines
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(angle) * 280,
        centerY + Math.sin(angle) * 280
      );
      ctx.stroke();
    }
    
    // Draw radar rings
    radarRings.forEach((ring, index) => {
      // Ring circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, ring.radius, 0, Math.PI * 2);
      ctx.strokeStyle = ring.color + '40';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Animated pulse for high threat rings
      if (ring.threatLevel >= 75) {
        const pulseRadius = ring.radius + Math.sin(time * 2) * 5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = ring.color + '20';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      
      // Ring label
      if (showLabels) {
        ctx.fillStyle = ring.color + 'CC';
        ctx.font = '10px Inter';
        ctx.fillText(ring.label, centerX + ring.radius + 10, centerY);
      }
    });
    
    // Draw scanning line
    const scanAngle = (time * 0.5) % (Math.PI * 2);
    const gradient = ctx.createLinearGradient(
      centerX,
      centerY,
      centerX + Math.cos(scanAngle) * 280,
      centerY + Math.sin(scanAngle) * 280
    );
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0)');
    gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.3)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
    
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.cos(scanAngle) * 280,
      centerY + Math.sin(scanAngle) * 280
    );
    ctx.stroke();
    
    // Draw threat nodes
    threatNodes.forEach(node => {
      if (!node.visible) return;
      
      const x = centerX + Math.cos(node.angle + Math.sin(time) * 0.1) * node.radius;
      const y = centerY + Math.sin(node.angle + Math.sin(time) * 0.1) * node.radius;
      
      // Node glow effect
      const glowRadius = 8 + Math.sin(time * 3 + node.angle) * 2 * node.pulseIntensity;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
      
      let color = '#10b981';
      if (node.threatLevel >= 75) color = '#ef4444';
      else if (node.threatLevel >= 50) color = '#f59e0b';
      else if (node.threatLevel >= 25) color = '#3b82f6';
      
      gradient.addColorStop(0, color + 'FF');
      gradient.addColorStop(0.5, color + '80');
      gradient.addColorStop(1, color + '00');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Node core
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Node label
      if (showLabels && (hoveredNode?.id === node.id || selectedNode?.id === node.id)) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '11px Inter';
        ctx.fillText(node.name.substring(0, 20), x + 10, y + 4);
      }
      
      // Connection lines for selected node
      if (selectedNode?.id === node.id) {
        ctx.strokeStyle = color + '60';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
    
    // Draw center indicator
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw threat level indicator
    const maxThreat = Math.max(...threatNodes.map(n => n.threatLevel), 0);
    const indicatorAngle = (maxThreat / 100) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 15, -Math.PI / 2, indicatorAngle);
    ctx.stroke();
    
  }, [threatNodes, time, showLabels, hoveredNode, selectedNode]);

  // Handle canvas click
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Find clicked node
    const clickedNode = threatNodes.find(node => {
      if (!node.visible) return false;
      const nodeX = centerX + Math.cos(node.angle) * node.radius;
      const nodeY = centerY + Math.sin(node.angle) * node.radius;
      const distance = Math.sqrt((x - nodeX) ** 2 + (y - nodeY) ** 2);
      return distance < 15;
    });
    
    if (clickedNode) {
      setSelectedNode(clickedNode);
      onNodeClick?.(clickedNode);
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    if (!threatNodes.length) return { high: 0, medium: 0, low: 0, critical: 0 };
    
    return {
      critical: threatNodes.filter(n => n.threatLevel >= 75).length,
      high: threatNodes.filter(n => n.threatLevel >= 50 && n.threatLevel < 75).length,
      medium: threatNodes.filter(n => n.threatLevel >= 25 && n.threatLevel < 50).length,
      low: threatNodes.filter(n => n.threatLevel < 25).length
    };
  }, [threatNodes]);

  if (!resources) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent>
          <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium">No RBAC data available</p>
          <p className="text-sm text-muted-foreground mt-2">Select a cluster to view threat radar</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex gap-4">
      {/* Main Radar Display */}
      <Card className="flex-1 relative bg-slate-950">
        <CardHeader className="absolute top-0 left-0 z-10">
          <CardTitle className="text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-400" />
            RBAC Threat Radar
          </CardTitle>
        </CardHeader>
        
        <CardContent className="h-full p-0 relative">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="w-full h-full cursor-crosshair"
            onClick={handleCanvasClick}
          />
          
          {/* Controls Overlay */}
          <div className="absolute bottom-4 left-4 flex gap-2">
            <Button
              size="sm"
              variant={showLabels ? "default" : "outline"}
              onClick={() => setShowLabels(!showLabels)}
            >
              {showLabels ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTime(0)}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Threat Level Indicator */}
          <div className="absolute top-4 right-4 bg-black/60 backdrop-blur p-3 rounded-lg">
            <div className="flex items-center gap-2 text-white mb-2">
              <Activity className="w-4 h-4" />
              <span className="text-xs">THREAT LEVEL</span>
            </div>
            <div className="text-2xl font-bold text-red-400">
              {Math.max(...threatNodes.map(n => n.threatLevel), 0).toFixed(0)}%
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Control Panel */}
      <div className="w-80 space-y-4">
        {/* Statistics */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Threat Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-red-500">Critical</span>
              <Badge variant="destructive">{stats.critical}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-orange-500">High</span>
              <Badge className="bg-orange-500">{stats.high}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-yellow-500">Medium</span>
              <Badge className="bg-yellow-500">{stats.medium}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-green-500">Low</span>
              <Badge className="bg-green-500">{stats.low}</Badge>
            </div>
          </CardContent>
        </Card>
        
        {/* Controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Radar Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground">Threat Threshold</label>
              <Slider
                value={[threatThreshold]}
                onValueChange={([value]) => setThreatThreshold(value)}
                min={0}
                max={100}
                step={10}
                className="mt-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0</span>
                <span>{threatThreshold}%</span>
                <span>100</span>
              </div>
            </div>
            
            <div>
              <label className="text-xs text-muted-foreground">Scan Speed</label>
              <Slider
                value={[animationSpeed]}
                onValueChange={([value]) => setAnimationSpeed(value)}
                min={0}
                max={3}
                step={0.5}
                className="mt-2"
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Selected Node Details */}
        {selectedNode && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="w-4 h-4" />
                Selected Entity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium">{selectedNode.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{selectedNode.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-3 h-3 text-yellow-500" />
                  <Progress value={selectedNode.threatLevel} className="flex-1 h-2" />
                  <span className="text-xs">{selectedNode.threatLevel}%</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Permissions</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.permissions.slice(0, 5).map((perm, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {perm}
                      </Badge>
                    ))}
                    {selectedNode.permissions.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{selectedNode.permissions.length - 5}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}