drop database crowdictionary;
create database crowdictionary;

USE crowdictionary;

CREATE TABLE `phrase` (
    `id` int AUTO_INCREMENT NOT NULL,
    `lang` varchar(32) NOT NULL,
    `contributor_id` int NOT NULL,
    `phrase` varchar(64) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX (`lang`, `phrase`),
    INDEX(`contributor_id`)
);

CREATE TABLE `translation` (
    `id` int AUTO_INCREMENT NOT NULL,
    `lang` varchar(32) NOT NULL,
    `phrase_id` int NOT NULL,
    `contributor_id` int NOT NULL,
    `definition` varchar(2048) NOT NULL,
    PRIMARY KEY (`id`),
    INDEX (`phrase_id`),
    INDEX (`contributor_id`)
);

CREATE TABLE `vote` (
    `id` int AUTO_INCREMENT NOT NULL,
    `translation_id` int NOT NULL,
    `contributor_id` int NOT NULL,
    `vote` enum('up', 'down', 'neutral'),
    PRIMARY KEY (`id`),
    INDEX (`translation_id`),
    INDEX (`contributor_id`)
);

CREATE TABLE `contributor` (
    `id` int AUTO_INCREMENT NOT NULL,
    `preferred_langs` varchar(2048) NOT NULL,
    `first_name` varchar(32),
    `last_name` varchar(32),
    `email` varchar(64),
    PRIMARY KEY (`id`),
    UNIQUE INDEX (`email`)
);
