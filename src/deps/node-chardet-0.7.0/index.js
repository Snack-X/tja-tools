
var utf8    = require('./encoding/utf8');
// var unicode = require('./encoding/unicode');
var mbcs    = require('./encoding/mbcs');
// var sbcs    = require('./encoding/sbcs');
// var iso2022 = require('./encoding/iso2022');

var self = this;

var recognisers = [
  new utf8,
  // new unicode.UTF_16BE,
  // new unicode.UTF_16LE,
  // new unicode.UTF_32BE,
  // new unicode.UTF_32LE,
  new mbcs.sjis,
  // new mbcs.big5,
  new mbcs.euc_jp,
  new mbcs.euc_kr,
  // new mbcs.gb_18030,
  // new iso2022.ISO_2022_JP,
  // new iso2022.ISO_2022_KR,
  // new iso2022.ISO_2022_CN,
  // new sbcs.ISO_8859_1,
  // new sbcs.ISO_8859_2,
  // new sbcs.ISO_8859_5,
  // new sbcs.ISO_8859_6,
  // new sbcs.ISO_8859_7,
  // new sbcs.ISO_8859_8,
  // new sbcs.ISO_8859_9,
  // new sbcs.windows_1251,
  // new sbcs.windows_1256,
  // new sbcs.KOI8_R
];

module.exports.detect = function(buffer, opts) {

  // Tally up the byte occurence statistics.
  var fByteStats = [];
  for (var i = 0; i < 256; i++)
    fByteStats[i] = 0;

  for (var i = buffer.length - 1; i >= 0; i--)
    fByteStats[buffer[i] & 0x00ff]++;

  var fC1Bytes = false;
  for (var i = 0x80; i <= 0x9F; i += 1) {
    if (fByteStats[i] != 0) {
      fC1Bytes = true;
      break;
    }
  }

  var context = {
    fByteStats:  fByteStats,
    fC1Bytes:    fC1Bytes,
    fRawInput:   buffer,
    fRawLength:  buffer.length,
    fInputBytes: buffer,
    fInputLen:   buffer.length
  };

  var matches = recognisers.map(function(rec) {
    return rec.match(context);
  }).filter(function(match) {
    return !!match;
  }).sort(function(a, b) {
    return b.confidence - a.confidence;
  });

  if (opts && opts.returnAllMatches === true) {
    return matches;
  }
  else {
    return matches.length > 0 ? matches[0].name : null;
  }
};

// Wrappers for the previous functions to return all encodings
module.exports.detectAll = function(buffer, opts) {
  if (typeof opts !== 'object') {
    opts = {};
  }
  opts.returnAllMatches = true;
  return self.detect(buffer, opts);
}
