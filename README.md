# discord-count-channels

Package to make counts in discord

## Installation

```bash
yarn install discord-count-channels
npm install discord-count-channels
pnpm install discord-count-channels
```

## Usage

You can use it with **MySQL** or **JSON**, like so

### MySQL

```javascript
const { Counter } = require('discord-count-channels');
const { createConnection } = require('mysql');
const { Client } = require('discord.js');

const client = new Client();
//...

const counter = new Counter(client, { 
    type: 'mysql',
    connection: createConnection({
        //...
    })
}, {
    // configs
});

counter.start()
```

### JSON

```javascript
const { Counter } = require('discord-count-channels');
const { createConnection } = require('mysql');
const { Client } = require('discord.js');

const client = new Client();
//...

const counter = new Counter(client, { 
    type: 'json',
    pathFile: './storage/counters.json'
}, {
    // configs
});

counter.start()
```
