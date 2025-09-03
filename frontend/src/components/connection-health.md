# Connection Health Component

A compact and space-efficient React component for displaying connection status and real-time metrics using shadcn/ui components.

## Features

✨ **Compact Design**: Single-line layout perfect for sidebars and tight spaces
🎯 **Tooltips**: Hover interactions for detailed information without taking up space  
🎨 **Status Colors**: Visual indicators with smooth transitions and pulse animations
📊 **Smart Formatting**: Auto-formats large numbers (1.2k, 3.4m) and time durations
⏱️ **Real-time Updates**: Live uptime calculation and animated metrics
🌊 **Subtle Animations**: Pulse effects for active connections and smooth transitions

## Usage

### Basic Usage

```tsx
import { ConnectionHealth } from '@/components/connection-health'

function Sidebar() {
  return (
    <ConnectionHealth
      isConnected={true}
      latency={45}
      messageCount={1247}
      connectedAt={new Date(Date.now() - 39000)}
      compact={true}
    />
  )
}
```

### With Custom Hook

```tsx
import { ConnectionHealth } from '@/components/connection-health'
import { useConnectionHealth } from '@/hooks/use-connection-health'

function Sidebar() {
  const connectionHealth = useConnectionHealth()
  
  return (
    <ConnectionHealth
      isConnected={connectionHealth.isConnected}
      latency={connectionHealth.latency}
      messageCount={connectionHealth.messageCount}
      connectedAt={connectionHealth.connectedAt}
      compact={true}
    />
  )
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isConnected` | `boolean` | `true` | Connection status |
| `latency` | `number \| null` | `null` | Network latency in milliseconds |
| `messageCount` | `number` | `0` | Total messages received |
| `connectedAt` | `Date` | `new Date()` | Connection timestamp |
| `compact` | `boolean` | `false` | Enable compact mode for sidebars |
| `className` | `string` | `undefined` | Additional CSS classes |

## Modes

### Compact Mode (`compact={true}`)
Perfect for sidebars and tight spaces:
- Single line layout with inline metrics
- Tooltips for detailed information
- Minimal height footprint
- Status indicator with pulse animation

### Expanded Mode (`compact={false}`)
Full details view:
- Grid layout with individual metric cards
- Icons and descriptions for each metric
- Status badge at bottom
- Larger, more detailed display

## Examples

### Different Connection States

```tsx
// Connected with good latency
<ConnectionHealth
  isConnected={true}
  latency={25}
  messageCount={1200}
  connectedAt={new Date(Date.now() - 60000)}
  compact={true}
/>

// Disconnected state
<ConnectionHealth
  isConnected={false}
  latency={null}
  messageCount={0}
  connectedAt={new Date()}
  compact={true}
/>

// High message volume
<ConnectionHealth
  isConnected={true}
  latency={78}
  messageCount={156789} // Displays as "156.8k"
  connectedAt={new Date(Date.now() - 3600000)}
  compact={true}
/>
```

## Styling

The component uses shadcn/ui design system:
- **Colors**: Green for connected, red for disconnected, orange for N/A states
- **Typography**: Uses system font stack with monospace for numbers
- **Animations**: CSS transitions and pulse effects
- **Dark Mode**: Automatically adapts to theme context

## Integration

### In Sidebar
```tsx
// In expanded sidebar
{!collapsed && (
  <div className="space-y-1">
    <h2 className="px-2 text-xs font-semibold tracking-tight text-muted-foreground uppercase">
      Connection
    </h2>
    <ConnectionHealth {...connectionProps} compact={true} />
  </div>
)}

// In collapsed sidebar  
{collapsed && (
  <div className="flex justify-center">
    <ConnectionHealth {...connectionProps} compact={true} />
  </div>
)}
```

### Demo Page
Visit `/demo/connection-health` to see the component in action with:
- Interactive controls to test different states
- Real-time updates and animations
- Both compact and expanded modes
- Various usage examples

## Dependencies

- React 19+
- shadcn/ui components (Badge, Tooltip)
- Lucide React icons
- Tailwind CSS for styling

## Files

- `src/components/connection-health.tsx` - Main component
- `src/hooks/use-connection-health.ts` - Simulation hook  
- `src/pages/connection-health-demo.tsx` - Demo page
- Integrated in `src/components/layout/sidebar-new.tsx`