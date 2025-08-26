const fs = require('fs');
const path = require('path');

const nodeFiles = [
  'EndpointsNodeV2.tsx',
  'RoleNodeV2.tsx',
  'RoleBindingNodeV2.tsx', 
  'ServiceAccountNodeV2.tsx',
  'ReplicaSetNodeV2.tsx',
  'ConfigMapNodeV2.tsx',
  'SecretNodeV2.tsx',
  'ContainerNodeV2.tsx'
];

nodeFiles.forEach(file => {
  const filePath = path.join('src/pages/advanced/topology/components/nodes', file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove all extra </MultiHandleWrapper> tags except the one at the end
  const lines = content.split('\n');
  const cleanedLines = [];
  let multiHandleCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Count opening tags
    if (line.includes('<MultiHandleWrapper>')) {
      multiHandleCount++;
      cleanedLines.push(line);
    }
    // Keep only the last closing tag
    else if (line.includes('</MultiHandleWrapper>')) {
      multiHandleCount--;
      if (multiHandleCount === 0) {
        cleanedLines.push(line);
      }
    } else {
      cleanedLines.push(line);
    }
  }
  
  fs.writeFileSync(filePath, cleanedLines.join('\n'));
  console.log(`Fixed ${file}`);
});