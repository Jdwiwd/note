// 主程序入口文件
const { invoke } = window.__TAURI__.core;

let notesListEl;
let notes = [];
let currentNoteId = null;

// 排序状态
let sortState = {
  field: 'updated',
  direction: 'desc'
};

// 添加新笔记
async function addNote() {
  const title = "新笔记";
  const content = "";

  try {
    const note = await invoke("add_note", { title, content });

    // 给新笔记添加临时置顶标记
    note.isNew = true;

    // 新增：设置新笔记为编辑状态
    note.is_editing = true;

    // 将新笔记添加到本地数组并更新UI
    notes.push(note);
    // 修复：直接渲染列表而不改变排序方向
    renderNotesList();
    selectNote(note.id); // 自动选中新笔记
  } catch (error) {
    console.error("添加笔记失败:", error);
  }
}

// 排序笔记函数
function sortNotes(notesArray) {
  return [...notesArray].sort((a, b) => {
    // 处理新增笔记的临时置顶逻辑
    if (a.isNew && !b.isNew) return -1;
    if (!a.isNew && b.isNew) return 1;

    let valueA, valueB;

    switch (sortState.field) {
      case 'title':
        valueA = a.title.toLowerCase();
        valueB = b.title.toLowerCase();
        return sortState.direction === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);

      case 'updated':
        valueA = new Date(a.updated_at);
        valueB = new Date(b.updated_at);
        return sortState.direction === 'asc'
          ? valueA - valueB
          : valueB - valueA;

      case 'created':
        valueA = new Date(a.created_at);
        valueB = new Date(b.created_at);
        return sortState.direction === 'asc'
          ? valueA - valueB
          : valueB - valueA;
    }
  });
}

// 渲染笔记列表（带排序）
function renderNotesList() {
  notesListEl.innerHTML = '';

  // 排序逻辑
  const sortedNotes = sortNotes(notes);

  sortedNotes.forEach(note => {
    const listItem = document.createElement('li');
    listItem.className = 'note-list-item';
    if (note.id === currentNoteId) {
      listItem.classList.add('active');
    }
    listItem.dataset.id = note.id;

    // 创建预览文本（取前15个字符）
    const preview = note.content.length > 15
      ? note.content.substring(0, 15) + '...'
      : note.content;

    listItem.innerHTML = `
      <div class="note-list-title">${note.title}</div>
      <div class="note-list-preview">${preview}</div>
      <div class="note-list-date">${formatDate(note.updated_at)}</div>
    `;

    listItem.addEventListener('click', () => selectNote(note.id));
    notesListEl.appendChild(listItem);
  });
}

// 更新排序状态
function updateSort(field) {
  // 移除所有笔记的临时置顶标记
  notes.forEach(note => delete note.isNew);

  // 如果点击的是当前排序字段，则切换方向
  if (sortState.field === field) {
    sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
  }
  // 否则设置为新字段，默认降序
  else {
    sortState.field = field;
    sortState.direction = 'desc';
  }

  // 更新按钮状态
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.classList.remove('asc', 'desc');

    if (btn.id === `sort-${field}`) {
      btn.classList.add(sortState.direction);
    }
  });

  renderNotesList();
}

// 格式化日期
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// 选择笔记（显示在右侧详情）
function selectNote(noteId) {
  currentNoteId = noteId;
  const note = notes.find(n => n.id === noteId);

  if (note) {
    // 更新左侧列表激活状态
    document.querySelectorAll('.note-list-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === noteId);
    });

    // 更新右侧详情
    // 根据编辑状态显示标题
    const titleElement = document.getElementById('detail-title');
    if (note.is_editing) {
      // 添加maxlength属性限制标题为15个字符
      titleElement.innerHTML = `<input type="text" id="edit-title" class="edit-title-input" value="${note.title}" maxlength="15" />`;

      // 添加输入事件监听器
      const titleInput = document.getElementById('edit-title');
      titleInput.addEventListener('input', updateTitleLengthHint);

      // 初始化字数提示
      updateTitleLengthHint.call(titleInput);
    } else {
      titleElement.innerHTML = `<h2>${note.title}</h2>`;
      // 隐藏标题字数提示
      document.getElementById('title-length-hint').style.display = 'none';
    }

    document.getElementById('detail-created-at').textContent =
      `创建于: ${formatDate(note.created_at)}`;
    document.getElementById('detail-updated-at').textContent =
      `更新于: ${formatDate(note.updated_at)}`;

    // 根据编辑状态显示内容
    const contentElement = document.getElementById('detail-content');
    if (note.is_editing) {
      contentElement.innerHTML = `<textarea id="edit-content" class="edit-textarea">${note.content}</textarea>`;

      // 添加内容编辑框事件监听器
      const contentTextarea = document.getElementById('edit-content');
      contentTextarea.addEventListener('input', updateContentLengthHint);
      updateContentLengthHint.call(contentTextarea);
    } else {
      contentElement.textContent = note.content;
      // 隐藏内容字数提示
      document.getElementById('content-length-hint').style.display = 'none';
    }

    // 更新编辑按钮状态
    document.getElementById('edit-btn').title = note.is_editing ? '保存' : '编辑';
    document.getElementById('edit-btn').textContent = note.is_editing ? '💾' : '✏️';

    // 显示详情区域
    document.getElementById('note-detail-placeholder').style.display = 'none';
    document.getElementById('note-detail').style.display = 'block';
  }
}

