You are researching shadcn components for implementation.

INPUT: design-docs/[task-name]/requirements.md

STEPS:
1. Read the requirements file for component list

2. FOR EACH component in the list:
   a. Call mcp__shadcn__view_items_in_registries
      - Get full implementation details
      - Note all file dependencies
   
   b. Call mcp__shadcn__get_item_examples_from_registries  
      - Query: "[component]-demo"
      - Get the most relevant example
      - If form-related, get validation examples
      - If data-related, get loading state examples

3. Call mcp__shadcn__get_add_command_for_items
   - Get installation for ALL components at once

4. OUTPUT to design-docs/[task-name]/component-research.md:
   ```markdown
   ## Installation Commands:
   ```bash
   npx shadcn@latest add form input button card alert label

   Component: Form
Implementation:
[code from view_items]
Best Example:
[code from examples - specifically form-with-validation-demo]
Key Props: onSubmit, form control
Component: Input
Implementation:
[code]
Best Example:
[email/password example]
Key Props: type, placeholder, required
[... continue for all components]