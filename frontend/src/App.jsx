import { useCallback, useEffect, useState } from 'react';
import { ChatView } from './components/ChatView.jsx';
import { ContextMemoryView } from './components/ContextMemoryView.jsx';
import { DashboardView } from './components/DashboardView.jsx';
import { Header } from './components/Header.jsx';
import { RecommendationsView } from './components/RecommendationsView.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { TaskModal } from './components/TaskModal.jsx';
import { TasksView } from './components/TasksView.jsx';
import { Toast } from './components/Toast.jsx';
import { api } from './services/api.js';

export default function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [aiStatus, setAiStatus] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [messages, setMessages] = useState([]);
  const [userContext, setUserContext] = useState(null);

  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [sendingChat, setSendingChat] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [toast, setToast] = useState(null);

  const notify = useCallback((message, type = 'info') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const refreshWorkspace = useCallback(async () => {
    try {
      const [dashRes, tasksRes, chatRes] = await Promise.all([
        api.getDashboard(),
        api.getTasks(),
        api.getChatHistory()
      ]);
      setDashboard(dashRes);
      setAiStatus(dashRes.ai || chatRes.ai);
      setUserContext(dashRes.profile);
      setTasks(tasksRes.tasks || []);
      setMessages(chatRes.messages || []);
    } catch (err) {
      notify(err.message || 'Unable to connect to SmartMate backend.', 'error');
    } finally {
      setLoadingWorkspace(false);
    }
  }, [notify]);

  useEffect(() => {
    refreshWorkspace();
  }, [refreshWorkspace]);

  const handleSendMessage = async (text) => {
    setSendingChat(true);
    try {
      const res = await api.sendChatMessage(text);
      setMessages((prev) => [...prev, res.userMessage, res.assistantMessage]);
      if (res.privacy?.redacted) {
        notify(`Privacy Guard redacted: ${res.privacy.findings.join(', ')}`, 'info');
      }
      if (res.tasksChanged) {
        const [dashRes, tasksRes] = await Promise.all([api.getDashboard(), api.getTasks()]);
        setDashboard(dashRes);
        setTasks(tasksRes.tasks || []);
      } else {
        const dashRes = await api.getDashboard();
        setDashboard(dashRes);
      }
    } catch (err) {
      notify(err.message || 'Failed to process message.', 'error');
    } finally {
      setSendingChat(false);
    }
  };

  const handleClearMemory = async () => {
    try {
      await api.clearChatHistory();
      setMessages([]);
      const dashRes = await api.getDashboard();
      setDashboard(dashRes);
      notify('Conversation memory cleared.', 'success');
    } catch (err) {
      notify(err.message || 'Failed to clear memory.', 'error');
    }
  };

  const handleSaveTask = async (payload) => {
    if (editingTask) {
      await api.updateTask(editingTask.id, payload);
      notify('Task updated.', 'success');
    } else {
      await api.createTask(payload);
      notify('Task created.', 'success');
    }
    setEditingTask(null);
    await refreshWorkspace();
  };

  const handleUpdateTask = async (id, updates) => {
    try {
      await api.updateTask(id, updates);
      await refreshWorkspace();
      notify('Task status updated.', 'success');
    } catch (err) {
      notify(err.message || 'Failed to update task.', 'error');
    }
  };

  const handleDeleteTask = async (id) => {
    try {
      await api.deleteTask(id);
      await refreshWorkspace();
      notify('Task deleted.', 'success');
    } catch (err) {
      notify(err.message || 'Failed to delete task.', 'error');
    }
  };

  const handleApplyRecommendation = async (taskId, action) => {
    try {
      await api.applyRecommendation(taskId, action);
      await refreshWorkspace();
      notify(action === 'complete' ? 'Recommended task completed!' : 'Task moved to In Progress.', 'success');
    } catch (err) {
      notify(err.message || 'Could not apply recommendation.', 'error');
    }
  };

  const handleSaveContext = async (updates) => {
    try {
      const res = await api.updateContext(updates);
      setUserContext(res.context);
      const dashRes = await api.getDashboard();
      setDashboard(dashRes);
      notify('Context preferences saved and recommendations updated.', 'success');
    } catch (err) {
      notify(err.message || 'Failed to save context.', 'error');
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        aiStatus={aiStatus}
        taskStats={dashboard?.stats}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          activeTab={activeTab}
          userContext={userContext}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onNewTask={() => {
            setEditingTask(null);
            setTaskModalOpen(true);
          }}
        />

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
          {activeTab === 'chat' && (
            <ChatView
              messages={messages}
              loading={loadingWorkspace}
              sending={sendingChat}
              onSendMessage={handleSendMessage}
              onClearMemory={handleClearMemory}
              onApplyRecommendation={handleApplyRecommendation}
            />
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              dashboard={dashboard}
              tasks={tasks}
              loading={loadingWorkspace}
              onNavigate={setActiveTab}
              onApplyRecommendation={handleApplyRecommendation}
              onUpdateTask={handleUpdateTask}
            />
          )}

          {activeTab === 'tasks' && (
            <TasksView
              tasks={tasks}
              loading={loadingWorkspace}
              onCreateClick={() => {
                setEditingTask(null);
                setTaskModalOpen(true);
              }}
              onEditTask={(task) => {
                setEditingTask(task);
                setTaskModalOpen(true);
              }}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
            />
          )}

          {activeTab === 'recommendations' && (
            <RecommendationsView
              data={dashboard}
              loading={loadingWorkspace}
              onRefresh={refreshWorkspace}
              onApply={handleApplyRecommendation}
            />
          )}

          {activeTab === 'context' && (
            <ContextMemoryView
              userContext={userContext}
              messages={messages}
              onSaveContext={handleSaveContext}
              onClearMemory={handleClearMemory}
            />
          )}
        </main>
      </div>

      <TaskModal
        open={taskModalOpen}
        initialTask={editingTask}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
