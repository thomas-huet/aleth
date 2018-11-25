function dd(n) {
  return Math.floor(n / 10) + '' + (n % 10);
}

function formatDate(time) {
  let d = new Date(time * 1000);
  return d.getFullYear() + '-' + dd(d.getMonth() + 1) + '-' + dd(d.getDate());
}

async function render() {
  let rows = document.getElementById('dashboard-body');
  let cards = await (await fetch('cards.json')).json();
  for (let id in cards) {
    if (id === 's') {
      continue;
    }
    let card = await (await fetch('card/' + id)).json();
    let row = document.createElement('tr');
    let question = document.createElement('td');
    question.className = 'excerpt';
    question.appendChild(document.createTextNode(card.q));
    row.appendChild(question);
    let created = document.createElement('td');
    created.appendChild(document.createTextNode(formatDate(id)));
    row.appendChild(created);
    let edited = document.createElement('td');
    if (cards[id].e > id) {
      edited.appendChild(document.createTextNode(formatDate(cards[id].e)));
    }
    row.appendChild(edited);
    let due = document.createElement('td');
    due.appendChild(document.createTextNode(formatDate(cards[id].d)));
    row.appendChild(due);
    let reviewed = document.createElement('td');
    reviewed.appendChild(document.createTextNode(formatDate(cards[id].r)));
    row.appendChild(reviewed);
    row.onclick = () => {
      location.href = 'card/' + id;
    };
    rows.appendChild(row);
  }
}

render();
