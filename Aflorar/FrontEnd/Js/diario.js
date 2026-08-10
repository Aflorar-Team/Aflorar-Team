const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const moods = [
  { mood: 'Ótimo', emoji: '😄' }, { mood: 'Bem', emoji: '🙂' }, { mood: 'Neutro', emoji: '😐' },
  { mood: 'Ansioso', emoji: '😰' }, { mood: 'Triste', emoji: '😔' }, { mood: 'Cansado', emoji: '😴' },
  { mood: 'Com raiva', emoji: '😤' }, { mood: 'Grato', emoji: '🥰' }
];
let selectedMood = 'Bem', selectedEmoji = '🙂', currentIndex = null;
const entries = [
  { date: '10 de jul de 2026', mood: 'Bem', emoji: '🙂', text: 'Tive um dia tranquilo, consegui me concentrar nos estudos. Me sinto mais leve hoje.', tags: ['sono', 'conquista'] },
  { date: '09 de jul de 2026', mood: 'Ansioso', emoji: '😰', text: 'Tinha muita coisa para fazer e a sensação de urgência não saiu a tarde toda.', tags: ['trabalho', 'saúde'] },
];
function formatDate() { const n = new Date(); return `${n.getDate()} de ${months[n.getMonth()]} de ${n.getFullYear()}`; }
document.getElementById('paperDate').textContent = formatDate();
const grid = document.getElementById('moodGrid');
moods.forEach(m => {
  const btn = document.createElement('button');
  btn.className = 'mood-opt';
  btn.innerHTML = `<span class="e">${m.emoji}</span><span class="l">${m.mood}</span>`;
  btn.onclick = () => pickMood(m.mood, m.emoji, btn);
  grid.appendChild(btn);
});
grid.querySelector('.mood-opt:nth-child(2)').classList.add('selected');
function pickMood(mood, emoji, btn) {
  selectedMood = mood; selectedEmoji = emoji;
  document.getElementById('currentEmoji').textContent = emoji;
  document.getElementById('currentMoodLabel').textContent = mood;
  document.querySelectorAll('.mood-opt').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  closeMoodDropdown();
}
function toggleMoodDropdown() {
  const dd = document.getElementById('moodDropdown');
  const tr = document.getElementById('moodTrigger');
  const open = dd.classList.toggle('open');
  tr.classList.toggle('open', open);
}
function closeMoodDropdown() {
  document.getElementById('moodDropdown').classList.remove('open');
  document.getElementById('moodTrigger').classList.remove('open');
}
document.addEventListener('click', e => { if (!e.target.closest('.mood-trigger-wrap')) closeMoodDropdown(); });
function toggleTag(el) { el.classList.toggle('active'); }
function renderSidebar() {
  document.getElementById('pagesList').innerHTML = entries.map((e, i) => `
    <div class="page-item${currentIndex === i ? ' active' : ''}" onclick="loadEntry(${i})">
      <span class="pg-emoji">${e.emoji}</span>
      <div class="pg-info"><div class="pg-mood">${e.mood}</div><div class="pg-date">${e.date}</div></div>
    </div>`).join('');
}
function loadEntry(i) {
  currentIndex = i; const e = entries[i];
  document.getElementById('paperDate').textContent = e.date;
  document.getElementById('diaryText').value = e.text;
  selectedMood = e.mood; selectedEmoji = e.emoji;
  document.getElementById('currentEmoji').textContent = e.emoji;
  document.getElementById('currentMoodLabel').textContent = e.mood;
  document.querySelectorAll('.mood-opt').forEach(b => { b.classList.toggle('selected', b.querySelector('.l').textContent === e.mood); });
  document.querySelectorAll('.tag').forEach(t => { t.classList.toggle('active', e.tags.includes(t.textContent)); });
  renderSidebar();
}
function newPage() {
  currentIndex = null;
  document.getElementById('paperDate').textContent = formatDate();
  document.getElementById('diaryText').value = '';
  selectedMood = 'Bem'; selectedEmoji = '🙂';
  document.getElementById('currentEmoji').textContent = '🙂';
  document.getElementById('currentMoodLabel').textContent = 'Como você está?';
  document.querySelectorAll('.mood-opt').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
  renderSidebar();
}
function savePage() {
  const text = document.getElementById('diaryText').value.trim();
  const tags = [...document.querySelectorAll('.tag.active')].map(t => t.textContent);
  const entry = { date: document.getElementById('paperDate').textContent, mood: selectedMood, emoji: selectedEmoji, text: text || '(sem texto)', tags };
  if (currentIndex !== null) { entries[currentIndex] = entry; } else { entries.unshift(entry); currentIndex = 0; }
  renderSidebar();
  const toast = document.getElementById('toast');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}
renderSidebar();