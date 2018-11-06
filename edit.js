"use strict";

let id = document.getElementById('id');
let question = document.getElementById('question');
let answer = document.getElementById('answer');
if (document.location.search) {
  let search = (new URL(document.location)).searchParams;
  id.value = search.get('id');
  question.value = search.get('question');
  answer.value = search.get('answer');
}
