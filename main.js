"use strict";

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

async function nextCard() {
  console.log('preparing card');
  let cards = await (await fetch('cards.json')).json();
  console.log(cards);
  let now = Date.now();
  let due = [];
  for (let id in cards) {
    if (cards[id].due < now) {
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
  document.getElementById('question').innerHTML = card.question;
  document.getElementById('answer').innerHTML = card.answer;
  let back = document.getElementById('back');
  back.style.visibility = 'hidden';
  let main = document.getElementById('main');
  main.onclick = () => {
    document.getElementById('time').value = Date.now();
    back.style.visibility = 'visible';
  };
  document.getElementById('id').value = id;
  document.getElementById('placeholder').style.display = 'none';
  main.style.display = 'block';
  let edit = document.getElementById('edit');
  edit.onclick = () => {
    location.href =
      'edit.html?id=' + id +
      '&question=' + encodeURIComponent(card.question) +
      '&answer=' + encodeURIComponent(card.answer);
  };
  edit.style.visibility = 'visible';
}

// reload page every hour
setTimeout(() => {
  window.location.reload();
}, 60 * 60 * 1000);
