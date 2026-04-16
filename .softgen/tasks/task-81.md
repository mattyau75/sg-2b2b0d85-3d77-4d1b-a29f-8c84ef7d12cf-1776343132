
---
title: "Production Domain & SSL Validation"
status: "todo"
priority: "urgent"
type: "chore"
tags: ["deployment", "dns", "production"]
created_by: "agent"
created_at: "2026-04-16"
position: 81
---

## Notes:
Finalizing the production bridge for dribblestats.com.au. Ensures SSL is active, DNS records are resolving, and Supabase Auth redirects are updated for the live environment.

## Checklist:
- [x] Verify A Record (76.76.21.21) for dribblestats.com.au in Vercel
- [x] Verify CNAME Record (cname.vercel-dns.com) for www.dribblestats.com.au
- [x] Update Supabase Auth Site URL to https://dribblestats.com.au
- [x] Update Supabase Auth Redirect URLs to include https://dribblestats.com.au/**
- [ ] Verify GitHub Repository Sync (Softgen -> GitHub)
- [ ] Verify Vercel Production Build (GitHub -> Vercel)
- [ ] Test production login flow on the live domain
