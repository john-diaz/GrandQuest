const migration = `
INSERT INTO forums (title) VALUES ('grandquest');
INSERT INTO forums (title) VALUES ('art');

INSERT INTO boards (id, title, forum_title, admin_managed) VALUES (1, 'Announcements', 'Grandquest', TRUE);
INSERT INTO boards (id, title, forum_title) VALUES (2, 'Bug Reporting', 'Grandquest');
INSERT INTO boards (id, title, forum_title) VALUES (3, 'Music', 'art');
`