// 更新标题长度提示
function updateTitleLengthHint() {
  const hintElement = document.getElementById('title-length-hint');
  const currentLength = this.value.length;
  const maxLength = 15;

  hintElement.textContent = `标题: ${currentLength}/${maxLength}`;
  hintElement.style.display = 'inline';

  // 当接近限制时改变颜色
  if (currentLength > maxLength * 0.9) {
    hintElement.style.color = '#e53935';
  } else {
    hintElement.style.color = '#666';
  }
}

// 更新内容长度提示
function updateContentLengthHint() {
  const hintElement = document.getElementById('content-length-hint');
  const currentLength = this.value.length;

  hintElement.textContent = `当前字数: ${currentLength}`;
  hintElement.style.display = 'inline';
}

// 删除当前笔记
async function deleteCurrentNote() {
  if (!currentNoteId) return;

  try {
    const success = await invoke("delete_note", { id: currentNoteId });

    if (success) {
      // 从本地数组中移除并更新UI
      notes = notes.filter(note => note.id !== currentNoteId);
      renderNotesList();

      // 删除后自动选择下一个笔记
      if (notes.length > 0) {
        // 获取当前排序后的笔记列表
        const sortedNotes = sortNotes(notes);
        // 选择排序后的第一个笔记
        selectNote(sortedNotes[0].id);
      } else {
        // 没有笔记时显示占位符
        currentNoteId = null;
        document.getElementById('note-detail-placeholder').style.display = 'block';
        document.getElementById('note-detail').style.display = 'none';
      }
    }
  } catch (error) {
    console.error("删除笔记失败:", error);
  }
}

// 切换编辑状态
async function toggleEditNote() {
  if (!currentNoteId) return;

  const noteIndex = notes.findIndex(n => n.id === currentNoteId);
  if (noteIndex === -1) return;

  try {
    const note = notes[noteIndex];

    // 如果当前是编辑状态，保存内容
    if (note.is_editing) {
      const newTitle = document.getElementById('edit-title').value;
      const newContent = document.getElementById('edit-content').value;

      const updatedNote = await invoke("update_note", {
        id: currentNoteId,
        title: newTitle,
        content: newContent
      });

      if (updatedNote) {
        // 更新本地数据
        notes[noteIndex] = updatedNote;
        notes[noteIndex].is_editing = false;

        // 修复：保存后刷新左侧列表
        renderNotesList();
      }
    } else {
      // 切换为编辑状态
      notes[noteIndex].is_editing = true;
    }

    // 重新渲染当前笔记
    selectNote(currentNoteId);
  } catch (error) {
    console.error("编辑笔记失败:", error);
  }
}

// 加载所有笔记
async function loadNotes() {
  try {
    notes = await invoke("get_all_notes");
    renderNotesList();

    // 如果有笔记，默认选中第一个
    if (notes.length > 0) {
      // 获取当前排序后的笔记列表
      const sortedNotes = sortNotes(notes);
      // 选择排序后的第一个笔记
      selectNote(sortedNotes[0].id);
    }
  } catch (error) {
    console.error("加载笔记失败:", error);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  notesListEl = document.querySelector("#notes-list");

  // 新建笔记按钮
  document.getElementById('new-note-btn').addEventListener('click', addNote);

  // 详情操作按钮
  document.getElementById('delete-btn').addEventListener('click', deleteCurrentNote);
  document.getElementById('edit-btn').addEventListener('click', toggleEditNote);

  // 排序按钮事件
  document.getElementById('sort-title').addEventListener('click', () => updateSort('title'));
  document.getElementById('sort-updated').addEventListener('click', () => updateSort('updated'));
  document.getElementById('sort-created').addEventListener('click', () => updateSort('created'));

  // 加载现有笔记
  loadNotes();
});