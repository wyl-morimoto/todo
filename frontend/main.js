document.addEventListener('DOMContentLoaded', () => {
    const taskList = document.getElementById('task-list');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const addTaskForm = document.getElementById('add-task-form');
    const addTaskContainer = document.getElementById('add-task-container');
    const sortDueDateBtn = document.getElementById('sort-due-date');
    
    let currentTab = 'active'; // 'active' or 'completed'
    let tasks = [];
    let dueSortDirection = 'asc'; // 初期値は昇順 (近い順)

    // 今日の日付をセット
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('new-entry-date').value = today;

    // 初期ロード
    fetchTasks();

    // しばらく放置してからの復帰時にデータを再取得＆サーバーを活性化（アイドル対策）
    let lastActivityTime = Date.now();
    const WAKE_UP_THRESHOLD = 3 * 60 * 1000; // 3分

    function handleActivity() {
        const now = Date.now();
        if (now - lastActivityTime > WAKE_UP_THRESHOLD) {
            console.log('アイドル状態からの復帰を検知。サーバーを活性化・データを最新化します。');
            fetchTasks();
        }
        lastActivityTime = now;
    }

    // イベントの発火頻度を抑える
    let activityTimer = null;
    function throttleActivity() {
        if (!activityTimer) {
            activityTimer = setTimeout(() => {
                handleActivity();
                activityTimer = null;
            }, 1000);
        }
    }

    document.addEventListener('mousemove', throttleActivity);
    document.addEventListener('keydown', throttleActivity);
    document.addEventListener('mousedown', throttleActivity);
    document.addEventListener('touchstart', throttleActivity);

    // タブ切り替え
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            
            if (currentTab === 'completed') {
                addTaskContainer.classList.add('hidden');
            } else {
                addTaskContainer.classList.remove('hidden');
            }
            renderTasks();
        });
    });

    // 期日ソートボタン
    if (sortDueDateBtn) {
        sortDueDateBtn.addEventListener('click', () => {
            dueSortDirection = dueSortDirection === 'asc' ? 'desc' : 'asc';
            sortDueDateBtn.innerHTML = dueSortDirection === 'asc' ? '期日 🔼' : '期日 🔽';
            renderTasks();
        });
    }

    // タスク追加
    if (addTaskForm) {
        addTaskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = addTaskForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;

            const newTask = {
                content: document.getElementById('new-content').value,
                entry_date: document.getElementById('new-entry-date').value,
                urgent: document.getElementById('new-urgent').checked,
                due_date: document.getElementById('new-due-date').value,
                assignee: document.getElementById('new-assignee').value,
                completed: false
            };

            try {
                const res = await fetch('/api/tasks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newTask)
                });
                if (res.ok) {
                    document.getElementById('new-content').value = '';
                    document.getElementById('new-urgent').checked = false;
                    document.getElementById('new-due-date').value = '';
                    document.getElementById('new-assignee').value = '';
                    await fetchTasks();
                }
            } catch (error) {
                console.error('Failed to add task', error);
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    async function fetchTasks() {
        try {
            // キャッシュを利用せず最新のデータを確実に取得する
            const res = await fetch('/api/tasks', { cache: 'no-store' });
            if (!res.ok) throw new Error('API Response was not ok');
            tasks = await res.json();
            renderTasks();
        } catch (error) {
            console.error('Failed to fetch tasks', error);
        }
    }

    function getSortedTasks(tasksList) {
        return tasksList.sort((a, b) => {
            // 空の日付は一番最後に回す処理
            const dateA = a.due_date || (dueSortDirection === 'asc' ? '9999-12-31' : '0000-00-00');
            const dateB = b.due_date || (dueSortDirection === 'asc' ? '9999-12-31' : '0000-00-00');
            
            if (dateA < dateB) return dueSortDirection === 'asc' ? -1 : 1;
            if (dateA > dateB) return dueSortDirection === 'asc' ? 1 : -1;
            
            // 期日が同じ場合はIDでソート (安定したソート)
            if (a.id > b.id) return -1;
            if (a.id < b.id) return 1;
            
            return 0;
        });
    }

    function renderTasks() {
        taskList.innerHTML = '';
        
        let filteredTasks = tasks.filter(task => 
            currentTab === 'active' ? !task.completed : task.completed
        );

        // ソートを適用
        filteredTasks = getSortedTasks(filteredTasks);

        if (filteredTasks.length === 0) {
            const emptyMsg = currentTab === 'active' ? '未完了のタスクはありません 🎉' : '完了済みのタスクはありません';
            taskList.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 40px; color: var(--text-secondary); font-size: 0.95rem;">${emptyMsg}</td></tr>`;
            return;
        }

        filteredTasks.forEach(task => {
            const tr = document.createElement('tr');
            tr.className = 'fade-in-row';
            if (task.completed) tr.classList.add('row-completed');
            
            tr.innerHTML = `
                <td class="col-content">
                    <input type="text" value="${escapeHtml(task.content)}" data-id="${task.id}" data-field="content" />
                </td>
                <td class="col-date">
                    <input type="date" value="${task.entry_date}" data-id="${task.id}" data-field="entry_date" />
                </td>
                <td class="col-urgent">
                    <label class="checkbox-container urgent-cb">
                        <input type="checkbox" ${task.urgent ? 'checked' : ''} data-id="${task.id}" data-field="urgent" />
                        <span class="checkmark"></span>
                    </label>
                </td>
                <td class="col-date">
                    <input type="date" value="${task.due_date || ''}" data-id="${task.id}" data-field="due_date" />
                </td>
                <td class="col-assignee">
                    <select data-id="${task.id}" data-field="assignee">
                        <option value=""></option>
                        <option value="森本" ${task.assignee === '森本' ? 'selected' : ''}>森本</option>
                        <option value="黒瀬" ${task.assignee === '黒瀬' ? 'selected' : ''}>黒瀬</option>
                        <option value="浅井" ${task.assignee === '浅井' ? 'selected' : ''}>浅井</option>
                    </select>
                </td>
                <td class="col-status">
                    <label class="checkbox-container status-cb">
                        <input type="checkbox" class="complete-toggle" ${task.completed ? 'checked' : ''} data-id="${task.id}" data-field="completed" />
                        <span class="checkmark"></span>
                    </label>
                </td>
                <td class="col-actions">
                    <button class="action-btn delete-btn" data-id="${task.id}" title="削除">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </td>
            `;
            
            const deleteBtn = tr.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', () => deleteTask(task.id));

            const inputs = tr.querySelectorAll('input:not(.complete-toggle), select');
            inputs.forEach(input => {
                input.addEventListener('change', (e) => {
                    const field = e.target.dataset.field;
                    let value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                    // カレンダー操作等でリフレッシュが必要になるため、日付を更新した場合は自動ソート＆再描画
                    updateTask(task.id, { [field]: value }, true);
                });
            });

            const toggle = tr.querySelector('.complete-toggle');
            toggle.addEventListener('change', (e) => {
                const isCompleted = e.target.checked;
                // 表示上は即座に反映させる
                if (isCompleted) {
                    tr.classList.add('row-completed');
                } else {
                    tr.classList.remove('row-completed');
                }
                
                setTimeout(() => {
                    updateTask(task.id, { completed: isCompleted }, true);
                }, 300);
            });

            taskList.appendChild(tr);
        });
    }

    async function updateTask(id, updates, shouldRefetch = false) {
        try {
            const res = await fetch(`/api/tasks/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            if (res.ok && shouldRefetch) {
                fetchTasks();
            }
        } catch (error) {
            console.error('Failed to update task', error);
        }
    }

    async function deleteTask(id) {
        if (!confirm('本当に削除しますか？')) return;
        try {
            const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchTasks();
            }
        } catch (error) {
            console.error('Failed to delete task', error);
        }
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
});
