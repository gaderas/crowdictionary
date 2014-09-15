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
    `status` enum('pendingVerification', 'active', 'suspended', 'admin') NOT NULL DEFAULT 'pendingVerification',
    `preferred_langs` varchar(2048) NOT NULL,
    `first_name` varchar(32) NOT NULL,
    `last_name` varchar(32) NOT NULL,
    `nickname` varchar(32) NOT NULL,
    `email` varchar(64) NOT NULL,
    `verified` enum('yes', 'no') NOT NULL DEFAULT 'no',
    `verification_code` varchar(16) NOT NULL,
    `verification_retries` int NOT NULL,
    `passhash` varchar(128) NOT NULL,
    `created` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated` TIMESTAMP DEFAULT 0 ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE INDEX (`email`)
);
