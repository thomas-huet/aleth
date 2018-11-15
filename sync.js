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
        let drive_in = document.getElementById('drive-in');
        drive_in.style.display = 'block';
        drive_in.onclick = () => {
          gapi.auth2.getAuthInstance().signIn();
        }
      }
    });
  });
}

var channel = new BroadcastChannel('sync');
function signIn(ok) {
  if (ok) {
    console.log('Signed in');
    document.getElementById('drive-in').style.display = 'none';
    let drive_out = document.getElementById('drive-out');
    drive_out.style.display = 'block';
    drive_out.onclick = () => {
      gapi.auth2.getAuthInstance().signOut();
    }
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
    channel.onmessage = (msg) => {
      if (msg.data === 'sync') {
        sync();
      }
    };
  } else {
    document.getElementById('drive-out').style.display = 'none';
    let drive_in = document.getElementById('drive-in');
    drive_in.style.display = 'block';
    drive_in.onclick = () => {
      gapi.auth2.getAuthInstance().signIn();
    }
    channel.onmessage = null;
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
