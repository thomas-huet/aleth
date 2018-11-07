"use strict";

const V = '1'; // cache version
const DELAY_MIN = 60*1000; // one minute
const K = 2;

const BASE_FILES = [
  '.',
  'main.js',
  'edit.html',
  'edit.js',
  'style.css',
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
  }
  card.edited = Date.now();
  card.reviewed = Date.now();
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
           data.get('answer'))
    ));
  } else if(event.request.url.match(/\/review-card$/)){
    event.respondWith(Response.redirect('.'));
    event.waitUntil(event.request.formData().then(data =>
      review(data.get('id'), parseInt(data.get('time')), data.has('correct'))
    ));
  } else if(event.request.url.match(/\/sync$/)){
    event.respondWith(new Response());
    event.waitUntil(event.request.json().then(synchronize));
  }
});

// ----- Synchronization -----

async function createFile(auth, name, content) {
  let metadata = new Blob([JSON.stringify({
    name: name,
    mimeType: 'application/json',
    parents: ['appDataFolder'],
  })], { type: 'application/json' });
  let file = new Blob([JSON.stringify(content)], { type: 'application/json' });
  let form = new FormData();
  form.append('metadata', metadata);
  form.append('file', file);
  let response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?' +
    'uploadType=multipart&' +
    'fields=id',
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + auth.access_token },
      body: form,
    });
  let id = (await response.json()).id;
  return id;
}

async function idByName(auth, name) {
  let response = await fetch(
    'https://www.googleapis.com/drive/v3/files?' +
    'spaces=appDataFolder&' +
    'q=name%3D%22' + name + '%22&' +
    'fields=files(id)',
    {
      headers: { Authorization: 'Bearer ' + auth.access_token },
    });
  let o = await response.json();
  let files = o.files;
  if (files.length >= 1) {
    return files[files.length - 1].id;
  }
  return undefined;
}

async function getFile(auth, id) {
  let response = await fetch(
    'https://www.googleapis.com/drive/v3/files/' +
    id +
    '?alt=media',
    {
      headers: { Authorization: 'Bearer ' + auth.access_token },
    });
  return response.json();
}

async function updateFile(auth, id, content) {
  let response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files/' +
    id +
    '?uploadType=media&' +
    'fields=id',
    {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + auth.access_token },
      body: JSON.stringify(content),
    });
  return response.json();
}

async function synchronize(auth) {
  console.log('synchronizing');
  let cards_id = await idByName(auth, 'cards.json');
  let synced = {};
  if (cards_id !== undefined) {
    synced = await getFile(auth, cards_id);
  } else {
    cards_id = await createFile(auth, 'cards.json', {});
  }
  console.log('synced = ', synced);
  let cache = await caches.open(V);
  let cards = await get(cache, 'cards.json');
  console.log('cards = ', cards);
  let changed = false;
  for (let id in cards) {
    if (!synced[id]) {
      changed = true;
      let data = await get(cache, 'card/' + id);
      let sync_id = await createFile(auth, id, data);
      cards[id].sync_id = sync_id;
      synced[id] = cards[id];
    } else if (cards[id].edited > synced[id].edited) {
      changed = true;
      let data = await get(cache, 'card/' + id);
      let sync_id = cards[id].sync_id || await idByName(auth, 'card/' + id);
      await updateFile(auth, sync_id, data);
      cards[id].sync_id = sync_id;
      synced[id] = cards[id];
    } else if (cards[id].reviewed > synced[id].reviewed) {
      changed = true;
      synced[id] = cards[id];
    }
  }
  for (let id in synced) {
    if (!cards[id] || synced[id].edited > cards[id].edited) {
      changed = true;
      let sync_id = synced[id].sync_id || await idByName(auth, 'card/' + id);
      let data = await getFile(auth, sync_id);
      await update(cache, 'card/' + id, data);
      cards[id] = synced[id];
    } else if (synced[id].reviewed > cards[id].reviewed) {
      changed = true;
      cards[id] = synced[id];
    }
  }
  if (changed) {
    console.log('change');
    await updateFile(auth, cards_id, synced);
    await update(cache, 'cards.json', synced);
    let channel = new BroadcastChannel('sync');
    channel.postMessage('change');
  } else {
    console.log('no change');
  }
  console.log('synchronization done');
}
