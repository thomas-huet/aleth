"use strict";

marked.setOptions({
  breaks: true,
  headerIds: false,
});

if (navigator.serviceWorker.controller) {
  showCard();
} else {
  navigator.serviceWorker.oncontrollerchange = function() {
    this.controller.onstatechange = function() {
      if (this.state === 'activated') {
        showCard();
      }
    };
  };
  navigator.serviceWorker.register('sw.js');
}

function now() {
  return Math.floor(Date.now() / 1000);
}

async function showCard(card_id, old_card) {
  console.log('preparing card');
  let cards = await (await fetch('cards.json')).json();
  console.log(cards);
  let t = now();
  if (card_id &&
      cards[card_id].d < t &&
      !cards[card_id].to_delete &&
      cards[card_id].e === old_card.e) {
    return;
  }
  let due = [];
  for (let id in cards) {
    if (id === 's') {
      continue;
    }
    if (cards[id].d < t && !cards[id].to_delete) {
      due.push(id);
    }
  }
  let channel = new BroadcastChannel('sync');
  let main = document.getElementById('main');
  let placeholder = document.getElementById('placeholder');
  let edit = document.getElementById('edit');
  if (due.length === 0) {
    main.style.display = 'none';
    placeholder.style.display = 'block';
    edit.style.display = 'none';
    channel.onmessage = () => {
      showCard();
    };
    return;
  }
  let id = due[Math.floor(Math.random() * due.length)];
  let card = await (await fetch('card/' + id)).json();
  document.getElementById('question').innerHTML = marked(card.q);
  document.getElementById('answer').innerHTML = marked(card.a);
  let back = document.getElementById('back');
  back.style.visibility = 'hidden';
  main.onclick = () => {
    document.getElementById('time').value = now();
    back.style.visibility = 'visible';
    main.style.cursor = 'auto';
  };
  main.style.cursor = 'pointer';
  document.getElementById('id').value = id;
  placeholder.style.display = 'none';
  main.style.display = 'block';
  edit.onclick = () => {
    location.href =
      'edit.html?id=' + id +
      '&question=' + encodeURIComponent(card.q) +
      '&answer=' + encodeURIComponent(card.a);
  };
  edit.style.display = 'block';
  MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
  channel.onmessage = () => {
    showCard(id, due[id]);
  };
}

// menu
let hamburger = document.getElementById('hamburger');
let menu = document.getElementById('menu');
hamburger.onclick = () => {
  if (menu.style.display === 'none') {
    menu.style.display = 'block';
  } else {
    menu.style.display = 'none';
  }
}

// reload page every hour
setTimeout(() => {
  window.location.reload();
}, 60 * 60 * 1000);
