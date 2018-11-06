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

function sync() {
  let auth =
    gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse(true);
  fetch('sync', {
    method: 'POST',
    body: JSON.stringify(auth),
  });
}
