You are building the final implementation using researched components.

INPUT: 
- design-docs/[task-name]/requirements.md
- design-docs/[task-name]/component-research.md
- use sequential thinking mcp server and follow the best practices like, re-usable components, no file should cross more number of lines. 
- Always follow user inputs.
- break it down into smaller, reusable components following
  the MVP pattern.
- create a proper folder structure for the task implementation features with small, reusable
  components.

STEPS:
1. Read both input files

2. Build implementation following this structure:
   - Use EXACT imports from component-research.md
   - Follow hierarchy from requirements.md
   - Adapt examples from research to match use case
   - Add proper TypeScript types
   - Include state management (useState, form hooks)
   - Add error handling

3. Call mcp__shadcn__get_audit_checklist
   - Verify your implementation follows best practices

4. OUTPUT Complete implementation:
   ```tsx
   // All necessary imports
   import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
   import { Input } from "@/components/ui/input"
   import { Button } from "@/components/ui/button"
   import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
   import { Alert, AlertDescription } from "@/components/ui/alert"
   
   // Complete, working implementation
   export function LoginForm() {
     // Full implementation based on researched components
     // Properly typed, with validation
     // Ready to paste and use
   }

- use squentail thinking mcp server and understand the project structure and follow the principles.

Also output setup instructions:

Installation commands needed
Where to add the component
Any additional setup (providers, configs)