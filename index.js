#! /usr/bin/env node

const crypto = require('crypto');
const fs = require('fs-extra');
const glob = require('glob');
const path = require('path');
const { program } = require('commander');
const { utimesSync } = require('utimes');

function findConflicts(dirs, dirFiles) {
  const dirFilesA = dirFiles.a.map(fileName => fileName.substring(dirs.a.length));
  const dirFilesB = dirFiles.b.map(fileName => fileName.substring(dirs.b.length));

  const aConflicts = dirFilesA.filter(fileName => dirFilesB.includes(fileName));
  const bConflicts = dirFilesB.filter(fileName => dirFilesA.includes(fileName));

  return [... new Set([...aConflicts, ...bConflicts])];
}

function findNonConflicts(dirFiles, prefix, conflicts) {
  return dirFiles.filter(fileName => {
    const shortName = fileName.substring(prefix.length);
    return !conflicts.includes(shortName);
  });
}

function getFileHash(fileName) {
  const fileBuffer = fs.readFileSync(fileName);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  const hex = hashSum.digest('hex');
  return hex;
}

function copyTo(filesList, source, destination) {
  filesList.forEach(fileName => {
    if (fs.lstatSync(fileName).isDirectory()) return;

    const shortPath = fileName.substring(source.length);
    const destinationPath = path.normalize(destination + shortPath);
    const sourceStats = fs.statSync(fileName);
    fs.mkdirpSync(path.normalize(destination + path.dirname(shortPath)));
    fs.copyFileSync(fileName, destinationPath);
    try {
      utimesSync(destinationPath, {
        btime: Math.floor(sourceStats.birthtimeMs),
        mtime: Math.floor(sourceStats.mtimeMs),
        atime: Math.floor(sourceStats.atimeMs),
      });
    } catch(e) {
      console.error(e);
      console.error({
        btime: Math.floor(sourceStats.birthtimeMs),
        mtime: Math.floor(sourceStats.mtimeMs),
        atime: Math.floor(sourceStats.atimeMs),
      });
      console.error(destinationPath);
    }
    // console.log(sourceStats);
  });
}

function copyConflicts(conflictList, dirs) {
  conflictList.forEach(shortName => {
    const fileA = path.normalize(dirs.a + shortName);
    const fileB = path.normalize(dirs.b + shortName);

    if (getFileHash(fileA) === getFileHash(fileB)) {
      // console.log(`Hashes match:\n${fileA}\n${fileB}`);
      return;
    }

    const statsA = fs.statSync(fileA);
    const statsB = fs.statSync(fileB);

    const aDate = new Date(statsA.mtime);
    const bDate = new Date(statsB.mtime);

    if (aDate > bDate) {
      // fs.rmSync(fileB);
      copyTo([fileA], dirs.a, dirs.b);
    } else if (aDate < bDate) {
      // fs.rmSync(fileA);
      copyTo([fileB], dirs.b, dirs.a);
    }
  });
}

function sync(dir1, dir2) {
console.log(`syncing ${dir1} <-> ${dir2}`);
  const dirs = {
    a: path.resolve(dir1),
    b: path.resolve(dir2),
  };
  const dirFiles = {
    a: glob.sync(`${dirs.a}/**/*`),
    b: glob.sync(`${dirs.b}/**/*`),
  };

  const conflicts = findConflicts(dirs, dirFiles);
  const nonConflictsA = findNonConflicts(dirFiles.a, dirs.a, conflicts);
  const nonConflictsB = findNonConflicts(dirFiles.b, dirs.b, conflicts);

  copyTo(nonConflictsA, dirs.a, dirs.b);
  copyTo(nonConflictsB, dirs.b, dirs.a);
  copyConflicts(conflicts, dirs);

  // console.log(nonConflictsA, nonConflictsB, conflicts);
  console.log('Done');
}

program
    .command('merge <dir1> <dir2>')
    .description('Syncs two directories to have the same contents')
    .action(sync);


program.parse()