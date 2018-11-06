"use strict";

const GAPI_CLIENT_ID = '1034988601138-ma48mfbn3jj0afi2lcubso9gtqf452ft.apps.googleusercontent.com';
const GAPI_KEY = 'AIzaSyAcfcHpd-Esk-ERLgfdXrNEYF6Lm_iMBtQ'

if (window.gapi) {
  gapi.load('client:auth2', () => {
    gapi.client.init({
      clientId: GAPI_CLIENT_ID,
      apiKey: GAPI_KEY,
      discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
      scope: 'https://www.googleapis.com/auth/drive.file',
    }).then(() => {
      console.log('Google client ready');
      let button = document.getElementById('sync_drive');
      button.style.display = 'inline-block';
      button.onclick = () => {
        gapi.auth2.getAuthInstance().signIn();
      }
      gapi.auth2.getAuthInstance().isSignedIn.listen(signIn);
      signIn(gapi.auth2.getAuthInstance().isSignedIn.get());
    });
  });
}

function signIn(ok) {
  if (ok) {
    console.log('Signed in');
    sync();
  }
}

async function getFile(id) {
  let response = await gapi.client.drive.files.get({
    fileId: id,
    alt: 'media',
  });
  return JSON.parse(response);
}

async function idByName(name) {
  let response = await gapi.client.drive.files.list({
    q: 'name="' + name + '"',
    fields: 'files(id)',
  });
  if (response.result.files.length === 1) {
    return response.result.files[0].id;
  }
  return undefined;
}

async function createFile(name, content) {
  let response =await gapi.client.drive.files.create({
    name: name,
    mimeType: 'application/json',
//    fields: 'id',
  });
  console.log(response);
  return response.result.id;
}

function updateFile(id, content) {
  return gapi.client.drive.files.update({
    fileId: id,
    media: {
      mimeType: 'application/json',
      body: content,
    },
    fields: '',
  });
}

async function sync() {
  console.log('syncing');
  let cards_id = await idByName('cards.json');
  console.log('cards_id = ' + cards_id);
  let synced = {};
  if (cards_id !== undefined) {
    synced = await getFile(cards_id);
  } else {
    console.log('creating cards.json');
    cards_id = await createFile('cards.json', '{}');
    console.log('cards_id = ' + cards_id);
  }
  console.log('synchronized:', synced);
  let merge = await (await fetch('merge-cards', {
    method: 'POST',
    body: JSON.stringify(synced),
  })).json();
  console.log(merge);
  let changed = false;
  for (let id in merge.updated) {
    changed = true;
    if (!synced[id]) {
      let data = (await fetch('card/' + id)).body();
      let sync_id = await createFile(id, data);
      merge.updated[id].sync_id = sync_id;
    } else if (merge.updated[id].edited > synced[id].edited) {
      
    }
    synced[id] = merge.updated[id];
  }
  for (let id of merge.toEdit) {
    changed = true;
    let sync_id = synced[id].sync_id || idByName(id);
    let data = await getFile(sync_id);
    let formData = new FormData();
    formData.append('id', id);
    formData.append('question', data.question);
    formData.append('answer', data.answer);
    formData.append('edited', synced[id].edited);
    formData.append('sync_id', sync_id);
    await fetch('edit-card', {
      method: 'POST',
      body: formData,
    });
  }
  if (changed) {
    await updateFile(cards_id, JSON.stringify(synced));
  }
  console.log('synchronization done');
}
