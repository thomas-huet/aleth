"use strict";

marked.setOptions({
  breaks: true,
  headerIds: false,
});

if (navigator.serviceWorker.controller) {
  nextCard();
} else {
  navigator.serviceWorker.oncontrollerchange = function() {
    this.controller.onstatechange = function() {
      if (this.state === 'activated') {
        nextCard();
      }
    };
  };
  navigator.serviceWorker.register('sw.js');
}

function now() {
  return Math.floor(Date.now() / 1000);
}

async function nextCard() {
  console.log('preparing card');
  let cards = await (await fetch('cards.json')).json();
  console.log(cards);
  let t = now();
  let due = [];
  for (let id in cards) {
    if (id = 's') {
      continue;
    }
    if (cards[id].d < t && !cards[id].to_delete) {
      due.push(id);
    }
  }
  if (due.length === 0) {
    let channel = new BroadcastChannel('sync');
    channel.onmessage = nextCard;
    return;
  }
  let id = due[Math.floor(Math.random() * due.length)];
  let card = await (await fetch('card/' + id)).json();
  document.getElementById('question').innerHTML = marked(card.q);
  document.getElementById('answer').innerHTML = marked(card.a);
  let back = document.getElementById('back');
  back.style.visibility = 'hidden';
  let main = document.getElementById('main');
  main.onclick = () => {
    document.getElementById('time').value = now();
    back.style.visibility = 'visible';
  };
  document.getElementById('id').value = id;
  document.getElementById('placeholder').style.display = 'none';
  main.style.display = 'block';
  let edit = document.getElementById('edit');
  edit.onclick = () => {
    location.href =
      'edit.html?id=' + id +
      '&question=' + encodeURIComponent(card.q) +
      '&answer=' + encodeURIComponent(card.a);
  };
  edit.style.visibility = 'visible';
  MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
}

// reload page every hour
setTimeout(() => {
  window.location.reload();
}, 60 * 60 * 1000);
