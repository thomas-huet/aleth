"use strict";

const V = '1'; // cache version
const DELAY_MIN = 60; // one minute
const K = 2;
const DURATION_TO_CACHE = 7 * 24 * 60 * 60; // one week

function now() {
  return Math.floor(Date.now() / 1000);
}

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
  let url = new URL(request.url);
  url.search = '';
  let cache = await caches.open(V);
  let cached = await cache.match(url.href);
  if (cached) {
    return cached;
  }
  if (url.href.match(/cards\.json$/)) {
    await update(cache, 'cards.json', {s: 0});
    return new Response('{"s":0}');
  }
  console.log(url.href + ' not in cache');
  let response = await fetch(url.href);
  if (response.ok) {
    cache.put(url.href, response.clone());
  }
  return response;
}

async function edit(id, question, answer) {
  console.log('editing ' + id);
  let cache = await caches.open(V);
  let cards = await get(cache, 'cards.json');
  let card = cards[id];
  let t = now();
  if (!card) {
    card = {
      d: t + DELAY_MIN,
      i: DELAY_MIN,
    };
  }
  card.e = t;
  card.r = t;
  cards[id] = card;
  await update(cache, 'cards.json', cards);
  await update(cache, 'card/' + id, {q: question, a: answer});
  return Response.redirect('.');
}

async function review(id, time, correct) {
  console.log('reviewing ' + id);
  let cache = await caches.open(V);
  let cards = await get(cache, 'cards.json');
  let card = cards[id];
  if (correct) {
    if (time < card.d) { // ignore early reviews
      return Response.redirect('.');
    }
    card.i = K * (card.i + (time - card.d));
    card.d = now() + card.i;
  } else {
    card.i = Math.max(Math.floor(card.i) / K, DELAY_MIN);
    card.d = now() + DELAY_MIN;
  }
  card.r = now();
  cards[id] = card;
  await update(cache, 'cards.json', cards);
  return Response.redirect('.');
}

async function deleteCard(id) {
  console.log('deleting ' + id);
  let cache = await caches.open(V);
  let cards = await get(cache, 'cards.json');
  let card = cards[id];
  card.to_delete = true;
  await update(cache, 'cards.json', cards);
  await cache.delete('card/' + id);
  return Response.redirect('.');
}

async function reset() {
  console.log('resetting cache');
  await caches.delete(V);
  await init();
  return Response.redirect('.?logout');
}

self.addEventListener('fetch', event => {
  let url = new URL(event.request.url);
  if (url.host === 'apis.google.com' ||
      url.host === 'csi.gstatic.com') {
    console.log(url.host);
    return;
  }
  if(event.request.url.match(/\/reset$/)){
    event.respondWith(reset());
  } else if (event.request.method === 'GET') {
    console.log('GET ' + event.request.url);
    event.respondWith(getResponse(event.request));
  } else if (event.request.url.match(/\/edit-card$/)) {
    event.respondWith(event.request.formData().then(data =>
      edit(data.get('id') || now(),
           data.get('question'),
           data.get('answer'))
    ));
  } else if(event.request.url.match(/\/review-card$/)){
    event.respondWith(event.request.formData().then(data =>
      review(data.get('id'), parseInt(data.get('time')), data.has('correct'))
    ));
  } else if(event.request.url.match(/\/sync$/)){
    event.respondWith(event.request.json().then(synchronize));
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

async function deleteFile(auth, id) {
  let response = await fetch(
    'https://www.googleapis.com/drive/v3/files/' +
    id,
    {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + auth.access_token },
    });
  return;
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
  let removed = false;
  for (let id in cards) {
    if (id = 's') {
      continue;
    }
    if (cards[id].to_delete) {
      changed = true;
      removed = true;
      delete synced[id];
      let sync_id = cards[id].sync_id || await idByName(auth, 'card/' + id);
      await deleteFile(auth, sync_id);
      delete cards[id];
      continue;
    }
    if (!synced[id]) {
      if (cards.s >= id) {
        delete cards[id];
        await cache.delete('card/' + id);
        removed = true;
        continue;
      }
      changed = true;
      let data = await get(cache, 'card/' + id);
      let sync_id = await createFile(auth, id, data);
      cards[id].sync_id = sync_id;
      synced[id] = cards[id];
    } else if (cards[id].e > synced[id].e) {
      changed = true;
      let data = await get(cache, 'card/' + id);
      let sync_id = cards[id].sync_id || await idByName(auth, 'card/' + id);
      await updateFile(auth, sync_id, data);
      cards[id].sync_id = sync_id;
      synced[id] = cards[id];
    } else if (cards[id].r > synced[id].r) {
      changed = true;
      synced[id] = cards[id];
    }
    if (cards[id].d > now() + DURATION_TO_CACHE) {
      delete cards[id];
      await cache.delete('card/' + id);
      removed = true;
    }
  }
  if (changed) {
    cards.s = now();
    await updateFile(auth, cards_id, synced);
  }
  if (removed) {
    await update(cache, 'cards.json', synced);
  }
  changed = false;
  for (let id in synced) {
    if (synced[id].d <= now() + DURATION_TO_CACHE) {
      if (!cards[id] || synced[id].e > cards[id].e) {
        changed = true;
        let sync_id = synced[id].sync_id || await idByName(auth, 'card/' + id);
        let data = await getFile(auth, sync_id);
        await update(cache, 'card/' + id, data);
        cards[id] = synced[id];
      } else if (synced[id].r > cards[id].r) {
        changed = true;
        cards[id] = synced[id];
      }
    }
  }
  if (changed) {
    await update(cache, 'cards.json', synced);
    let channel = new BroadcastChannel('sync');
    channel.postMessage('change');
  }
  console.log('synchronization done');
  return new Response();
}
