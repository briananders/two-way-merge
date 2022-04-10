# two-way-merge

This merge tool simply merges two directories into each other. When there is a conflict, the merge takes the file with the later modified date.

## Installation

`npm i -g @briananders/two-way-merge`
## Usage

`twowaymerge merge path/to/directory path/to/another/directory`

In a crontab chron job, you have to link absolutely as your PATH is empty.

DO NOT DO THIS: `twowaymerge merge "~/Google Drive/configs" "~/configs"`

Do this: `/Users/briananders/.nvm/versions/node/v17.5.0/bin/node /opt/homebrew/lib/node_modules/@briananders/two-way-merge/index.js merge "/Users/briananders/Google Drive/configs" "/Users/briananders/configs"`

## Dev Setup

1. Clone the repo
2. Install dependencies `npm i`
3. Globally install the module `npm i -g`