// works for localhost:8000
const GAPI_CLIENT_ID = '1034988601138-0ja8094uqukkjhubodnbd2rl0e80o7lr.apps.googleusercontent.com';
const GAPI_KEY = 'AIzaSyAcfcHpd-Esk-ERLgfdXrNEYF6Lm_iMBtQ'

var ready = new Promise(function(resolve, reject) {
  if (window.gapi) {
    gapi.load('client:auth2', () => {
      gapi.client.init({
        clientId: GAPI_CLIENT_ID,
        apiKey: GAPI_KEY,
        scope: 'https://www.googleapis.com/auth/drive.appdata',
      }).then(() => {
        console.log('Google client ready');
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateButtons);
        updateButtons(gapi.auth2.getAuthInstance().isSignedIn.get());
        resolve();
      });
    });
  } else {
    reject();
  }
});

function updateButtons(signed_in) {
  if (signed_in) {
    console.log('signed in');
    document.getElementById('drive-in').style.display = 'none';
    let drive_out = document.getElementById('drive-out');
    drive_out.style.display = 'block';
    drive_out.onclick = () => {
      gapi.auth2.getAuthInstance().signOut();
    };
  } else {
    console.log('signed out');
    document.getElementById('drive-out').style.display = 'none';
    let drive_in = document.getElementById('drive-in');
    drive_in.style.display = 'block';
    drive_in.onclick = () => {
      gapi.auth2.getAuthInstance().signIn();
    };
  }
}

export async function exec(f) {
  await ready;
  if (gapi.auth2.getAuthInstance().isSignedIn.get()) {
    f(gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse(true));
  }
}

export async function execOnSignIn(f) {
  await exec(f);
  gapi.auth2.getAuthInstance().isSignedIn.listen(function(ok) {
    if (ok) {
      f(gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse(true));
    }
  });
}

