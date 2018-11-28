"use strict";

marked.setOptions({
  breaks: true,
  headerIds: false,
});

let id = document.getElementById('id');
let question = document.getElementById('question');
let answer = document.getElementById('answer');
if (document.location.search) {
  let search = (new URL(document.location)).searchParams;
  id.value = search.get('id');
  question.value = search.get('question');
  answer.value = search.get('answer');
}

let edit_question = document.getElementById('edit-question');
let preview_question = document.getElementById('preview-question');
let question_preview = document.getElementById('question-preview');

edit_question.onclick = () => {
  edit_question.className = 'current';
  preview_question.className = '';
  question_preview.style.display = 'none';
  question.style.display = 'block';
}

preview_question.onclick = () => {
  question_preview.innerHTML = marked(question.value);
  preview_question.className = 'current';
  edit_question.className = '';
  question.style.display = 'none';
  question_preview.style.display = 'block';
  MathJax.Hub.Queue(["Typeset", MathJax.Hub, question_preview]);
}

let edit_answer = document.getElementById('edit-answer');
let preview_answer = document.getElementById('preview-answer');
let answer_preview = document.getElementById('answer-preview');

edit_answer.onclick = () => {
  edit_answer.className = 'current';
  preview_answer.className = '';
  answer_preview.style.display = 'none';
  answer.style.display = 'block';
}

preview_answer.onclick = () => {
  answer_preview.innerHTML = marked(answer.value);
  preview_answer.className = 'current';
  edit_answer.className = '';
  answer.style.display = 'none';
  answer_preview.style.display = 'block';
  MathJax.Hub.Queue(["Typeset", MathJax.Hub, answer_preview]);
}

// make sure the textarea has the same style as the preview
window.addEventListener('load', () => {
  let style = getComputedStyle(question_preview);
  let b = style.borderBottomWidth;
  question.style.borderBottomWidth = b;
  answer.style.borderBottomWidth = b;
  question.style.borderLeftWidth = b;
  answer.style.borderLeftWidth = b;
  question.style.borderRightWidth = b;
  answer.style.borderRightWidth = b;
  question.style.borderTopWidth = b;
  answer.style.borderTopWidth = b;
});

function getSrcs(element) {
  let srcs = {};
  for (let tag of ['audio', 'iframe', 'img', 'script', 'source', 'track', 'video']) {
    for (let e of element.getElementsByTagName(tag)) {
      if (e.src) {
        srcs[e.src] = true;
      }
    }
  }
  return srcs;
}

let main = document.getElementById('main');
let deps = document.getElementById('deps');
main.onsubmit = () => {
  question_preview.innerHTML = marked(question.value);
  answer_preview.innerHTML = marked(answer.value);
  let srcs =
    Object.keys(
      Object.assign(getSrcs(question_preview), getSrcs(answer_preview)));
  deps.value = JSON.stringify(srcs);
}
