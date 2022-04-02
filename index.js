#! /usr/bin/env node

const { program } = require('commander');

const sync = require('./sync');

program
    .command('merge <dir1> <dir2>')
    .description('Syncs two directories to have the same contents')
    .action(sync);


program.parse()