/* =========================================================
   VEXEL MEDIA — CLIENT PORTAL
   Single role-aware app for both clients and admins
   ========================================================= */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_BUCKET, STATUS } from './config.js';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- STATE ----------
const state = {
  session: null,
  profile: null,
  isAdmin: false,
  projects: [],
  tasks: {},          // { project_id: [tasks] }
  currentTaskId: null,
  currentFiles: [],
  currentMessages: [],
  allClients: [],     // admin-only
};

// ---------- UTIL ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('is-err', isError);
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.hidden = true), 3500);
}

function escapeHtml(s) {
  return (s ?? '').toString()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

function fmtSize(b) {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function statusPill(status) {
  const s = STATUS[status] || STATUS.submitted;
  return `<span class="status-pill" style="--pill:${s.color}">${s.label}</span>`;
}

// ---------- AUTH BOOTSTRAP ----------
async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    location.replace('login.html');
    return;
  }
  state.session = session;

  // Fetch profile
  const { data: profile, error } = await sb
    .from('profiles').select('*').eq('id', session.user.id).single();

  if (error) {
    console.error(error);
    toast('Could not load your profile. ' + error.message, true);
    return;
  }
  state.profile = profile;
  state.isAdmin = profile.role === 'admin';

  // Render header
  $('#phName').textContent = profile.full_name || profile.email;
  $('#phRole').textContent = state.isAdmin ? 'admin' : (profile.package || 'client');

  // Show right view
  $('#portalLoading').hidden = true;
  $('#portalRoot').hidden = false;

  if (state.isAdmin) {
    $('#adminView').hidden = false;
    await loadAdminData();
  } else {
    $('#clientView').hidden = false;
    $('#clientWelcome').innerHTML = `Hi <em>${escapeHtml((profile.full_name || profile.email).split(' ')[0])}.</em>`;
    await loadClientData();
  }
}

// ---------- CLIENT VIEW ----------
async function loadClientData() {
  const { data: projects, error } = await sb
    .from('projects')
    .select('*, tasks(*)')
    .eq('client_id', state.profile.id)
    .order('created_at', { ascending: false });

  if (error) { toast(error.message, true); return; }
  state.projects = projects || [];
  renderProjects($('#projectsList'), state.projects, false);
}

// ---------- ADMIN VIEW ----------
async function loadAdminData() {
  // All projects + tasks + client info
  const { data: projects, error } = await sb
    .from('projects')
    .select('*, client:profiles!projects_client_id_fkey(*), tasks(*)')
    .order('created_at', { ascending: false });
  if (error) { toast(error.message, true); return; }
  state.projects = projects || [];

  // All clients (for filter + new project modal)
  const { data: clients } = await sb
    .from('profiles').select('*').eq('role', 'client').order('full_name');
  state.allClients = clients || [];

  // Stats
  const tasks = state.projects.flatMap(p => p.tasks || []);
  $('#statClients').textContent = state.allClients.length;
  $('#statProjects').textContent = state.projects.filter(p => p.status === 'active').length;
  $('#statTasks').textContent = tasks.filter(t => t.status !== 'delivered').length;
  $('#statReview').textContent = tasks.filter(t => t.status === 'review' || t.status === 'revisions').length;

  // Populate filter
  const filter = $('#adminClientFilter');
  filter.innerHTML = '<option value="">All clients</option>' +
    state.allClients.map(c => `<option value="${c.id}">${escapeHtml(c.full_name || c.email)}${c.company ? ' · ' + escapeHtml(c.company) : ''}</option>`).join('');

  renderProjects($('#adminProjectsList'), state.projects, true);
}

function applyAdminFilter() {
  const clientId = $('#adminClientFilter').value;
  const status = $('#adminStatusFilter').value;
  let filtered = [...state.projects];
  if (clientId) filtered = filtered.filter(p => p.client_id === clientId);
  if (status) {
    filtered = filtered
      .map(p => ({ ...p, tasks: (p.tasks || []).filter(t => t.status === status) }))
      .filter(p => p.tasks.length > 0);
  }
  renderProjects($('#adminProjectsList'), filtered, true);
}

