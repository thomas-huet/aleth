"use strict";

const V = '1'; // cache version
const DELAY_MIN = 60*1000; // one minute
const K = 2;

const BASE_FILES = [
  '.',
  'main.js',
  'edit.html',
  'edit.js',
  'sync.js',
];

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
  await cache.addAll(BASE_FILES);
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
  console.log('Not in cache');
  if (request.url.match(/cards\.json$/)) {
    await update(cache, 'cards.json', {});
    return new Response('{}');
  }
  let response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  else { console.log('Request failed: ' + response.status); }
  return response;
}

async function edit(id, question, answer, time, sync_id) {
  console.log('editing ' + id);
  let cache = await caches.open(V);
  let cards = await get(cache, 'cards.json');
  let card = cards[id];
  if (!card) {
    card = {};
    card.due = Date.now() + DELAY_MIN;
    card.delay = DELAY_MIN;
  }
  card.edited = time;
  if (sync_id) {
    cards.sync_id = sync_id;
  }
  cards[id] = card;
  await update(cache, 'cards.json', cards);
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
  card.reviewed = Date.now();
  cards[id] = card;
  await update(cache, 'cards.json', cards);
}

async function merge(synced) {
  console.log('merging');
  let cache = await caches.open(V);
  let cards = await get(cache, 'cards.json');
  let updated = {};
  for (let id in cards) {
    if (!synced[id] ||
        cards[id].edited > synced[id].edited ||
        cards[id].reviewed > synced[id].reviewed) {
      updated[id] = cards[id];
    }
  }
  let to_edit = [];
  for (let id in synced) {
    if (!cards[id] || synced[id].edited > cards[id].edited) {
      cards[id] = synced[id];
      to_edit.push(id);
    } else if (synced[id].reviewed > cards[id].reviewed) {
      cards[id] = synced[id];
    }
  }
  await update(cache, 'cards.json', cards);
  return {
    updated: updated,
    toEdit: to_edit,
  };
}

self.addEventListener('fetch', event => {
  let url = new URL(event.request.url);
  if (url.host === 'apis.google.com' ||
      url.host === 'csi.gstatic.com') {
    return;
  }
  if (event.request.method === 'GET') {
    console.log('GET ' + event.request.url);
    event.respondWith(getResponse(event.request));
  } else if (event.request.url.match(/\/edit-card$/)) {
    event.respondWith(Response.redirect('.'));
    event.waitUntil(event.request.formData().then(data =>
      edit(data.get('id') || Date.now(),
           data.get('question'),
           data.get('answer'),
           data.get('edited') || Date.now(),
           data.get('sync_id'))
    ));
  } else if(event.request.url.match(/\/review-card$/)){
    event.respondWith(Response.redirect('.'));
    event.waitUntil(event.request.formData().then(data =>
      review(data.get('id'), parseInt(data.get('time')), data.has('correct'))
    ));
  } else if(event.request.url.match(/\/merge-cards$/)){
    event.respondWith(
      event.request.json()
        .then(merge)
        .then(value => new Response(JSON.stringify(value))));
  }
});
