SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS delivery_service;
DROP TABLE IF EXISTS provider;
DROP TABLE IF EXISTS providers_covid_status;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS users_covid_status;
DROP TABLE IF EXISTS payment;
DROP TABLE IF EXISTS product;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  user_id        BIGINT        NOT NULL AUTO_INCREMENT,
  name           VARCHAR(100)  NOT NULL,
  user_type      ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  email          VARCHAR(255)  NOT NULL UNIQUE,
  password_hash  VARCHAR(255)  NOT NULL,
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE provider (
  user_id        BIGINT        NOT NULL AUTO_INCREMENT,
  name           VARCHAR(100)  NOT NULL,
  address        VARCHAR(255)  NOT NULL,
  email          VARCHAR(255)  NOT NULL UNIQUE,
  password_hash  VARCHAR(255)  NOT NULL,
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE users_covid_status (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  user_id       BIGINT       NOT NULL,
  state_name    ENUM('Red','Yellow','Green') NOT NULL,
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
  state_name    ENUM('Red','Yellow','Green') NOT NULL,
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
  PRIMARY KEY (product_id),
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
('admin', 'admin', 'admin@example.com', '94edf28c6d6da38fd35d7ad53e485307f89fbeaf120485c8d17a43f323deee71'); -- 666666

INSERT INTO provider (name, address, email, password_hash)
VALUES
('P1', '123 Provider Road', 'P1@example.com', '91b4d142823f7d20c5f08df69122de43f35f057a988d9619f6d3138485c9a203'); -- 000000

INSERT INTO users_covid_status (user_id, state_name, contact_time)
VALUES
(1, 'Yellow',   '2024-10-05 09:30:00'),
(1, 'Green',  '2025-10-06 14:00:00'),
(2, 'Red',   '2025-10-06 11:15:00'),
(3, 'Green',     '2025-10-07 08:45:00');

INSERT INTO providers_covid_status (provider_id, state_name, contact_time)
VALUES
(1, 'Yellow',   '2023-10-05 09:00:00'),
(1, 'Green',  '2025-10-07 13:30:00');


INSERT INTO product (name, price, status)
VALUES
('Apple', 19.99, 'available'),
('Banana', 9.99, 'available'),
('Cherry', 14.99, 'out_of_stock'),
('Lemon', 99.99, 'available');

INSERT INTO payment (payment_method, payment_status, amount)
VALUES
('card', 'paid', 39.97),
('paypal', 'pending', 9.99),
('card', 'paid', 99.99);

INSERT INTO delivery_service (
  provider_id, customer_id, payment_id,
  order_timestamp, description, order_status,
  pickup_address, dropoff_address
)
VALUES 
(1, 1, 1, NOW(), 'Delivering COVID safety kit', 'finished', 'HealthExpress Warehouse', 'Alice Home' ),
(1, 1, 3, NOW(), 'Delivering COVID safety kit 222','ongoing', 'HealthExpress Warehouse', 'Alice Home' ),
(1, 3, 2, NOW(), 'Delivering COVID safety kit','ongoing', 'HealthExpress Warehouse', 'admin Home' );

INSERT INTO order_items (service_id, product_id, quantity)
VALUES
(1, 1, 1),
(1, 2, 2),
(2, 2, 1),
(3, 4, 1);