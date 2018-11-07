"use strict";

// works for localhost:8000 and thomas-huet.github.io
const GAPI_CLIENT_ID = '1034988601138-0ja8094uqukkjhubodnbd2rl0e80o7lr.apps.googleusercontent.com';
const GAPI_KEY = 'AIzaSyAcfcHpd-Esk-ERLgfdXrNEYF6Lm_iMBtQ'

if (window.gapi) {
  gapi.load('client:auth2', () => {
    gapi.client.init({
      clientId: GAPI_CLIENT_ID,
      apiKey: GAPI_KEY,
      scope: 'https://www.googleapis.com/auth/drive.appdata',
    }).then(() => {
      console.log('Google client ready');
      if (location.search === '?logout') {
        gapi.auth2.getAuthInstance().signOut();
        console.log('Signed out');
        location.search = '';
        return;
      }
      gapi.auth2.getAuthInstance().isSignedIn.listen(signIn);
      if (gapi.auth2.getAuthInstance().isSignedIn.get()) {
        signIn(true);
      } else {
        let button = document.getElementById('sync-drive');
        button.style.display = 'inline-block';
        button.onclick = () => {
          gapi.auth2.getAuthInstance().signIn();
        }
      }
    });
  });
}

function signIn(ok) {
  if (ok) {
    console.log('Signed in');
    if (navigator.serviceWorker.controller) {
      sync();
    } else {
      navigator.serviceWorker.oncontrollerchange = function() {
        this.controller.onstatechange = function() {
          if (this.state === 'activated') {
            sync();
          }
        };
      };
    }
  }
}

function sync() {
  let auth =
    gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse(true);
  let button = document.getElementById('sync-drive');
  button.style.display = 'none';
  fetch('sync', {
    method: 'POST',
    body: JSON.stringify(auth),
  });
}
