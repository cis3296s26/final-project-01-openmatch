# Open Match 

Open Match is a web application made to allow casual players, friend groups, and
informal teams to find other nearby players or groups for recreational sports matches. The
platform functions as a live availability board where users signal that they are ready to play and
find others looking for a match at the same time. Users can create a profile as an individual or as part of a group, select a sport, skill level,
preferred team size, and general location, and toggle their current availability status being either
Ready, Away, or Offline. When marked as Ready, users/groups can post a short-lived match
request describing the game they want to play based on a fixed selection. This can range from a
casual soccer match to a competitive basketball game. Other nearby users/groups can view and
request to accept these requests. Open Match also displays nearby sports fields depending on game selection chosen.
Fields are informational only and cannot be reserved, but availability notes are provided. Once a
match is accepted, participants are shown the selected field location and can coordinate final
details using external communication.

![This is a screenshot.](POC_Image.png) 
![This is a screenshot.](POC_Image2.png)

# How to run

## Requirements
- OS: Windows 10+/macOS/Linux
- Docker Desktop
- Python 3.11+
- Node.js 20+
- Configure/Create .env files
- Configure/Create servers.json

## Configure Environment Files
When working locally, you have to set up the .env files for both the backend and frontend manually.
The backend\\.env.example file describes what should be contained in each of these files.

frontend\\.env.local - contains the localhost port where the backend is being hosted, 8000 by default
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_WS_BASE_URL=http://localhost:8000
```

backend\\.env.local - contains default ports for the database, redis, and frontend. However, the user must configure the secret key, email, and password.
```
APP_ENV=dev
DATABASE_URL=postgresql+psycopg2://openmatch:openmatch@localhost:5432/openmatch
REDIS_URL=redis://localhost:6379/0
FRONTEND_URL=http://localhost:3000
SECRET_KEY=SECRET_KEY_GOES_HERE

YELP_API_KEY=your/yelp/api/key

** FOR DEVELOPEMENT THIS IS UNEEDED, IT WILL PRINT VERIFICATION TO CONSOLE **
MAIL_USERNAME=EMAIL_USERNAME_GOES_HERE
MAIL_PASSWORD=EMAIL_PASSWORD_GOES_HERE
```
The backend requires a SECRET_KEY environment variable for JWT authentication. Generate one with:
```bash
openssl rand -hex 32
or 
```
```bash
python -c "import secrets; print(secrets.token_hex(32))" 
```
The backend also requires an email address and password from which verification emails for openmatch are sent. If done with gmail, the password must be a 16 character app password.

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
```

### Install requirements and run backend
```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

##### Check the docs at:

http://localhost:8000/docs#/

Or

http://localhost:8000/redoc

##### =-=-= Testing: pytest =-=-=

In .\backend\, run:
```bash
pytest
```

### 3. Run the frontend
```bash
cd frontend
npm install
npm run dev
```

Start pgAdmin: 

For running pgAdmin without information in servers.json and docker-compose.yaml:

Windows: 
```bash
docker run -p 5050:80 -e PGADMIN_DEFAULT_EMAIL=admin@example.com -e PGADMIN_DEFAULT_PASSWORD=admin dpage/pgadmin4
```
Otherwise, docker-compose.yaml contains all neccessary information to automatically start and configure a local/production database.

check docker using:

```bash
docker ps
```
pgAdmin: http://localhost:5050/login

Email: ``` admin@example.com ```

Password: ``` admin ```

Local Database Passowrd: ``` openmatch ```

# Deployment using Render

Services:

Frontend: Next.js container
Backend: FastAPI contaier
Database: Render managed PostgreSQL
Cache: Render managed Redis

Configure in render.yaml

Go to Renders website and link the repo, then select the render.yaml to build.


# Access deployed database using Render

### **This section applies only if servers.json was not created**
In pgAdmin, right click Servers => Register => Server

Go your render database and copy the external connection details and paste into pgAdmin:

Host (ending with .(originhost).render.com)
Port
Database
Username
Password

SSL Mode: require

Finally click save.

# Live Web-app

https://openmatch-frontend.onrender.com

https://openmatch-backend.onrender.com/health

# How to contribute
Follow this project board to know the latest status of the project: [https://github.com/orgs/cis3296s26/projects/28](https://github.com/orgs/cis3296s26/projects/28)  

<!-- ### How to build
- Use this github repository: https://github.com/cis3296s26/final-project-01-openmatch.git
- Specify what branch to use for a more stable release or for cutting edge development.  
- Use InteliJ 11
- Specify additional library to download if needed 
- What file and target to compile and run. 
- What is expected to happen when the app start.  -->
