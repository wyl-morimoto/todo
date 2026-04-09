document.addEventListener('DOMContentLoaded', () => {
    const taskList = document.getElementById('task-list');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const addTaskForm = document.getElementById('add-task-form');
    const addTaskContainer = document.getElementById('add-task-container');
    
    let currentTab = 'active'; // 'active' or 'completed'
    let tasks = [];

    // 今日の日付をセット
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('new-entry-date').value = today;

    // 初期ロード
    fetchTasks();

    // タブ切り替え
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            
            // 完了タブの場合は追加フォームを隠す
            if (currentTab === 'completed') {
                addTaskContainer.classList.add('hidden');
            } else {
                addTaskContainer.classList.remove('hidden');
            }
            
            renderTasks();
        });
    });

    // タスク追加
    addTaskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
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
                // リセット（記入日は維持）
                document.getElementById('new-content').value = '';
                document.getElementById('new-urgent').checked = false;
                document.getElementById('new-due-date').value = '';
                document.getElementById('new-assignee').value = '';
                
                await fetchTasks();
            }
        } catch (error) {
            console.error('Failed to add task', error);
        }
    });

    async function fetchTasks() {
        try {
            const res = await fetch('/api/tasks');
            if (!res.ok) throw new Error('API Response was not ok');
            tasks = await res.json();
            renderTasks();
        } catch (error) {
            console.error('Failed to fetch tasks', error);
        }
    }

    function renderTasks() {
        taskList.innerHTML = '';
        
        const filteredTasks = tasks.filter(task => 
            currentTab === 'active' ? !task.completed : task.completed
        );

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
                        <option value="椿" ${task.assignee === '椿' ? 'selected' : ''}>椿</option>
                        <option value="福石" ${task.assignee === '福石' ? 'selected' : ''}>福石</option>
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
            
            // 削除イベント
            const deleteBtn = tr.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', () => deleteTask(task.id));

            // 入力変更イベント（自動保存）
            const inputs = tr.querySelectorAll('input:not(.complete-toggle), select');
            inputs.forEach(input => {
                input.addEventListener('change', (e) => {
                    const field = e.target.dataset.field;
                    let value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                    updateTask(task.id, { [field]: value });
                });
            });

            // 完了トグルイベント（アニメーションを見せるため少しディレイ）
            const toggle = tr.querySelector('.complete-toggle');
            toggle.addEventListener('change', (e) => {
                const isCompleted = e.target.checked;
                setTimeout(() => {
                    updateTask(task.id, { completed: isCompleted }, true);
                }, 300); // 300ms delay to let the animation play
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
            // Background update doesn't strictly need refetch unless state moves tab
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
