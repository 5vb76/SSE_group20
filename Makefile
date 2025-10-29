DB_USER = root
DB_NAME = covid_service
SESSION_DB_NAME = gogo
SQL_FILE = database/database.sql 

.PHONY: init db setup

setup:
	@echo "Installing project dependencies..."
	@npm install nodemailer mysql2 bcryptjs express-rate-limit express-validator helmet express-slow-down
	@npm install
	@npm install -g express-generator
	@npm i express mysql2 express-session express-mysql-session crypto
	@echo "Setup completed successfully!"

init:
	@echo "Creating database $(DB_NAME) if not exists..."
	@mysql -u $(DB_USER) -p -e "CREATE DATABASE IF NOT EXISTS $(DB_NAME) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
	@echo "Database $(DB_NAME) Created!"
	@echo "Creating database $(SESSION_DB_NAME) if not exists..."
	@mysql -u $(DB_USER) -p -e "CREATE DATABASE IF NOT EXISTS $(SESSION_DB_NAME) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
	@echo "Database $(SESSION_DB_NAME) Created!"
	@$(MAKE) db

db:
	@echo "Importing $(SQL_FILE) into database '$(DB_NAME)' ..."
	@mysql -u $(DB_USER) -p $(DB_NAME) < $(SQL_FILE)
	@echo "Database imported successfully!"
