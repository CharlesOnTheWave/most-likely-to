---
starter_id: 10x-astro-starter
package_manager: npm
project_name: most-likely-to
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: true
  has_ai: false
  has_background_jobs: false
---

## Why this stack

A solo, after-hours builder shipping a browser party game ("Most Likely To") in 8 weeks, for tens to a hundred users, with host sign-in via an external provider and a live round that must reveal results to every player within 2 seconds of the last vote. The language family is JS/TS: the game runs in the phone browser, so the client is JavaScript regardless, and one language across client and server keeps the moving parts minimal for a beginner working with an agent. `10x-astro-starter` is the recommended default for `(web, js)`, clears all four agent-friendly gates (typed, convention-based, popular in training data, well documented), and ships auth, database, and edge deployment out of the box; bootstrapper confidence is first-class, so scaffolding should be smooth with at most occasional manual steps. One flagged gap: the starter card does not list realtime, which the PRD requires (FR-007, FR-009, FR-011, FR-020); the bundled database offers a realtime channel, but the edge runtime constrains long-lived connections, so this must be designed deliberately at bootstrap. Deployment defaults to Cloudflare Pages (user deferred to the starter default), CI on GitHub Actions with auto-deploy on merge.
