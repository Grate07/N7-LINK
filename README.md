# N7-Link

A free and open Minecraft ↔ Discord account linking system for **Velocity networks**.

N7-Link allows Minecraft players to link their Minecraft account with their Discord account using a temporary verification code.

It supports **Java and Bedrock players** when used with Geyser and Floodgate.

---

## Features

- Minecraft `/link`
- Discord `/link`
- Discord `/profile`
- Discord `/linkinfo`
- Discord `/unlink`
- Discord linking panel
- Automatic Linked Discord role
- Temporary verification codes
- Configurable code expiration
- PostgreSQL support
- Supabase support
- Configurable linking rewards
- `%player%` placeholder
- `%uuid%` placeholder
- Permanent reward protection
- Java player support
- Bedrock player support
- Velocity support
- Paper reward bridge
- Reward confirmation system
- GitHub Actions build support
- Free to use

---

# How N7-Link Works

N7-Link consists of four main components:

| Component | Runs On | Purpose |
|---|---|---|
| N7-Link | Velocity | Handles Minecraft linking |
| N7-Link Bridge | Paper | Executes Minecraft rewards |
| N7-Link API | Node.js | Handles linking/database requests |
| N7-Link Bot | Node.js | Handles Discord commands |

The database is PostgreSQL-compatible. Supabase can be used as the database provider.

---

# Architecture

```text
                         Discord
                            │
                            ▼
                    ┌───────────────┐
                    │ Discord Bot   │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  N7-Link API  │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  PostgreSQL   │
                    │   / Supabase  │
                    └───────────────┘


Java Player ─────────────────────────┐
                                     │
Bedrock Player                       │
       │                             │
       ▼                             │
Geyser + Floodgate                   │
       │                             │
       └──────────────► Velocity ◄───┘
                            │
                            │
                         N7-Link
                            │
                            ▼
                          Paper
                            │
                     N7-Link Bridge
                            │
                            ▼
                         Rewards