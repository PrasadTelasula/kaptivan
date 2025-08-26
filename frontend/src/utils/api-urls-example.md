# Centralized API URL Builder - Benefits Example

## Before (Scattered Encoding)
Every service and component had to manually encode URLs:

```typescript
// In pods.service.ts
const url = `${API_BASE_URL}/api/v1/pods/${encodeClusterName(context)}/${encodeNamespace(namespace)}/${encodeResourceName(name)}`

// In deployments.service.ts  
const url = `${API_BASE_URL}/api/v1/deployments/${encodeClusterName(context)}/${encodeNamespace(namespace)}/${encodeResourceName(name)}`

// In terminal component
const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/api/v1/pods/${encodeClusterName(cluster)}/${encodeNamespace(namespace)}/${encodeResourceName(podName)}/exec/ws`
```

### Problems:
- URL construction logic scattered across 20+ files
- If encoding logic needs to change, must update every file
- Easy to miss encoding in some places
- No type safety for parameters
- Duplicated URL patterns

## After (Centralized Builder)
Single source of truth in `api-urls.ts`:

```typescript
// In pods.service.ts
const url = apiUrls.pods.get(context, namespace, name)

// In deployments.service.ts
const url = apiUrls.deployments.get(context, namespace, name)  

// In terminal component
const wsUrl = apiUrls.pods.execWs(cluster, namespace, podName, container)
```

### Benefits:
✅ **Single Source of Truth**: All URL patterns defined in one file
✅ **Automatic Encoding**: Encoding handled internally by the builder
✅ **Type Safety**: TypeScript ensures correct parameters
✅ **Easy to Maintain**: Change encoding logic in ONE place
✅ **Consistent**: Same pattern used everywhere
✅ **Testable**: Can unit test URL construction separately
✅ **Future-proof**: Easy to add new encoding rules or parameters

## Example: Adding a new encoding rule
If AWS changes their EKS ARN format or we need to handle Azure AKS clusters differently:

### Before: Update 20+ files
```typescript
// Would need to update EVERY file that constructs URLs
```

### After: Update 1 file
```typescript
// In api-urls.ts
function encode(value: string | undefined): string {
  if (!value) return '';
  
  // New logic for different cluster types
  if (value.startsWith('arn:aws:eks')) {
    // Special encoding for EKS
    return customEKSEncode(value);
  } else if (value.startsWith('azure://')) {
    // Special encoding for AKS  
    return customAKSEncode(value);
  }
  
  return encodeURIComponent(value);
}
```

That's it! All services automatically use the new encoding.