# GCPL — Ice Hockey Goalie Practice Planner

Full-stack Next.js application for Ice Hockey Goalie Coaches to plan, animate, customize, and share goalie practice sessions.

## Features
- **Dynamic Authentication (Local NextAuth/Auth.js + In-App Keycloak Setup)**:
  - Runs out of the box with local PostgreSQL credentials & JWT sessions when no Keycloak server is configured.
  - Includes a **First-Run Admin Setup** wizard (`/setup`) and an **Admin Dashboard** (`/admin`) where an administrator can configure an external **Keycloak** server directly in the UI (stored in PostgreSQL) without editing `.env` files.
  - When Keycloak is enabled in Admin Settings, NextAuth local login is disabled and authentication switches to Keycloak OIDC.
- **Practice Setup Wizard (`/plans/new`)**:
  - Step-by-step setup for session title, date, duration, default rink size, appointed **Goalies**, **Players/Skaters**, and **Coaches**, and initial presentation layout before forwarding to the planner workspace.
- **5 Ice Hockey Rink Sizes & Sections**:
  - **Full Rink** (`200 ft × 85 ft`)
  - **Half Rink** (`100 ft × 85 ft`)
  - **1/3 Rink (Zone)** (`64 ft × 85 ft`)
  - **Section: Goal Crease & Slot** (`45 ft × 50 ft` technical footwork & angle view)
  - **Section: Corner & Below Goal Line** (`45 ft × 45 ft` trapezoid, RVH & puck-handling view)
- **Hybrid Path Drawing & Per-Player Keyframe Animation**:
  - Draw movement paths (`skate`, `backward`, `pass`, `shot`, `t-push`, `shuffle`, `butterfly-slide`, `c-cut`) for Goalies and Players.
  - Customize start delay, individual speed multiplier, goalie stance, and convert drawn paths into explicit timeline **Keyframes** for frame-accurate adjustments.
- **"Design the View" Builder**:
  - Choose between `Multi-Column Grid`, `Split Rink + Notes`, `Sequential Practice Sheet`, and `Single-Drill Focus Carousel`, and reorder/resize/toggle individual content blocks.
- **Shareable Web Links (`/share/[token]`)**:
  - Shares the coach's custom view containing the **static diagram image** (with download), **practice & drill descriptions**, and **interactive animations** with **0.5x (Half)**, **1x (Full)**, and **2x (Double)** speed variations.
- **Docker Packaging (`docker/`)**:
  - All Docker configuration lives inside the `docker/` folder (`docker/Dockerfile`, `docker/docker-compose.yml`, `docker/postgres/init.sql`, `docker/keycloak/realm-export.json`).

## Running with Docker (`docker/` folder)

```bash
# Start Next.js App + PostgreSQL 16
docker compose -f docker/docker-compose.yml up --build -d

# Optional: Also start a pre-configured local Keycloak server for testing
docker compose -f docker/docker-compose.yml --profile keycloak up --build -d
```

Then open `http://localhost:3000`.

## Running Locally for Development

```bash
npm install
npm run dev
```
