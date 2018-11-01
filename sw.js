const V = '1'; // cache version
//const DELAY_MIN = 60*1000; // one minute
const DELAY_MIN = 1000;
const K = 2;

async function mem(cache, key) {
  return ((await cache.match(key)) !== undefined);
}

async function get(cache, key) {
  return (await cache.match(key)).json();
}

function update(cache, key, value) {
  return cache.put(key, new Response(JSON.stringify(value)));
}

self.addEventListener('install', event => {
  console.log('installing service worker');
  event.waitUntil(init().then(self.skipWaiting));
});

async function init() {
  let cache = await caches.open(V);
  await cache.addAll([
    '.',
    'main.js',
    'edit.html',
    'edit.js',
  ]);
  if (!(await mem(cache, 'cards.json'))) {
    await update(cache, 'cards.json', {});
  }
}

self.addEventListener('activate', event => {
  console.log('activating service worker');
  event.waitUntil(self.clients.claim());
});

async function getResponse(request) {
  let cache = await caches.open(V);
  let cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  if (request.url.match(/cards\.json$/)) {
    await update(cache, 'cards.json', {});
    return new Response('{}');
  }
  let response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function edit(id, question, answer) {
  console.log('editing ' + id);
  let cache = await caches.open(V);
  let cards = await get(cache, 'cards.json');
  let card = cards[id];
  if (!card) {
    card = {};
    card.due = Date.now() + DELAY_MIN;
    card.delay = DELAY_MIN;
    cards[id] = card;
    await update(cache, 'cards.json', cards);
  }
  await update(cache, 'card/' + id, {question: question, answer: answer});
}

async function review(id, time, correct) {
  console.log('reviewing ' + id);
  let cache = await caches.open(V);
  let cards = await get(cache, 'cards.json');
  let card = cards[id];
  if (correct) {
    card.delay = K * (card.delay + (time - card.due));
  } else {
    card.delay = Math.max(card.delay / K, DELAY_MIN);
  }
  card.due = time + card.delay;
  cards[id] = card;
  await update(cache, 'cards.json', cards);
}

self.addEventListener('fetch', event => {
  if (event.request.method === 'GET') {
    console.log('GET ' + event.request.url);
    event.respondWith(getResponse(event.request));
  } else if (event.request.url.match(/\/edit-card$/)) {
    event.respondWith(Response.redirect('.'));
    event.waitUntil(event.request.formData().then(data =>
      edit(data.get('id') || Date.now(), data.get('question'), data.get('answer'))
    ));
  } else if(event.request.url.match(/\/review-card$/)){
    event.respondWith(Response.redirect('.'));
    event.waitUntil(event.request.formData().then(data =>
      review(data.get('id'), parseInt(data.get('time')), data.has('correct'))
    ));
  }
});
