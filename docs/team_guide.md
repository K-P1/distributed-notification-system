# Collaborators Guide

**Welcome to the Distributed Notification System monorepo!**  
This guide helps everyone get the project running locally.

## 1. Prerequisites (install once)
- Git
- Docker + Docker Compose (v2.20+)
- Any code editor (VS Code recommended)

That’s it — no Python/Node versions to install, everything runs in containers.

## 2. Clone & Enter the Repo
```bash
git clone <your-repo-url>
cd distributed-notification-system
```

## 3. Create Your Feature Branch
Replace `<your-name>` or `<service>` with something meaningful:
```bash
git checkout -b api-gateway        # API Gateway dev
git checkout -b email-service      # Email Service dev
git checkout -b user-service       # etc.
```

## 4. Start the Entire System (the magic command)
From the **project root** (where `infra/docker-compose.yaml` lives):
```bash
docker compose up --build
```
- First run takes 2-4 minutes (builds all images).
- Subsequent runs are instant.
- All services start:  
  RabbitMQ, Redis, PostgreSQL, API Gateway, User Service, Email Service, Push Service, Template Service.

## 5. How to Connect to Other Services (just use the service name!)
Inside any service container (or even locally for quick tests), use these hostnames:

| Service         | URL / Connection string                     | Port inside container |
|-----------------|---------------------------------------------|-----------------------|
| API Gateway     | `http://api-gateway:8000`                   | 8000                  |
| User Service    | `http://user-service:3000`                  | 3000                  |
| Template Service| `http://template-service:4000`              | 4000                  |
| Email Service   | `http://email-service:5000`                 | 5000                  |
| Push Service    | `http://push-service:6000`                  | 6000                  |
| RabbitMQ        | `amqp://rabbitmq:5672`                      | 5672                  |
| RabbitMQ Mgmt   | http://localhost:15672 (user: guest, pass: guest) | 15672 (host)      |
| Redis           | `redis://redis:6379`                        | 6379                  |
| PostgreSQL      | `postgresql://postgres:postgres@postgres:5432/postgres` | 5432        |

**Example (Email Service connecting to queue):**
```python
amqp://rabbitmq:5672  # works automatically, no localhost or IP needed
```

## 6. Environment Variables
- Copy the sample file in your service folder:
  ```bash
  cp services/your-service/.env.sample services/your-service/.env
  ```
- Edit `.env` if needed (most values already point to the service names above).

## 7. Adding Your Service to Docker Compose
1. Copy an existing block in `infra/docker-compose.yaml`.
2. Change:
   - `service:` name
   - `build:` path to your folder
   - container port
3. Run `docker compose up --build` again → your service joins the party.

## 8. Useful Commands
```bash
# Rebuild everything after code changes
docker compose up --build

# Run in background
docker compose up -d

# See logs of a specific service
docker compose logs -f api-gateway

# Stop everything
docker compose down

# Stop + remove volumes (fresh DB/cache)
docker compose down -v
```

## 9. Testing Locally
- API Gateway is exposed on http://localhost:8000
- RabbitMQ management UI: http://localhost:15672 (guest/guest)
- PostgreSQL accessible via any client on `localhost:5432`

## 10. Before Committing
```bash
git pull origin main          # get latest docker-compose & shared config
git push origin your-branch   # push your work
```
