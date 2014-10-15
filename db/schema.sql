drop database crowdictionary;
create database crowdictionary;

USE crowdictionary;

CREATE TABLE `phrase` (
    `id` int AUTO_INCREMENT NOT NULL,
    `lang` varchar(32) NOT NULL,
    `contributor_id` int NOT NULL,
    `phrase` varchar(64) NOT NULL,
    `created` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated` TIMESTAMP DEFAULT 0 ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE INDEX (`lang`, `phrase`),
    INDEX(`contributor_id`)
);

CREATE TABLE `definition` (
    `id` int AUTO_INCREMENT NOT NULL,
    `lang` varchar(32) NOT NULL,
    `phrase_id` int NOT NULL,
    `contributor_id` int NOT NULL,
    `definition` varchar(2048) NOT NULL,
    `examples` varchar(2048) NOT NULL,
    `tags` varchar(256) NOT NULL,
    `created` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated` TIMESTAMP DEFAULT 0 ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE INDEX (`lang`, `phrase_id`, `contributor_id`),
    INDEX (`phrase_id`),
    INDEX (`contributor_id`)
);

CREATE TABLE `vote` (
    `id` int AUTO_INCREMENT NOT NULL,
    `definition_id` int NOT NULL,
    `contributor_id` int NOT NULL,
    `vote` enum('up', 'down', 'neutral'),
    `created` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated` TIMESTAMP DEFAULT 0 ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE INDEX (`definition_id`, `contributor_id`),
    INDEX (`definition_id`),
    INDEX (`contributor_id`)
);

CREATE TABLE `contributor` (
    `id` int AUTO_INCREMENT NOT NULL,
    `status` enum('new', 'pendingVerification', 'active', 'suspended', 'admin') NOT NULL DEFAULT 'new',
    `preferred_langs` varchar(2048) NOT NULL DEFAULT '',
    `first_name` varchar(32) NOT NULL DEFAULT '',
    `last_name` varchar(32) NOT NULL DEFAULT '',
    `nickname` varchar(32) NOT NULL,
    `email` varchar(64) NOT NULL,
    `verified` enum('yes', 'no') NOT NULL DEFAULT 'no',
    `verification_code` varchar(16) NOT NULL,
    `password_reset_code` varchar(16) NOT NULL DEFAULT '',
    `password_reset_status` enum('not_requested', 'requested', 'emailed') NOT NULL DEFAULT 'not_requested',
    `verification_retries` int NOT NULL DEFAULT 0,
    `passhash` varchar(128) NOT NULL,
    `created` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated` TIMESTAMP DEFAULT 0 ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE INDEX (`email`),
    UNIQUE INDEX (`nickname`)
);

CREATE TABLE `notification` (
    `id` int AUTO_INCREMENT NOT NULL,
    `type` enum('email') NOT NULL,
    `recipient` varchar(64) NOT NULL,
    `contributor_id` int NOT NULL,
    `scheduled` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `sent` TIMESTAMP,
    `send_status_received` TIMESTAMP,
    `send_status` varchar(2048),
    PRIMARY KEY (`id`),
    UNIQUE INDEX (`contributor_id`)
);
