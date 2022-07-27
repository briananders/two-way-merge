#! /usr/bin/env node

const crypto = require('crypto');
const fs = require('fs-extra');
const glob = require('glob');
const path = require('path');
const { program } = require('commander');
const { utimesSync } = require('utimes');
const { error, log } = console;

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
      error(e);
      error({
        btime: Math.floor(sourceStats.birthtimeMs),
        mtime: Math.floor(sourceStats.mtimeMs),
        atime: Math.floor(sourceStats.atimeMs),
      });
      error(destinationPath);
    }
    // log(sourceStats);
  });
}

function copyConflicts(conflictList, dirs) {
  conflictList.forEach(shortName => {
    const fileA = path.normalize(dirs.a + shortName);
    const fileB = path.normalize(dirs.b + shortName);

    if (!fs.lstatSync(fileA).isDirectory() && getFileHash(fileA) === getFileHash(fileB)) {
      // log(`Hashes match:\n${fileA}\n${fileB}`);
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

function attemptDelete(dirA, dirB, deleteFileName) {
  const fileName = deleteFileName.replace(/\.delete$/, '');

  const fileA = dirA + fileName;
  const fileB = dirB + fileName;
  const deleteFileA = dirA + deleteFileName;
  const deleteFileB = dirB + deleteFileName;

  [fileA, fileB, deleteFileA, deleteFileB].forEach((file) => {
    if(fs.existsSync(file)) {
      fs.removeSync(file);
      log(`delete ${file}`);
    }
  })
}

function clean(dirA, dirB) {
  log(`delete ${dirA} <-> ${dirB}`);
  const dirs = {
    a: path.resolve(dirA),
    b: path.resolve(dirB),
  };
  const deleteDirFiles = {
    a: glob.sync(`${dirs.a}/**/*.delete`),
    b: glob.sync(`${dirs.b}/**/*.delete`),
  };
  const deleteDirFileNames = {
    a: deleteDirFiles.a.map((fileName) => fileName.substring(dirs.a.length)),
    b: deleteDirFiles.b.map((fileName) => fileName.substring(dirs.b.length))
  }

  const fileNames = [...deleteDirFileNames.a, ...deleteDirFileNames.b];

  fileNames.forEach((file) => {
    attemptDelete(dirA, dirB, file);
  });

}

function merge(dirA, dirB) {
  clean(dirA, dirB);

  log(`syncing ${dirA} <-> ${dirB}`);

  const dirs = {
    a: path.resolve(dirA),
    b: path.resolve(dirB),
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

  // log(nonConflictsA, nonConflictsB, conflicts);
  log('Done');
}

program
    .command('merge <dirA> <dirB>')
    .description('Syncs two directories to have the same contents')
    .action(merge);


program.parse()
