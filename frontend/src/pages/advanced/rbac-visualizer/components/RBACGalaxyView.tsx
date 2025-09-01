import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Shield, 
  ShieldCheck, 
  User, 
  Users, 
  Bot,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Pause,
  Play,
  Layers,
  Eye,
  EyeOff
} from 'lucide-react';
import type { RBACResources } from '../types';

interface RBACGalaxyViewProps {
  resources: RBACResources | null;
  onNodeClick?: (node: any) => void;
}

interface OrbitNode {
  id: string;
  name: string;
  type: 'clusterRole' | 'role' | 'serviceAccount' | 'user' | 'group' | 'binding';
  radius: number;
  angle: number;
  speed: number;
  size: number;
  color: string;
  glow: string;
  rules?: number;
  bindings?: number;
  namespace?: string;
  connections: string[];
  orbitLevel: number;
}

export default function RBACGalaxyView({ resources, onNodeClick }: RBACGalaxyViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<OrbitNode | null>(null);
  const [selectedLayers, setSelectedLayers] = useState({
    clusterRoles: true,
    roles: true,
    bindings: true,
    subjects: true
  });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Create orbital nodes from resources
  const nodes = useMemo(() => {
    if (!resources) return [];

    const nodeList: OrbitNode[] = [];
    const nodeMap = new Map<string, OrbitNode>();

    // Center node - the cluster itself
    const centerNode: OrbitNode = {
      id: 'cluster-core',
      name: 'Kubernetes Cluster',
      type: 'clusterRole',
      radius: 0,
      angle: 0,
      speed: 0,
      size: 40,
      color: '#ffffff',
      glow: '#ffffff',
      connections: [],
      orbitLevel: 0
    };
    nodeList.push(centerNode);

    // First orbit - ClusterRoles (radius 150-200)
    let angleStep = (2 * Math.PI) / Math.max(resources.clusterRoles.length, 1);
    resources.clusterRoles.forEach((role, idx) => {
      const node: OrbitNode = {
        id: `cr-${role.metadata.uid}`,
        name: role.metadata.name,
        type: 'clusterRole',
        radius: 150 + Math.random() * 50,
        angle: idx * angleStep,
        speed: 0.002 + Math.random() * 0.001,
        size: 20 + Math.min(role.rules.length, 10),
        color: '#3b82f6',
        glow: '#60a5fa',
        rules: role.rules.length,
        bindings: resources.clusterRoleBindings.filter(b => b.roleRef.name === role.metadata.name).length,
        connections: [],
        orbitLevel: 1
      };
      nodeList.push(node);
      nodeMap.set(role.metadata.name, node);
    });

    // Second orbit - Roles (radius 250-300)
    angleStep = (2 * Math.PI) / Math.max(resources.roles.length, 1);
    resources.roles.forEach((role, idx) => {
      const node: OrbitNode = {
        id: `r-${role.metadata.uid}`,
        name: role.metadata.name,
        type: 'role',
        radius: 250 + Math.random() * 50,
        angle: idx * angleStep,
        speed: 0.0015 + Math.random() * 0.001,
        size: 15 + Math.min(role.rules.length, 8),
        color: '#10b981',
        glow: '#34d399',
        rules: role.rules.length,
        namespace: role.metadata.namespace,
        bindings: resources.roleBindings.filter(b => b.roleRef.name === role.metadata.name).length,
        connections: [],
        orbitLevel: 2
      };
      nodeList.push(node);
      nodeMap.set(`${role.metadata.namespace}/${role.metadata.name}`, node);
    });

    // Third orbit - Bindings and Subjects (radius 350-450)
    const subjects = new Map<string, OrbitNode>();
    
    // Process ClusterRoleBindings
    resources.clusterRoleBindings.forEach((binding) => {
      const roleNode = nodeMap.get(binding.roleRef.name);
      
      binding.subjects?.forEach((subject) => {
        const subjectKey = `${subject.kind}-${subject.name}`;
        if (!subjects.has(subjectKey)) {
          const subjectNode: OrbitNode = {
            id: `subject-${subjectKey}`,
            name: subject.name,
            type: subject.kind === 'ServiceAccount' ? 'serviceAccount' : 
                  subject.kind === 'Group' ? 'group' : 'user',
            radius: 350 + Math.random() * 100,
            angle: Math.random() * 2 * Math.PI,
            speed: 0.001 + Math.random() * 0.0005,
            size: 12,
            color: subject.kind === 'ServiceAccount' ? '#a855f7' : 
                   subject.kind === 'Group' ? '#f97316' : '#ef4444',
            glow: subject.kind === 'ServiceAccount' ? '#c084fc' : 
                  subject.kind === 'Group' ? '#fb923c' : '#f87171',
            namespace: subject.namespace,
            connections: roleNode ? [roleNode.id] : [],
            orbitLevel: 3
          };
          subjects.set(subjectKey, subjectNode);
          nodeList.push(subjectNode);
        } else {
          const subjectNode = subjects.get(subjectKey)!;
          if (roleNode && !subjectNode.connections.includes(roleNode.id)) {
            subjectNode.connections.push(roleNode.id);
          }
        }
      });
    });

    // Process RoleBindings
    resources.roleBindings.forEach((binding) => {
      const roleNode = nodeMap.get(`${binding.metadata.namespace}/${binding.roleRef.name}`) || 
                      nodeMap.get(binding.roleRef.name);
      
      binding.subjects?.forEach((subject) => {
        const subjectKey = `${subject.kind}-${subject.name}-${binding.metadata.namespace}`;
        if (!subjects.has(subjectKey)) {
          const subjectNode: OrbitNode = {
            id: `subject-${subjectKey}`,
            name: subject.name,
            type: subject.kind === 'ServiceAccount' ? 'serviceAccount' : 
                  subject.kind === 'Group' ? 'group' : 'user',
            radius: 350 + Math.random() * 100,
            angle: Math.random() * 2 * Math.PI,
            speed: 0.001 + Math.random() * 0.0005,
            size: 10,
            color: subject.kind === 'ServiceAccount' ? '#a855f7' : 
                   subject.kind === 'Group' ? '#f97316' : '#ef4444',
            glow: subject.kind === 'ServiceAccount' ? '#c084fc' : 
                  subject.kind === 'Group' ? '#fb923c' : '#f87171',
            namespace: subject.namespace || binding.metadata.namespace,
            connections: roleNode ? [roleNode.id] : [],
            orbitLevel: 3
          };
          subjects.set(subjectKey, subjectNode);
          nodeList.push(subjectNode);
        } else {
          const subjectNode = subjects.get(subjectKey)!;
          if (roleNode && !subjectNode.connections.includes(roleNode.id)) {
            subjectNode.connections.push(roleNode.id);
          }
        }
      });
    });

    return nodeList;
  }, [resources]);

  // Animation loop
  useEffect(() => {
    if (!canvasRef.current || !isAnimating) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Set canvas size
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Save context state
      ctx.save();
      
      // Apply zoom and rotation
      ctx.translate(centerX, centerY);
      ctx.scale(zoom, zoom);
      ctx.rotate(rotation);
      ctx.translate(-centerX, -centerY);

      // Draw orbital rings
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.1)';
      ctx.lineWidth = 1;
      [150, 200, 250, 300, 350, 400, 450].forEach(radius => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.stroke();
      });

      // Draw connections
      nodes.forEach(node => {
        if (node.connections.length > 0 && selectedLayers.bindings) {
          node.connections.forEach(targetId => {
            const target = nodes.find(n => n.id === targetId);
            if (target) {
              const x1 = centerX + Math.cos(node.angle) * node.radius;
              const y1 = centerY + Math.sin(node.angle) * node.radius;
              const x2 = centerX + Math.cos(target.angle) * target.radius;
              const y2 = centerY + Math.sin(target.angle) * target.radius;

              // Create gradient for connection
              const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
              gradient.addColorStop(0, node.glow + '40');
              gradient.addColorStop(1, target.glow + '40');

              ctx.strokeStyle = gradient;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              
              // Create curved path
              const controlX = centerX;
              const controlY = centerY;
              ctx.quadraticCurveTo(controlX, controlY, x2, y2);
              ctx.stroke();
            }
          });
        }
      });

      // Draw nodes
      nodes.forEach(node => {
        // Check if layer is visible
        if (node.type === 'clusterRole' && !selectedLayers.clusterRoles) return;
        if (node.type === 'role' && !selectedLayers.roles) return;
        if ((node.type === 'serviceAccount' || node.type === 'user' || node.type === 'group') && !selectedLayers.subjects) return;

        const x = centerX + Math.cos(node.angle) * node.radius;
        const y = centerY + Math.sin(node.angle) * node.radius;

        // Update angle for animation
        if (isAnimating) {
          node.angle += node.speed;
        }

        // Draw glow effect
        const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, node.size * 2);
        glowGradient.addColorStop(0, node.glow + '60');
        glowGradient.addColorStop(0.5, node.glow + '20');
        glowGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(x, y, node.size * 2, 0, 2 * Math.PI);
        ctx.fill();

        // Draw node
        const nodeGradient = ctx.createRadialGradient(x, y, 0, x, y, node.size);
        nodeGradient.addColorStop(0, node.color);
        nodeGradient.addColorStop(0.7, node.color);
        nodeGradient.addColorStop(1, node.glow);
        
        ctx.fillStyle = nodeGradient;
        ctx.beginPath();
        ctx.arc(x, y, node.size, 0, 2 * Math.PI);
        ctx.fill();

        // Draw inner ring for effect
        ctx.strokeStyle = node.glow;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, node.size - 2, 0, 2 * Math.PI);
        ctx.stroke();

        // Check if hovered
        const dist = Math.sqrt(Math.pow(mousePos.x - x, 2) + Math.pow(mousePos.y - y, 2));
        if (dist < node.size) {
          setHoveredNode(node);
          
          // Draw hover effect
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x, y, node.size + 5, 0, 2 * Math.PI);
          ctx.stroke();
        }
      });

      // Restore context state
      ctx.restore();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [nodes, zoom, rotation, isAnimating, selectedLayers, mousePos]);

  // Handle mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  // Handle click
  const handleClick = () => {
    if (hoveredNode && onNodeClick) {
      onNodeClick(hoveredNode);
    }
  };

  if (!resources) {
    return (
      <Card className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">No RBAC data available</p>
      </Card>
    );
  }

  return (
    <Card className="h-full relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated background stars */}
      <div className="absolute inset-0">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white animate-pulse"
            style={{
              width: Math.random() * 3 + 'px',
              height: Math.random() * 3 + 'px',
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
              animationDelay: Math.random() * 5 + 's',
              animationDuration: (Math.random() * 3 + 2) + 's'
            }}
          />
        ))}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />

      {/* Controls */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="secondary"
            className="bg-white/10 backdrop-blur hover:bg-white/20"
            onClick={() => setZoom(Math.min(zoom + 0.1, 2))}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="bg-white/10 backdrop-blur hover:bg-white/20"
            onClick={() => setZoom(Math.max(zoom - 0.1, 0.5))}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="bg-white/10 backdrop-blur hover:bg-white/20"
            onClick={() => setRotation(rotation + Math.PI / 6)}
          >
            <RotateCw className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="bg-white/10 backdrop-blur hover:bg-white/20"
            onClick={() => setIsAnimating(!isAnimating)}
          >
            {isAnimating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
        </div>
        
        {/* Layer toggles */}
        <div className="flex flex-col gap-1 p-2 bg-white/10 backdrop-blur rounded-lg">
          <div className="text-xs font-semibold text-white mb-1 flex items-center gap-1">
            <Layers className="w-3 h-3" />
            Layers
          </div>
          {Object.entries(selectedLayers).map(([layer, visible]) => (
            <Button
              key={layer}
              size="sm"
              variant="ghost"
              className={`text-xs justify-start ${visible ? 'text-white' : 'text-white/40'}`}
              onClick={() => setSelectedLayers(prev => ({ ...prev, [layer]: !prev[layer] }))}
            >
              {visible ? <Eye className="w-3 h-3 mr-1" /> : <EyeOff className="w-3 h-3 mr-1" />}
              {layer.charAt(0).toUpperCase() + layer.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 p-3 bg-white/10 backdrop-blur rounded-lg">
        <div className="flex flex-col gap-2 text-xs text-white">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>ClusterRoles</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Roles</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span>ServiceAccounts</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span>Groups</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Users</span>
          </div>
        </div>
      </div>

      {/* Hover info */}
      {hoveredNode && (
        <div className="absolute top-4 right-4 p-4 bg-white/10 backdrop-blur rounded-lg text-white">
          <div className="font-semibold mb-2">{hoveredNode.name}</div>
          <div className="text-xs space-y-1">
            <div>Type: {hoveredNode.type}</div>
            {hoveredNode.namespace && <div>Namespace: {hoveredNode.namespace}</div>}
            {hoveredNode.rules !== undefined && <div>Rules: {hoveredNode.rules}</div>}
            {hoveredNode.bindings !== undefined && <div>Bindings: {hoveredNode.bindings}</div>}
            <div>Connections: {hoveredNode.connections.length}</div>
          </div>
        </div>
      )}

      {/* Title */}
      <div className="absolute top-4 right-1/2 transform translate-x-1/2">
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="w-5 h-5" />
          <h2 className="text-xl font-bold">RBAC Galaxy</h2>
          <Sparkles className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}