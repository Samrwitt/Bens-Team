# Workroom — manager section

A small working Python + SQLite app centered on permanent assignment IDs. No packages required; Python 3.10+.

## Run

```sh
python3 server.py
```

Open http://127.0.0.1:8000 and use the temporary manager password printed in your terminal. To keep the manager password between restarts, set `MANAGER_PASSWORD` in your environment before starting. Sessions expire after eight hours and reset on server restart.

For sample employees, teams, assignments, and feedback:

```sh
python3 server.py --demo
```

Demo employee passwords are randomly generated; reset them in Employees if needed. Records persist in `tasks.sqlite3`. Set `TASK_DB` to use another SQLite file. Back up that file to preserve data.

## Pages

- Assignments: search by title or ID, filter status, create work for an employee or team.
- Assignment details: brief, owner, deadline, status, feedback, and replies to replies.
- Employees: create accounts with hashed passwords and reset passwords.
- Teams: create teams and edit membership.
- Manager sign-in.

Each feedback record references its assignment and optional parent feedback. Replies are validated to belong to the same assignment. This structure supports later assignment-scoped AI retrieval.

## Scope

This is the working local first version of manager section 1. Employee sign-in/portal, uploads, and AI analysis are future sections. Employee credentials are stored now; no employee portal is exposed yet.

The server binds to localhost. Before public deployment, add HTTPS, production hosting, login rate limiting, account recovery, durable session storage, and employee authorization. Use a strong manager password. The app currently supports one manager.

## Validate

```sh
python3 -m unittest -v test_server.py
```

Actual Chrome screenshots of the demo pages are in `previews/`. No future delivery is scheduled; Wednesday requested in the brief is September 30, 2026.

## Docker

Create `.env` from `.env.example` and set a strong `MANAGER_PASSWORD` (a private `.env` was generated for this workspace). Never commit `.env` or include it in an image.

```sh
docker compose up -d --build --wait
docker compose ps
```

Open http://127.0.0.1:8088. Use the manager password from `.env`. `WORKROOM_PORT` changes the local port. The container runs as a non-root user with a read-only application filesystem. SQLite lives in the `workroom_data` named volume and survives container replacement. The Docker app starts with an empty database; the earlier preview database is separate.

```sh
docker compose logs --tail=50 app
docker compose down
```

`down` preserves data. Do not use `down -v` unless you intend to delete the database. Sessions reset when the container restarts.

For deployment on a server, place an HTTPS reverse proxy in front of the loopback port and set `PUBLIC_ORIGIN=https://your-domain.example` in `.env`. This enables HTTPS origin validation and Secure cookies. The Compose file deliberately publishes only to the server's loopback interface. Provider-specific routing, domain, TLS, and credentials must be configured for the chosen destination before public deployment.

To take a consistent SQLite backup:

```sh
docker compose exec -T app python -c "import sqlite3; source=sqlite3.connect('/data/tasks.sqlite3'); target=sqlite3.connect('/tmp/workroom-backup.sqlite3'); source.backup(target); target.close(); source.close()"
docker compose cp app:/tmp/workroom-backup.sqlite3 ./workroom-backup.sqlite3
```

Backups contain employee and assignment data; keep them private.
