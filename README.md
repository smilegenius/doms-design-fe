Getting Started with Claude Code & Claude Design

1. Install Claude DesktopDownload and install the Claude Desktop application.

2. Choose the Right ModeUse the mode based on your task:

Claude Design – Best for creating UI screens, mockups, and visual designs from scratch, similar to working with a graphic designer. Great for building individual screens and exploring design ideas.
Claude Code – Best for building fully functional prototypes or working directly with code that runs in real time.


3. Set Up Your Project
Clone your GitHub repository.
Install Git on your local machine (if not already installed).
Open the Code tab in Claude and select your local repository folder.


4. Start WorkingCreate a new session, select your local project folder, and start your local development server using a command such as:
Run localhost preview
Once the preview is running, you can begin making changes.

A. Edit Existing UI

Click the Select Element (arrow) tool.
Select any UI element (text, card, button, section, etc.).
Describe the change you want, and Claude will update it.
B. Build Larger Features

Switch to Plan Mode first.
Review the generated implementation plan.
Once satisfied, continue with Accept Edits or Auto Mode to apply the changes.
C. Improve Existing Designs

Take a screenshot of your current UI.
Paste it into Claude Design or Claude Code.
Ask Claude to enhance or redesign it.
When the design is finalized, easily bring those improvements into your Claude Code prototype.


Our WorkflowSince we already have an established design system, we're skipping Claude Design and working directly in Claude Code with our design repository.
Quick Setup Video
Watch the setup walkthrough here:
https://www.loom.com/share/75674bdc7bc64aceb21b4eed9158f144



Pro Tips :rocket:
Clear your context regularly:
Long conversations consume context and can reduce response quality. Start a new chat/session after completing a feature or when switching to a different task.

One feature per session:
Avoid mixing unrelated tasks in the same conversation. Keeping each session focused gives Claude better context.

Plan before building:
For medium or large features, always start with Plan Mode. Review the plan before allowing Claude to make changes.

Use Element Selection:
Instead of describing the entire page, select the specific component you want to modify. This results in more accurate changes.

Give precise prompts
Instead of:
Make this better.
Try:
Convert this table into cards with filters, pagination, and responsive mobile layout.
The more specific your prompt, the better the output.

Commit frequently
Once a feature is working, commit your changes before starting the next task. This makes it easy to revert if needed.

Keep localhost running
Leaving the local preview running allows Claude to inspect and verify changes in real time.

Reference existing components
Ask Claude to reuse existing components rather than creating new ones. This keeps the UI consistent with the design system.

Build incrementally
Avoid asking Claude to build an entire application in one prompt. Break large features into smaller tasks.

Review before accepting
Always review generated code and UI before accepting all edits. Claude is fast, but a quick review helps catch edge cases.

Take screenshots for visual changes
When something is easier to explain visually, paste a screenshot and annotate what should change.
