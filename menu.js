let hamburger = document.getElementById('hamburger');
let menu = document.getElementById('menu');
hamburger.onclick = (event) => {
  if (menu.style.display === 'none') {
    menu.style.display = 'block';
  } else {
    menu.style.display = 'none';
  }
  event.stopPropagation();
}
document.onclick = () => {
  menu.style.display = 'none';
};