// ---------- RENDER PROJECTS ----------
function renderProjects(root, projects, isAdmin) {
  if (!projects.length) {
    root.innerHTML = `
      <div class="empty-state">
        <span class="empty-state__icon">○</span>
        <h3>${isAdmin ? 'No projects yet' : 'No projects yet — let\'s start one'}</h3>
        <p>${isAdmin ? 'Invite a client and create their first project.' : 'Click "+ New project / brief" above to kick things off.'}</p>
      </div>`;
    return;
  }

  root.innerHTML = projects.map(p => {
    const tasks = (p.tasks || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const clientName = isAdmin && p.client
      ? `<span class="proj__client">${escapeHtml(p.client.full_name || p.client.email)}${p.client.company ? ' · ' + escapeHtml(p.client.company) : ''}</span>`
      : '';
    return `
      <article class="proj">
        <header class="proj__head">
          <div class="proj__title-wrap">
            <h2 class="proj__title">${escapeHtml(p.name)}</h2>
            ${clientName}
            ${p.description ? `<p class="proj__desc">${escapeHtml(p.description)}</p>` : ''}
          </div>
          <button type="button" class="proj__add-task btn btn--ghost" data-add-task="${p.id}">+ New task</button>
        </header>
        <div class="proj__tasks">
          ${tasks.length === 0
            ? '<p class="muted">No tasks yet. Click "+ New task" to add one.</p>'
            : tasks.map(t => taskRow(t, isAdmin)).join('')}
        </div>
      </article>
    `;
  }).join('');

  // Wire task clicks + add-task buttons
  $$('[data-task-id]', root).forEach(el =>
    el.addEventListener('click', () => openTask(el.dataset.taskId)));
  $$('[data-add-task]', root).forEach(el =>
    el.addEventListener('click', () => openNewTask(el.dataset.addTask)));
}

function taskRow(t, isAdmin) {
  const due = t.due_date ? `<span class="task-row__due">due ${fmtDate(t.due_date)}</span>` : '';
  return `
    <button type="button" class="task-row" data-task-id="${t.id}">
      ${statusPill(t.status)}
      <div class="task-row__main">
        <h3>${escapeHtml(t.title)}</h3>
        <p class="task-row__desc">${escapeHtml((t.description || '').slice(0, 120))}${(t.description || '').length > 120 ? '…' : ''}</p>
      </div>
      <div class="task-row__meta">
        ${due}
        <span class="task-row__date">${fmtDate(t.created_at)}</span>
        <span class="task-row__arrow">→</span>
      </div>
    </button>
  `;
}

// ---------- TASK MODAL ----------
async function openTask(taskId) {
  state.currentTaskId = taskId;
  $('#taskModal').hidden = false;
  document.body.classList.add('modal-open');

  // Load task + files + messages
  const { data: task } = await sb.from('tasks').select('*').eq('id', taskId).single();
  if (!task) { toast('Task not found', true); closeAllModals(); return; }

  $('#modalTitle').textContent = task.title;
  $('#modalDesc').textContent = task.description || '';
  $('#modalMeta').textContent = `Created ${fmtDate(task.created_at)}${task.due_date ? ' · due ' + fmtDate(task.due_date) : ''}`;
  $('#modalStatus').outerHTML = statusPill(task.status).replace('<span class="status-pill"', '<span class="status-pill" id="modalStatus"');

  // Status changer (admin only)
  $('#modalStatusChanger').hidden = !state.isAdmin;
  if (state.isAdmin) {
    $$('#modalStatusChanger button').forEach(b => {
      b.classList.toggle('is-active', b.dataset.status === task.status);
    });
  }

  // Show deliverable upload only for admin
  $('#addDelivWrap').hidden = !state.isAdmin;

  await loadTaskFiles(taskId);
  await loadTaskMessages(taskId);
}

async function loadTaskFiles(taskId) {
  const { data: files } = await sb
    .from('task_files').select('*, uploader:profiles!task_files_uploaded_by_fkey(full_name, email)')
    .eq('task_id', taskId).order('uploaded_at', { ascending: false });
  state.currentFiles = files || [];

  const refs = state.currentFiles.filter(f => f.file_type === 'reference');
  const delivs = state.currentFiles.filter(f => f.file_type === 'deliverable');

  $('#refCount').textContent = refs.length;
  $('#delivCount').textContent = delivs.length;
  $('#refFiles').innerHTML = refs.length ? refs.map(fileItem).join('') : '<span class="muted empty">No references yet.</span>';
  $('#delivFiles').innerHTML = delivs.length ? delivs.map(fileItem).join('') : '<span class="muted empty">Nothing delivered yet — when ready, your final files appear here.</span>';

  // Wire download buttons
  $$('[data-download-file]', $('#taskModal')).forEach(el =>
    el.addEventListener('click', () => downloadFile(el.dataset.downloadFile, el.dataset.fileName)));
  $$('[data-delete-file]', $('#taskModal')).forEach(el =>
    el.addEventListener('click', () => deleteFile(el.dataset.deleteFile, el.dataset.deletePath)));
}

function fileItem(f) {
  const isImage = /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(f.file_name);
  const canDelete = f.uploaded_by === state.profile.id || state.isAdmin;
  return `
    <div class="file-item${isImage ? ' file-item--img' : ''}">
      <div class="file-item__icon">${isImage ? '🖼' : '📄'}</div>
      <div class="file-item__main">
        <div class="file-item__name" title="${escapeHtml(f.file_name)}">${escapeHtml(f.file_name)}</div>
        <div class="file-item__meta">
          <span>${fmtSize(f.file_size)}</span>
          ${f.uploader ? '<span>· ' + escapeHtml(f.uploader.full_name || f.uploader.email) + '</span>' : ''}
          <span>· ${fmtDate(f.uploaded_at)}</span>
        </div>
      </div>
      <div class="file-item__actions">
        <button type="button" class="file-item__btn" data-download-file="${f.file_path}" data-file-name="${escapeHtml(f.file_name)}" title="Download">↓</button>
        ${canDelete ? `<button type="button" class="file-item__btn file-item__btn--del" data-delete-file="${f.id}" data-delete-path="${f.file_path}" title="Delete">×</button>` : ''}
      </div>
    </div>
  `;
}

async function downloadFile(path, name) {
  const { data, error } = await sb.storage.from(STORAGE_BUCKET).createSignedUrl(path, 60);
  if (error) { toast('Download failed: ' + error.message, true); return; }
  const a = document.createElement('a');
  a.href = data.signedUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function deleteFile(id, path) {
  if (!confirm('Delete this file?')) return;
  await sb.storage.from(STORAGE_BUCKET).remove([path]);
  await sb.from('task_files').delete().eq('id', id);
  toast('File removed.');
  await loadTaskFiles(state.currentTaskId);
}

async function uploadFile(file, fileType) {
  const taskId = state.currentTaskId;
  if (!taskId) return;
  const ext = file.name.split('.').pop();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${taskId}/${Date.now()}_${safeName}`;

  toast(`Uploading ${file.name}…`);
  const { error: upErr } = await sb.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false });
  if (upErr) { toast('Upload failed: ' + upErr.message, true); return; }

  const { error: insErr } = await sb.from('task_files').insert({
    task_id: taskId, file_path: path, file_name: file.name,
    file_size: file.size, file_type: fileType, uploaded_by: state.profile.id,
  });
  if (insErr) { toast(insErr.message, true); return; }

  toast(`✓ ${file.name} uploaded`);
  await loadTaskFiles(taskId);
  if (state.isAdmin || fileType === 'reference') {
    // refresh project list to update counts (optional)
  }
}

// ---------- MESSAGES ----------
async function loadTaskMessages(taskId) {
  const { data } = await sb
    .from('task_messages')
    .select('*, user:profiles!task_messages_user_id_fkey(full_name, email, role)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  state.currentMessages = data || [];
  renderMessages();
}

function renderMessages() {
  const root = $('#thread');
  if (!state.currentMessages.length) {
    root.innerHTML = '<p class="muted empty" style="padding:14px 0">No messages yet. Start the conversation.</p>';
    return;
  }
  root.innerHTML = state.currentMessages.map(m => {
    const isMe = m.user_id === state.profile.id;
    const isAdmin = m.user?.role === 'admin';
    const name = isMe ? 'You' : (m.user?.full_name || m.user?.email || 'Someone');
    return `
      <div class="msg ${isMe ? 'msg--me' : ''} ${isAdmin ? 'msg--admin' : ''}">
        <div class="msg__head">
          <span class="msg__name">${escapeHtml(name)}${isAdmin && !isMe ? ' · vexel.media' : ''}</span>
          <span class="msg__time">${fmtDate(m.created_at)}</span>
        </div>
        <div class="msg__body">${escapeHtml(m.message).replace(/\n/g, '<br>')}</div>
      </div>
    `;
  }).join('');
  root.scrollTop = root.scrollHeight;
}

// ---------- STATUS CHANGE (admin) ----------
async function changeStatus(newStatus) {
  if (!state.isAdmin || !state.currentTaskId) return;
  const { error } = await sb.from('tasks')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', state.currentTaskId);
  if (error) { toast(error.message, true); return; }
  toast(`Status → ${STATUS[newStatus].label}`);
  // Refresh
  $('#modalStatus').outerHTML = statusPill(newStatus).replace('<span class="status-pill"', '<span class="status-pill" id="modalStatus"');
  $$('#modalStatusChanger button').forEach(b =>
    b.classList.toggle('is-active', b.dataset.status === newStatus));
  if (state.isAdmin) await loadAdminData(); else await loadClientData();
}

// ---------- MODAL HELPERS ----------
function closeAllModals() {
  $$('.modal').forEach(m => { m.hidden = true; m.setAttribute('aria-hidden', 'true'); });
  document.body.classList.remove('modal-open');
  state.currentTaskId = null;
}

// ---------- NEW PROJECT ----------
function openNewProject() {
  $('#projectModal').hidden = false;
  document.body.classList.add('modal-open');
  if (state.isAdmin) {
    $('#projectClientWrap').hidden = false;
    $('#projectClient').innerHTML = state.allClients.map(c =>
      `<option value="${c.id}">${escapeHtml(c.full_name || c.email)}${c.company ? ' · ' + escapeHtml(c.company) : ''}</option>`).join('');
  } else {
    $('#projectClientWrap').hidden = true;
  }
}

// ---------- NEW TASK ----------
function openNewTask(projectId) {
  $('#taskProjectId').value = projectId;
  $('#taskNewModal').hidden = false;
  document.body.classList.add('modal-open');
}

// ---------- WIRE EVENTS ----------
function wireEvents() {
  // Close modals
  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-modal-close]')) closeAllModals();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });

  // Sign out
  $('#logoutBtn').addEventListener('click', async () => {
    await sb.auth.signOut();
    location.replace('login.html');
  });

  // New project
  $('#newProjectBtn')?.addEventListener('click', openNewProject);
  $('#addProjectBtnAdmin')?.addEventListener('click', openNewProject);

  $('#projectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const clientId = state.isAdmin ? $('#projectClient').value : state.profile.id;
    const name = $('#projectName').value.trim();
    const description = $('#projectDesc').value.trim();
    if (!name) return;
    const { error } = await sb.from('projects').insert({ client_id: clientId, name, description });
    if (error) { toast(error.message, true); return; }
    toast('✓ Project created');
    closeAllModals();
    e.target.reset();
    if (state.isAdmin) await loadAdminData(); else await loadClientData();
  });

  // New task
  $('#taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const projectId = $('#taskProjectId').value;
    const title = $('#taskTitle').value.trim();
    const description = $('#taskDesc').value.trim();
    const due_date = $('#taskDue').value || null;
    if (!title || !description) return;
    const { error } = await sb.from('tasks').insert({
      project_id: projectId, title, description, due_date,
      created_by: state.profile.id,
    });
    if (error) { toast(error.message, true); return; }
    toast('✓ Task submitted');
    closeAllModals();
    e.target.reset();
    if (state.isAdmin) await loadAdminData(); else await loadClientData();
  });

  // Status changer
  $$('#modalStatusChanger button').forEach(b =>
    b.addEventListener('click', () => changeStatus(b.dataset.status)));

  // File uploads
  $('#addRefFile').addEventListener('change', async (e) => {
    for (const f of e.target.files) await uploadFile(f, 'reference');
    e.target.value = '';
  });
  $('#addDelivFile').addEventListener('change', async (e) => {
    for (const f of e.target.files) await uploadFile(f, 'deliverable');
    e.target.value = '';
  });

  // Comment thread
  $('#threadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#threadInput').value.trim();
    if (!msg || !state.currentTaskId) return;
    const { error } = await sb.from('task_messages').insert({
      task_id: state.currentTaskId, user_id: state.profile.id, message: msg
    });
    if (error) { toast(error.message, true); return; }
    $('#threadInput').value = '';
    await loadTaskMessages(state.currentTaskId);
  });

  // Admin filters
  $('#adminClientFilter')?.addEventListener('change', applyAdminFilter);
  $('#adminStatusFilter')?.addEventListener('change', applyAdminFilter);

  // Invite client
  $('#addClientBtn')?.addEventListener('click', () => {
    $('#inviteModal').hidden = false;
    document.body.classList.add('modal-open');
  });
  $('#inviteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#inviteEmail').value.trim();
    if (!email) return;
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.origin + '/portal.html' }
    });
    if (error) { toast(error.message, true); return; }
    toast(`✓ Magic link sent to ${email}`);
    closeAllModals();
    e.target.reset();
  });
}

// ---------- BOOT ----------
wireEvents();
init().catch(e => {
  console.error(e);
  toast('Could not load portal: ' + (e.message || e), true);
});
