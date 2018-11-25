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
  'about.html',
  'controller.js',
  'edit.html',
  'edit.js',
  'gauth.js',
  'main.js',
  'style.css',
  // external dependencies
  'https://cdnjs.cloudflare.com/ajax/libs/marked/0.5.1/marked.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.5/MathJax.js?config=TeX-AMS_CHTML-full',
  'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.5/config/TeX-AMS_CHTML-full.js?V=2.7.5',
  'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.5/jax/output/CommonHTML/autoload/multiline.js?V=2.7.5',
  'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.5/jax/output/CommonHTML/fonts/TeX/fontdata.js?V=2.7.5',
];

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
  if (!await cache.match('cards.json')) {
    console.log('creating new cards.json');
    await update(cache, 'cards.json', {s: 0});
  } else  {
    console.log('keeping old cards.json');
  }
  await cache.addAll(BASE_FILES);
}

self.addEventListener('activate', event => {
  console.log('activating service worker');
  event.waitUntil(self.clients.claim());
});

async function getResponse(request) {
  let cache = await caches.open(V);
  if (request.url.match(/\/edit.html/) || request.url.match(/\?logout$/)) {
    return cache.match(request, {ignoreSearch: true});
  }
  let cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  console.error(request.url + ' not in cache');
  let response = await fetch(request.url);
  if (response.ok) {
    cache.put(request.url, response.clone());
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
      d: t,
      i: DELAY_MIN,
    };
  }
  card.e = t;
  card.r = t;
  cards[id] = card;
  await update(cache, 'card/' + id, {q: question, a: answer});
  await update(cache, 'cards.json', cards);
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
  if (cards.s >= id) {
    card.to_delete = true;
  } else {
    delete cards[id];
  }
  await update(cache, 'cards.json', cards);
  await cache.delete('card/' + id);
  return Response.redirect('.');
}

async function reset() {
  console.log('resetting cache');
  await caches.delete(V);
  await init();
  return Response.redirect('.');
}

self.addEventListener('fetch', event => {
  let url = new URL(event.request.url);
  if (url.host === 'apis.google.com') {
    return;
  }
  if (event.request.url.match(/\/reset$/)) {
    event.respondWith(reset());
  } else if (event.request.method === 'GET') {
    event.respondWith(getResponse(event.request));
  } else if (event.request.method === 'POST' &&
             event.request.url.match(/\/edit-card$/)) {
    event.respondWith(event.request.formData().then(data =>
      edit(data.get('id') || now(),
           data.get('question'),
           data.get('answer'))
    ));
  } else if (event.request.method === 'POST' &&
             event.request.url.match(/\/review-card$/)) {
    event.respondWith(event.request.formData().then(data =>
      review(data.get('id'), parseInt(data.get('time')), data.has('correct'))
    ));
  } else if (event.request.method === 'POST' &&
             event.request.url.match(/\/sync$/)) {
    event.respondWith(event.request.json().then(synchronize));
  } else if (event.request.method === 'DELETE' &&
             event.request.url.match(/\/card\/[0-9]+$/)) {
    let id = event.request.url.match(/\/card\/([0-9]+)$/)[1];
    event.respondWith(deleteCard(id));
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
  return (await response.json()).id;
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
  if (files.length !== 1) {
    console.error(files.length + 'copies of file ' + name);
  }
  if (files.length >= 1) {
    return files[files.length - 1].id;
  }
  return undefined;
}

async function deleteFile(auth, id, name) {
  id = id || await idByName(auth, name);
  let response = await fetch(
    'https://www.googleapis.com/drive/v3/files/' +
    id,
    {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + auth.access_token },
    });
  return id;
}

async function getFile(auth, id, name) {
  id = id || await idByName(auth, name);
  let response = await fetch(
    'https://www.googleapis.com/drive/v3/files/' +
    id +
    '?alt=media',
    {
      headers: { Authorization: 'Bearer ' + auth.access_token },
    });
  return response.json();
}

async function updateFile(auth, id, name, content) {
  id = id || await idByName(auth, name);
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
  return id;
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
  let synced_changed = false;
  let cards_changed = false;
  let todo_before_cards_update = [];
  let cards_updated;
  let cards_update = new Promise(resolve => { cards_updated = resolve; });
  let todo_before_synced_update = [];
  let synced_updated;
  let synced_update = new Promise(resolve => { synced_updated = resolve; });
  for (let id in cards) {
    if (id === 's') {
      continue;
    }
    if (cards[id].sync_id) {
      cards[id].s = cards[id].sync_id;
    }
    delete cards[id].sync_id;
    if (cards[id].to_delete) {
      if (synced[id]) {
        synced_changed = true;
        cards_changed = true;
        delete synced[id];
        synced_update.then(() => {
          deleteFile(auth, cards[id].s, 'card/' + id);
        });
      }
      delete cards[id];
      continue;
    }
    if (!synced[id]) {
      if (cards.s >= id) {
        delete cards[id];
        cards_update.then(() => cache.delete('card/' + id));
        cards_changed = true;
        continue;
      }
      synced_changed = true;
      todo_before_synced_update.push(
        get(cache, 'card/' + id)
        .then(data => createFile(auth, id, data))
        .then(sync_id => {
          cards[id].s = sync_id;
          synced[id] = cards[id];
        }));
    } else if (cards[id].e > synced[id].e) {
      synced_changed = true;
      todo_before_synced_update.push(
        get(cache, 'card/' + id)
        .then(data => updateFile(auth, cards[id].s, 'card/' + id, data))
        .then(sync_id => {
          cards[id].s = sync_id;
          synced[id] = cards[id];
        }));
    } else if (cards[id].r > synced[id].r) {
      synced_changed = true;
      synced[id] = cards[id];
    }
  }
  if (synced_changed) {
    await Promise.all(todo_before_synced_update);
    await updateFile(auth, cards_id, 'cards.json', synced);
    synced_updated();
  }
  for (let id in synced) {
    if (synced[id].sync_id) {
      synced[id].s = synced[id].sync_id;
    }
    delete synced[id].sync_id;
    if (synced[id].d <= now() + DURATION_TO_CACHE) {
      if (!cards[id] || synced[id].e > cards[id].e) {
        cards_changed = true;
        todo_before_cards_update.push(
          getFile(auth, synced[id].s, 'card/' + id)
          .then(data => update(cache, 'card/' + id, data)));
        cards[id] = synced[id];
      } else if (synced[id].r > cards[id].r) {
        cards_changed = true;
        cards[id] = synced[id];
      }
    } else if (cards[id]) {
      delete cards[id];
      cards_update.then(() => {
        cache.delete('card/' + id);
      });
      cards_changed = true;
    }
  }
  if (cards_changed || synced_changed) {
    cards.s = now();
    await Promise.all(todo_before_cards_update);
    await update(cache, 'cards.json', cards);
    cards_updated();
  }
  if (cards_changed) {
    let channel = new BroadcastChannel('sync');
    channel.postMessage('change');
  }
  console.log('synchronization done');
  console.log('cards = ', cards);
  return new Response();
}
