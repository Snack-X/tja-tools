function pulseToTime(events, objects) {
  let bpm = 120;
  let passedBeat = 0, passedTime = 0;
  let eidx = 0, oidx = 0;

  let times = [];

  while (oidx < objects.length) {
    let event = events[eidx], objBeat = objects[oidx];

    while (event && event.beat <= objBeat) {
      if (event.type === 'bpm') {
        let beat = event.beat - passedBeat;
        let time = 60 / bpm * beat;

        passedBeat += beat;
        passedTime += time;
        bpm = event.value;
      }

      eidx++;
      event = events[eidx];
    }

    let beat = objBeat - passedBeat;
    let time = 60 / bpm * beat;
    times.push(passedTime + time);

    passedBeat += beat;
    passedTime += time;
    oidx++;
  }

  return times;
}

function convertToTimed(course) {
  const events = [], notes = [];
  let beat = 0, balloon = 0;

  for (let m = 0 ; m < course.measures.length ; m++) {
    const measure = course.measures[m];
    const length = measure.length[0] / measure.length[1] * 4;

    for (let e = 0 ; e < measure.events.length ; e++) {
      const event = measure.events[e];
      const eBeat = length / (measure.data.length || 1) * event.position;

      if (event.name === 'bpm') {
        events.push({
          type: 'bpm',
          value: event.value,
          beat: beat + eBeat,
        });
      }
    }

    for (let d = 0 ; d < measure.data.length ; d++) {
      const ch = measure.data.charAt(d);
      const nBeat = length / measure.data.length * d;

      let note = { type: '', beat: beat + nBeat };

      switch (ch) {
        case '1':
          note.type = 'don';
          break;
        case '2':
          note.type = 'kat';
          break;
        case '3':
          note.type = 'donBig';
          break;
        case '4':
          note.type = 'katBig';
          break;
        case '5':
          note.type = 'renda';
          break;
        case '6':
          note.type = 'rendaBig';
          break;
        case '7': case '9':
          note.type = 'balloon';
          note.count = course.headers.balloon[balloon++];
          break;
        case '8':
          note.type = 'end';
          break;
      }

      if (note.type) notes.push(note);
    }

    beat += length;
  }

  const times = pulseToTime(events, notes.map(n => n.beat));
  times.forEach((t, idx) => { notes[idx].time = t; });

  return { events, notes };
}

function getStatistics(course) {
  // total combo, don-kat ratio, average notes per second
  // renda length, balloon speed

  const notes = [ 0, 0, 0, 0 ], rendas = [], balloons = [];
  let start = 0, end = 0, combo = 0;
  let rendaStart = false, balloonStart = false, balloonCount = 0;

  const typeNote = [ 'don', 'kat', 'donBig', 'katBig' ];

  for (let i = 0 ; i < course.notes.length ; i++) {
    const note = course.notes[i];

    const v1 = typeNote.indexOf(note.type);
    if (v1 !== -1) {
      if (i === 0) start = note.time;
      end = note.time;

      notes[v1] += 1;
      combo += 1;

      continue;
    }

    if (note.type === 'renda' || note.type === 'rendaBig') {
      rendaStart = note.time;
      continue;
    }
    else if (note.type === 'balloon') {
      balloonStart = note.time;
      balloonCount = note.count;
      continue;
    }
    else if (note.type === 'end') {
      if (rendaStart) {
        rendas.push(note.time - rendaStart);
        rendaStart = false;
      }
      else if (balloonStart) {
        balloons.push([ note.time - balloonStart, balloonCount ]);
        balloonStart = false;
      }
    }
  }

  return {
    totalCombo: combo,
    notes: notes,
    length: end - start,
    rendas: rendas,
    balloons: balloons,
  };
}

function getGraph(course) {
  const data = [];
  let datum = { don: 0, kat: 0 }, max = 0;

  const dataCount = 100,
        length = course.notes[course.notes.length - 1].time,
        timeframe = length / dataCount;

  const typeNote = [ 'don', 'kat', 'donBig', 'katBig' ];

  for (let i = 0 ; i < course.notes.length ; i++) {
    const note = course.notes[i];

    const v1 = typeNote.indexOf(note.type);
    if (v1 !== -1) {
      while((data.length + 1) * timeframe <= note.time) {
        const sum = datum.don + datum.kat;
        if (max < sum) max = sum;

        data.push(datum);
        datum = { don: 0, kat: 0 };
      }

      if (note.type === 'don' || note.type === 'donBig') datum.don += 1;
      else if (note.type === 'kat' || note.type === 'katBig') datum.kat += 1;
    }
  }

  while(data.length < dataCount)
    data.push({ don: 0, kat: 0 });

  return { timeframe, max, data };
}

export default function (chart, courseId) {
  const course = chart.courses[courseId];
  const converted = convertToTimed(course);

  const statistics = getStatistics(converted);
  const graph = getGraph(converted);

  return { statistics, graph };
}
