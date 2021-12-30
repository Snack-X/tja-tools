function parseLine(line) {
  const HEADER_GLOBAL = [
    'TITLE',
    'SUBTITLE',
    'BPM',
    'WAVE',
    'OFFSET',
    'DEMOSTART',
    'GENRE',
  ];

  const HEADER_COURSE = [
    'COURSE',
    'LEVEL',
    'BALLOON',
    'SCOREINIT',
    'SCOREDIFF',

    'TTROWBEAT',
  ];

  const COMMAND = [
    'START',
    'END',
    'GOGOSTART',
    'GOGOEND',
    'MEASURE',
    'SCROLL',
    'BPMCHANGE',
    'DELAY',
    'BRANCHSTART',
    'BRANCHEND',
    'SECTION',
    'N',
    'E',
    'M',
    'LEVELHOLD',
    'BMSCROLL',
    'HBSCROLL',
    'BARLINEOFF',
    'BARLINEON',

    'TTBREAK',
  ];

  let match;

  // comment
  if (match = line.match(/\/\/.*/))
    line = line.substr(0, match.index).trim();

  // header
  if (match = line.match(/^([A-Z]+):(.+)/i)) {
    const name = match[1],
          nameUpper = match[1].toUpperCase();
    const value = match[2];

    if (HEADER_GLOBAL.includes(nameUpper)) {
      return {
        type: 'header',
        scope: 'global',
        name: nameUpper,
        value: value.trim(),
      };
    }
    else if (HEADER_COURSE.includes(nameUpper)) {
      return {
        type: 'header',
        scope: 'course',
        name: nameUpper,
        value: value.trim(),
      };
    }
  }
  else if (match = line.match(/^#([A-Z]+)(?:\s+(.+))?/i)) {
    const name = match[1],
          nameUpper = match[1].toUpperCase();
    const value = match[2] || '';

    if (COMMAND.includes(nameUpper)) {
      return {
        type: 'command',
        name: nameUpper,
        value: value.trim(),
      };
    }
  }
  else if (match = line.match(/^([0-9]*,?)$/)) {
    const data = match[1];

    return {
      type: 'data',
      data: data,
    };
  }

  return {
    type: 'unknown',
    value: line,
  };
}

function getCourse(tjaHeaders, lines) {
  const headers = {
    course: 'Easy',
    level: 1,
    balloon: [],
    scoreInit: 100,
    scoreDiff: 100,

    ttRowBeat: 16,
  };

  const measures = [];

  // Process lines
  let measureDividend = 4, measureDivisor = 4;
  let measureProperties = {}, measureData = '', measureEvents = [];

  for (const line of lines) {
    if (line.type === 'header') {
      switch (line.name) {
        case 'COURSE':
          headers.course = line.value;
          break;

        case 'LEVEL':
          headers.level = parseInt(line.value, 10);
          break;

        case 'BALLOON':
          const balloons = line.value
            .split(/[^0-9]/)
            .filter(b => b !== '')
            .map(b => parseInt(b, 10));
          headers.balloon = balloons;
          break;

        case 'SCOREINIT':
          headers.scoreInit = parseInt(line.value, 10);
          break;

        case 'SCOREDIFF':
          headers.scoreDiff = parseInt(line.value, 10);
          break;

        case 'TTROWBEAT':
          headers.ttRowBeat = parseInt(line.value, 10);
      }
    }
    else if (line.type === 'command') {
      switch (line.name) {
        case 'MEASURE':
          let matchMeasure = line.value.match(/(\d+)\/(\d+)/);
          if (!matchMeasure) break;

          measureDividend = parseInt(matchMeasure[1], 10);
          measureDivisor = parseInt(matchMeasure[2], 10);
          break;

        case 'GOGOSTART':
          measureEvents.push({
            name: 'gogoStart',
            position: measureData.length,
          });
          break;

        case 'GOGOEND':
          measureEvents.push({
            name: 'gogoEnd',
            position: measureData.length,
          });
          break;

        case 'SCROLL':
          measureEvents.push({
            name: 'scroll',
            position: measureData.length,
            value: parseFloat(line.value),
          });
          break;

        case 'BPMCHANGE':
          measureEvents.push({
            name: 'bpm',
            position: measureData.length,
            value: parseFloat(line.value),
          });
          break;

        case 'TTBREAK':
          measureProperties['ttBreak'] = true;
          break;
      }
    }
    else if (line.type === 'data') {
      let data = line.data;

      if (data.endsWith(',')) {
        measureData += data.slice(0, -1);

        const measure = {
          length: [ measureDividend, measureDivisor ],
          properties: measureProperties,
          data: measureData,
          events: measureEvents,
        };

        measures.push(measure);
        measureData = '';
        measureEvents = [];
        measureProperties = {};
      }
      else measureData += data;
    }
  }

  if (measures.length) {
    // Make first BPM event
    let firstBPMEventFound = false;

    for (let i = 0 ; i < measures[0].events.length ; i++) {
      const evt = measures[0].events[i];

      if (evt.name === 'bpm' && evt.position === 0) {
        firstBPMEventFound = true;
        break;
      }
    }

    if (!firstBPMEventFound) {
      measures[0].events.unshift({
        name: 'bpm',
        position: 0,
        value: tjaHeaders.bpm,
      });
    }
  }

  // Helper values
  let course = 0;
  const courseValue = headers.course.toLowerCase();

  switch (courseValue) {
    case 'easy': case '0':
      course = 0;
      break;

    case 'normal': case '1':
      course = 1;
      break;

    case 'hard': case '2':
      course = 2;
      break;

    case 'oni': case '3':
      course = 3;
      break;

    case 'edit': case '4':
      course = 4;
      break;
  }

  // Output
  return { course, headers, measures };
}

export default function parseTJA(tja) {
  // Split by lines
  const lines = tja.split(/(\r\n|\r|\n)/)
    .map(line => line.trim());

  const headers = {
    title: '',
    subtitle: '',
    bpm: 120,
    wave: '',
    offset: 0,
    demoStart: 0,
    genre: '',
  };

  const courses = {};

  // Line by line
  let idx;
  let courseLines = [];

  for (idx = 0 ; idx < lines.length ; idx++) {
    const line = lines[idx];
    if (line === '') continue;

    const parsed = parseLine(line);

    if (parsed.type === 'header' && parsed.scope === 'global') {
      switch (parsed.name) {
        case 'TITLE':
          headers.title = parsed.value;
          break;

        case 'SUBTITLE':
          headers.subtitle = parsed.value;
          break;

        case 'BPM':
          headers.bpm = parseFloat(parsed.value);
          break;

        case 'WAVE':
          headers.wave = parsed.value;
          break;

        case 'OFFSET':
          headers.offset = parseFloat(parsed.value);
          break;

        case 'DEMOSTART':
          headers.demoStart = parseFloat(parsed.value);
          break;

        case 'GENRE':
          headers.genre = parsed.value;
          break;
      }
    }
    else if (parsed.type === 'header' && parsed.scope === 'course') {
      if (parsed.name === 'COURSE') {
        if (courseLines.length) {
          const course = getCourse(headers, courseLines);
          courses[course.course] = course;
          courseLines = [];
        }
      }

      courseLines.push(parsed);
    }
    else if (parsed.type === 'command') {
      courseLines.push(parsed);
    }
    else if (parsed.type === 'data') {
      courseLines.push(parsed);
    }
  }

  if (courseLines.length) {
    const course = getCourse(headers, courseLines);
    courses[course.course] = course;
  }

  // Return
  return { headers, courses };
}
