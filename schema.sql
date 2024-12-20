DROP TABLE IF EXISTS proxies;
CREATE TABLE proxies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    proxy_type TEXT NOT NULL,
    status INTEGER DEFAULT 0,
    download_speed REAL DEFAULT 0,
    last_available_time DATETIME DEFAULT CURRENT_TIMESTAMP
);