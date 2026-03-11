# Open Match 
Open Match is a web app that lets individuals/groups post and discover casual sports matches in real time.
Tech Stack: Next.js, FastAPI, PostgreSQL, Redis, WebSockets.

![This is a screenshot.](images.png) 

# How to run

## Requirements
- OS: Windows 10+/macOS/Linux
- Docker Desktop
- Python 3.11+
- Node.js 20+

## Run Locally

### 1. Start Postgres + Redis
From the repo root:
```bash 
docker compose up -d
```
To stop containers
```bash 
docker compose down
```
### 2. Run the backend
```bash
cd backend
python -m venv .venv
```

# Windows:
```bash
.venv\Scripts\activate
```
# macOS/Linux:
```bash
source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Run the frontend
```bash
cd frontend
npm install
npm run dev
```

Start pgAdmin: 

Windows: 
```bash
docker run -p 5050:80 -e PGADMIN_DEFAULT_EMAIL=admin@example.com -e PGADMIN_DEFAULT_PASSWORD=admin dpage/pgadmin4
```

check docker using:

```bash
docker ps
```
pgAdmin: http://localhost:5050/login

# How to contribute
Follow this project board to know the latest status of the project: [http://...]([http://...])  

### How to build
- Use this github repository: ... 
- Specify what branch to use for a more stable release or for cutting edge development.  
- Use InteliJ 11
- Specify additional library to download if needed 
- What file and target to compile and run. 
- What is expected to happen when the app start. 
