# Project Instructions & Rules

This file contains custom instructions and project-specific rules for the AI coding agent. These instructions are automatically loaded and followed during every interaction.

## Project Conventions
- **Styling**: Always use Tailwind CSS for UI components.
- **Components**: Prefer functional components and hooks for React.
- **Icons**: Use `lucide-react` for all iconography.
- **Typography**: Primary font is 'Inter', using standard Tailwind font-sans.

## Design Philosophy
- Follow refined and polished UI patterns.
- Maintain consistent spacing and minimal vertical margins as requested.
- Ensure all charts in the `StatsPage` have unique IDs to avoid hydration or duplicate key errors.

## Specific Task Rules
- When modifying `StatsPage.tsx`, ensure multi-select popovers (Era, Category) maintain their current styling and accessibility.
- All search/filter logic should be applied immediately upon clicking the "검색하기" (Search) button.
