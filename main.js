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
    return;
  }
  let id = due[Math.floor(Math.random() * due.length)];
  let card = await (await fetch('card/' + id)).json();
  document.getElementById('question').innerHTML = card.question;
  document.getElementById('answer').innerHTML = card.answer;
  document.getElementById('id').value = id;
  document.getElementById('time').value = now;
  document.getElementById('done').style.display = 'none';
  document.getElementById('main').style.display = 'block';
}
