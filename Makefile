DB_USER = root
DB_NAME = covid_service
SQL_FILE = database/database.sql 

.PHONY: init db setup

setup:
	@echo "Installing project dependencies..."
	@npm install nodemailer mysql2
	@npm install
	@npm install -g express-generator
	@echo "Setup completed successfully!"

init:
	@echo "Creating database $(DB_NAME) if not exists..."
	@mysql -u $(DB_USER) -p -e "CREATE DATABASE IF NOT EXISTS $(DB_NAME) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
	@$(MAKE) db

db:
	@echo "Importing $(SQL_FILE) into database '$(DB_NAME)' ..."
	@mysql -u $(DB_USER) -p $(DB_NAME) < $(SQL_FILE)
	@echo "Database imported successfully!"