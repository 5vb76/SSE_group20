# SSE_Group20
For the course SSE to build a security app for COVID
# How to run?

### Tech Stack

| Layer | Technology |
|--------|-------------|
| **Backend Framework** | [Express.js](https://expressjs.com/) |
| **Database** | MySQL 8.4 |
| **NPM DB connect** | mysql2 |
| **Frontend** | HTML + CSS + JS (Vue?) |
| **Environment** | Node.js |
| **OS** | Windows / macOS(Is that work?)  |
### 📁 Project Structure
```
myapp/
├── bin 
├── app.js 
├── database/ # database folder
│ ├── database.sql  # Database
│ └── db.js         # Connection to pool
├── package.json
├── public/ 
│ ├── login.html
│ ├── stylesheets/
│ │ └── login.css
│ └── js/
│ │ └── login.js
├── routes/ 
│ └── index.js
│ └── users.js
└── README.md
```
## 1. Prepare environment
### Install Node.js & npm
Download [Node.js LTS](https://nodejs.org/en/download/), Check npm status:
```
node -v
npm -v
```

### Install MySQL
1. Install MySQL Community Server
2. Set root Password
3. Launch MySql server.

# 10/10 UPDATE: IMPORTANT
Follow the Makefile to setup environment and database.
### 1. Setup environment
Use command
```
make setup
```
### 2. Initialize all database
Use Command
```
make init
```

### 3. Initialize database data / Reset data (Really useful)
Use command
```
make db
```

# OLD GUIDE (You can skip the rest..)

## 2. Initialization
### Initialise Database
Using command to import database.
```
mysql -u root -p                                                                        # use your password to launch MySQL.

CREATE DATABASE covid_service CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;         # Create database called covid_service.
exit;

mysql -u root -p covid_service < database.sql                                           # Run this command within the database folder.
```
## 3.Install dependencies and Run
```
npm install
npm install -g express-generator
npm install nodemailer mysql2
```
Then run the service.
```
npm start
```
## 4.Database Configuration
You might need to change a few configuration in database/db.js to connect DB to pool,.
```
js

const pool = mysql.createPool({
  host: '127.0.0.1',                    # You dont need to change it I think...
  user: 'xxxxxxxx',                     # Your Mysql username, should be the same.
  password: 'xxxxxxxx',                 # Your password
  database: 'covid_service',            # The same name as you decided in Step 2.
});

```
# More is on the way........
