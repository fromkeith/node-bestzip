// creates a zip file using either the native `zip` command if avaliable,
// or a node.js zip implimentation otherwise.
//
// currently only supports zipping a single sources file/dir

var cp = require('child_process');
var fs = require('fs');
var pathUtil = require('path');

var archiver = require('archiver');
var async = require('async');

var NATIVE = 'native';
var NODE = 'node';

var _which = null;

function which(done){
    if (_which) {
        return process.nextTick(done.bind(null, null, _which));
    } else {
        cp.exec('which zip', function(err, path) {
            // this may error on systems where "which" isn't a command. in that case, just use the node zip.
            if (!err && path) {
                _which = NATIVE;
            } else {
                _which = NODE;
            }
            done(null, _which);
        });
    }
}


function nativeZip(dest, source, done) {
    console.log('using native')
    var args = ['--quiet', '--recurse-paths', dest].concat(source);
    cp.spawn('zip', args)
		.on('close', function (code) {
            if (code !== 0) {
				done(new Error("Exited with code: " + 1));
				return;
 			}
			done();
        });
}

// based on http://stackoverflow.com/questions/15641243/need-to-zip-an-entire-directory-using-node-js/18775083#18775083
function nodeZip(dest, sources, done) {
    console.log('using regular');
    var output = fs.createWriteStream(dest);
    var archive = archiver('zip');

    output.on('close', done);
    archive.on('error', done);

    archive.pipe(output);

    async.forEach(sources, function(source, next) {
        var zipDest = source;// this "dest" is the filename inside of the zip
        var basename = pathUtil.basename(source);
        if (basename == '*') {
            source = source.substr(0, source.length-1);
            zipDest = '/';
        }
        fs.stat(source, function(err, stats) {
            if (err) {
                return next(err);
            }
            if (stats.isDirectory()) {
                archive.bulk([
                    {expand: true, cwd: source, src: ['**'], dest: zipDest}
                ]);
            } else if (stats.isFile()) {
                archive.file(source, {name: basename, stats: stats});
            }
            next();
        });
    }, function(err) {
        if (err) {
            return done(err);
        }
        archive.finalize();
    })
}

function zip(dest, sources, done) {
    if (!Array.isArray(sources)) {
        sources = [sources]
    }
    which(function(err, which) {
        if (err) {
            done(err);
			return;        
		}
        if (which == NATIVE) {
            nativeZip(dest, sources, done);
        } else {
            nodeZip(dest, sources, done);
        }
    });
}


module.exports = zip;
module.exports.zip = zip;
module.exports.nodeZip = nodeZip;
module.exports.nativeZip = nativeZip;
module.exports.bestzip = zip;
