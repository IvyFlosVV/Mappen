# Reflection

<!-- I (Ivy) write this myself without AI, per assignment rules. Do not edit. -->
## Timeline log (facts only, reflection written later)

- 4/19 evening: Phase 1 complete. Scaffolded Expo + Express monorepo, 
  set up Supabase with RLS and auto-profile trigger. Verified end-to-end.
  
I learned to distinguish between Cursor's "command to run" suggestions and actually verifying commands work. The agent's reports described expected behavior, but real verification caught multiple disconnects (e.g., stale nodemon processes showing "clean exit" after Ctrl+C, SQL linter warnings that weren't in the prompt). Treating the agent as a collaborator whose output I verify — not as an executor I trust blindly — was the single biggest shift from how I imagined using AI.