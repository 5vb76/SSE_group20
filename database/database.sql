SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS delivery_service;
DROP TABLE IF EXISTS provider;
DROP TABLE IF EXISTS providers_covid_status;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS users_covid_status;
DROP TABLE IF EXISTS payment;
DROP TABLE IF EXISTS product;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS Email_History;
DROP TABLE IF EXISTS P_Email_History;
DROP TABLE IF EXISTS Reset_History;
DROP TABLE IF EXISTS P_Reset_History;
DROP TABLE IF EXISTS user_address;
DROP TABLE IF EXISTS provider_address;


CREATE TABLE users (
  user_id        BIGINT        NOT NULL AUTO_INCREMENT,
  name           VARCHAR(100)  NOT NULL,
  user_type      ENUM('pending','customer','admin') NOT NULL DEFAULT 'customer',
  email          VARCHAR(255)  NOT NULL UNIQUE,
  password_hash  VARCHAR(255)  NOT NULL,
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_address(
  id            BIGINT        NOT NULL AUTO_INCREMENT,
  user_id       BIGINT        NOT NULL,
  address       VARCHAR(255)  NOT NULL,
  city          VARCHAR(100)  NOT NULL,
  state         VARCHAR(100)  NOT NULL,
  postcode      VARCHAR(20)   NOT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_address_user (user_id),
  CONSTRAINT fk_user_address_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE Email_History (
  id            BIGINT        NOT NULL AUTO_INCREMENT,
  user_id       BIGINT        NOT NULL,
  email_code    VARCHAR(10)   NOT NULL DEFAULT '',
  description   VARCHAR(255)  NOT NULL DEFAULT '',
  email_type    ENUM('registration','password_reset','notice') NOT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rh_user (user_id),
  CONSTRAINT fk_rh_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE provider (
  user_id        BIGINT        NOT NULL AUTO_INCREMENT,
  name           VARCHAR(100)  NOT NULL,
  user_type      ENUM('pending','provider') NOT NULL DEFAULT 'provider',
  email          VARCHAR(255)  NOT NULL UNIQUE,
  password_hash  VARCHAR(255)  NOT NULL,
  description    VARCHAR(500)  NULL DEFAULT 'Empty',
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE provider_address (
  id            BIGINT        NOT NULL AUTO_INCREMENT,
  provider_id   BIGINT        NOT NULL,
  address       VARCHAR(255)  NOT NULL,
  city          VARCHAR(100)  NOT NULL,
  state         VARCHAR(100)  NOT NULL,
  postcode   VARCHAR(20)   NOT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_provider_address_provider (provider_id),
  CONSTRAINT fk_provider_address_provider
    FOREIGN KEY (provider_id)
    REFERENCES provider(user_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE P_Email_History (
  id      BIGINT        NOT NULL AUTO_INCREMENT,
  provider_id   BIGINT        NOT NULL,
  email_code    VARCHAR(10)   NOT NULL DEFAULT '',
  description   VARCHAR(255)  NOT NULL DEFAULT '',
  email_type    ENUM('registration','password_reset','notice') NOT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),

  KEY idx_prh_provider (provider_id),
  CONSTRAINT fk_prh_provider
    FOREIGN KEY (provider_id)
    REFERENCES provider(user_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE users_covid_status (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  user_id       BIGINT       NOT NULL,
  state_name    ENUM('Red','Yellow','Green') NOT NULL DEFAULT 'Green',
  contact_time  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_ucs_user (user_id, id),
  CONSTRAINT fk_ucs_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE providers_covid_status (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  provider_id   BIGINT       NOT NULL,
  state_name    ENUM('Red','Yellow','Green') NOT NULL DEFAULT 'Green',
  contact_time  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pcs_provider (provider_id, id),
  CONSTRAINT fk_pcs_provider
    FOREIGN KEY (provider_id) REFERENCES provider(user_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE product (
  product_id               BIGINT       NOT NULL AUTO_INCREMENT,
  name             VARCHAR(120) NOT NULL,
  price            DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  status          ENUM('available','out_of_stock') NOT NULL DEFAULT 'available',
  provider_id     BIGINT       NOT NULL,  -- -> provider.user_id
  PRIMARY KEY (product_id),

  KEY idx_product_provider (provider_id),
  CONSTRAINT fk_product_provider
    FOREIGN KEY (provider_id)
    REFERENCES provider (user_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  UNIQUE KEY uq_product_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE payment (
  payment_id       BIGINT        NOT NULL AUTO_INCREMENT,
  payment_method   ENUM('cash','card','paypal','apple_pay','google_pay') NOT NULL DEFAULT 'card',
  payment_status   ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  amount           DECIMAL(10,2) NULL,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (payment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE delivery_service (
  service_id           BIGINT       NOT NULL AUTO_INCREMENT,
  provider_id          BIGINT       NOT NULL,  -- -> provider.user_id
  customer_id          BIGINT       NOT NULL,  -- -> users.user_id
  payment_id           BIGINT       NULL,      -- -> payment.payment_id
  order_timestamp      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  description          VARCHAR(500) NULL,

  order_status         ENUM('ongoing','finished') NOT NULL DEFAULT 'ongoing',
  order_covid_status   ENUM('Red','Yellow','Green') NOT NULL DEFAULT 'Green',

  pickup_address       VARCHAR(255) NOT NULL,
  dropoff_address      VARCHAR(255) NOT NULL,

  PRIMARY KEY (service_id),

  KEY idx_delivery_provider (provider_id),
  KEY idx_delivery_customer (customer_id),
  KEY idx_delivery_payment  (payment_id),

  CONSTRAINT fk_delivery_provider
    FOREIGN KEY (provider_id)
    REFERENCES provider (user_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_delivery_customer
    FOREIGN KEY (customer_id)
    REFERENCES users (user_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_delivery_payment
    FOREIGN KEY (payment_id)
    REFERENCES payment (payment_id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_items (
  order_item_id BIGINT NOT NULL AUTO_INCREMENT,
  service_id    BIGINT NOT NULL,  -- -> delivery_service.service_id
  product_id    BIGINT NOT NULL,  -- -> product.id
  quantity      INT   NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (order_item_id),

  KEY idx_order_items_product (product_id),

  CONSTRAINT fk_order_items_product
    FOREIGN KEY (product_id)
    REFERENCES product (product_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_order_items_service
    FOREIGN KEY (service_id)
    REFERENCES delivery_service (service_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 插入初始数据
INSERT INTO users (name, user_type, email, password_hash)
VALUES
('Alice', 'customer', 'alice@example.com', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'), -- 123456
('Bob', 'customer', 'bob@example.com', '481f6cc0511143ccdd7e2d1b1b94faf0a700a8b49cd13922a70b5ae28acaa8c5'), -- 654321
('Dahao', 'customer', 'dahaomailp1@gmail.com', '91b4d142823f7d20c5f08df69122de43f35f057a988d9619f6d3138485c9a203'), -- 000000
('admin', 'admin', 'admin@example.com', '94edf28c6d6da38fd35d7ad53e485307f89fbeaf120485c8d17a43f323deee71'); -- 666666

INSERT INTO provider (name, email, password_hash, description)
VALUES
('P1 Fruit Store', 'P1@example.com', 'b2243c1fee3ff483edba6e8dd049b46674ee5beca80ef5ba4a3e72f1dd2c5102', 'All Amazing Fruit is avaliable here!'), -- 123456qQ
('Lilliam Cafe', 'P2@example.com', '91b4d142823f7d20c5f08df69122de43f35f057a988d9619f6d3138485c9a203', 'Premium pour-over and cold brew coffee, paired with freshly baked croissants, bagels and desserts.'), -- 000000'
('Spice Route Sichuan','P3@example.com', '91b4d142823f7d20c5f08df69122de43f35f057a988d9619f6d3138485c9a203', 'Authentic Sichuan flavors with customizable spice levels.'), -- 000000
('Nebula Burgers', 'P4@example.com', '91b4d142823f7d20c5f08df69122de43f35f057a988d9619f6d3138485c9a203', 'Smash burgers, fresh veggies, house-made sauces.'),        -- 000000
('Aurora Bakery', 'P5@example.com', '91b4d142823f7d20c5f08df69122de43f35f057a988d9619f6d3138485c9a203', 'Freshly baked breads, croissants, and seasonal pastries.'); -- 000000

INSERT INTO user_address (user_id, address, city, state, postcode)
VALUES
(1, '12 King St', 'Adelaide', 'SA', '5000'),
(2, '456 Market Rd', 'Adelaide', 'SA', '5000'),
(3, '78 River Ave', 'Adelaide', 'SA', '5000'),
(3, '996 River Ave', 'Adelaide', 'SA', '5000'),
(4, '99 Ocean Dr', 'Adelaide', 'SA', '5000');

INSERT INTO provider_address (provider_id, address, city, state, postcode)
VALUES
(1, '101 Orchard Rd', 'Adelaide', 'SA', '5000'),
(2, '202 Brew St', 'Adelaide', 'SA', '5000'),
(3, '303 Spice Ave', 'Adelaide', 'SA', '5000'),
(4, '404 Burger Ln', 'Adelaide', 'SA', '5000'),
(5, '505 Bakery Blvd', 'Adelaide', 'SA', '5000');

INSERT INTO users_covid_status (user_id, state_name, contact_time)
VALUES
(1, 'Yellow',   '2024-10-05 09:30:00'),
(1, 'Green',  '2025-10-06 14:00:00'),
(2, 'Red',   '2025-10-06 11:15:00'),
(3, 'Green',     '2025-10-07 08:45:00'),
(4, 'Green',  '2025-10-07 10:20:00');

INSERT INTO providers_covid_status (provider_id, state_name, contact_time)
VALUES
(1, 'Yellow',   '2023-10-05 09:00:00'),
(1, 'Green',  '2025-10-07 13:30:00'),
(2, 'Green',  '2025-10-07 13:30:00'),
(3, 'Green',  '2025-10-08 10:15:00'),
(3, 'Yellow', '2025-10-07 09:30:00'),
(4, 'Green',  '2025-10-08 11:20:00'),
(5, 'Yellow', '2025-10-07 15:45:00'),
(5, 'Green',  '2025-10-08 09:05:00');


INSERT INTO product (name, price, status, provider_id)
VALUES
-- P1 Fruit Store (provider_id = 1)
('Apple', 19.99, 'available', 1),
('Banana', 9.99, 'available', 1),
('Cherry', 14.99, 'out_of_stock', 1),
('Lemon', 99.99, 'available', 1),
-- Lilliam Cafe (provider_id = 2)
('American Coffee', 5.99, 'available', 2),
('Latte', 6.99, 'available', 2),
('Cappuccino', 7.99, 'available', 2),
('Espresso', 4.99, 'available', 2),
-- Spice Route Sichuan (provider_id = 3)
('Kung Pao Chicken', 16.90, 'available', 3),
('Mapo Tofu',       14.50, 'available', 3),
('Dan Dan Noodles', 12.00, 'available', 3),
-- Nebula Burgers (provider_id = 4)
('Classic Beef Burger', 12.90, 'available', 4),
('Double Cheese Burger',15.50, 'available', 4),
('Crispy Fries',         5.00, 'available', 4),
-- Aurora Bakery (provider_id = 5)
('Butter Croissant',   4.20, 'available', 5),
('Almond Croissant',   4.80, 'out_of_stock', 5),
('Blueberry Muffin',   4.50, 'available', 5),
('Plain Bagel',        3.20, 'available', 5);

INSERT INTO payment (payment_method, payment_status, amount)
VALUES
('card', 'paid', 39.97),
('paypal', 'pending', 99.99),
('card', 'paid', 99.99),
('card', 'paid', 59.40),
('cash', 'paid', 20.97);

INSERT INTO delivery_service (
  provider_id, customer_id, payment_id,
  order_timestamp, description, order_status,
  pickup_address, dropoff_address, order_covid_status
)
VALUES 
(1, 1, 1, NOW(), 'Delivering COVID safety kit', 'finished', 'HealthExpress Warehouse', 'Alice Home', 'Green'),
(1, 1, 3, NOW(), 'Delivering COVID safety kit 222','ongoing', 'HealthExpress Warehouse', 'Alice Home', 'Green'),
(1, 3, 2, NOW(), 'Delivering COVID safety kit','ongoing', 'HealthExpress Warehouse', 'admin Home', 'Red'),
(3, 3, 4, NOW(), 'Delivering spicy food', 'finished', '303 Spice Ave, Adelaide, SA, 5000', '996 River Ave, Adelaide, SA, 5000', 'Green'),
(2, 3, 5, NOW(), 'Delivering coffee food', 'finished', '202 Brew St, Adelaide, SA, 5000', '996 River Ave, Adelaide, SA, 5000', 'Red');
INSERT INTO order_items (service_id, product_id, quantity)
VALUES
(1, 1, 1),
(1, 2, 2),
(2, 2, 1),
(3, 4, 1),
(4, 9, 1),
(4, 10, 1),
(4, 11, 2),
(5, 5, 1),
(5, 6, 1),
(5, 7, 1);

