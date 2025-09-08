You are analyzing requirements for a complex UI build using shadcn MCP.

INPUT: User request for a complete feature/section

STEPS:
1. Call mcp__shadcn__get_project_registries 
   - Note all available registries
   - If multiple, use the first or ask user

2. Break down the request into components needed
   Example: "login form" needs:
   - Form (form validation)
   - Input (email, password fields)  
   - Button (submit)
   - Label (field labels)
   - Card (container)
   - Alert (error messages)

3. For EACH identified component:
   - Call mcp__shadcn__search_items_in_registries
   - Verify it exists in registry
   - Note the exact name

4. OUTPUT to design-docs/[task-name]/requirements.md:
   ```markdown
   ## Feature: [Name]
   ## Components Required:
   - form (validation and submission)
   - input (email and password fields)
   - button (submit action)
   - card (form container)
   - alert (error display)
   
   ## Component Hierarchy:
   Card
   └── Form
       ├── Label + Input (email)
       ├── Label + Input (password)
       ├── Button (submit)
       └── Alert (errors)