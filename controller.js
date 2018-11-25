export let ready = new Promise(function(resolve, reject) {
  if (navigator.serviceWorker.controller) {
    resolve();
  } else {
    navigator.serviceWorker.oncontrollerchange = function() {
      this.controller.onstatechange = function() {
        if (this.state === 'activated') {
          resolve();
        }
      };
    };
    navigator.serviceWorker.register('sw.js');
  }
});
