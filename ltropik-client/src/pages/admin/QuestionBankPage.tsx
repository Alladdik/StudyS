import { useEffect, useState, useRef } from 'react';
import { Layout } from '../../components/Layout';
import api from '../../api/client';
import type { QuestionBankItem } from '../../types';
import { Card, Modal, Loader, EmptyState, Badge, toast, cx } from '../../components/ui';
import { getCourses } from '../../api/courses';
import { getUsers } from '../../api/users';
import { TestBuilderChat, type AiQuestion } from '../../components/TestBuilderChat';

type QType = 'Single' | 'Multi' | 'Text';
type TabType = 'questions' | 'tests';

export function QuestionBankPage() {
  const [activeTab, setActiveTab] = useState<TabType>('questions');
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<QuestionBankItem | null>(null);

  // Question Form
  const [text, setText] = useState('');
  const [type, setType] = useState<QType>('Single');
  const [options, setOptions] = useState([{ text: '', isCorrect: false }]);
  const [tags, setTags] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);

  // Tests List & states
  const [tests, setTests] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [showTestForm, setShowTestForm] = useState(false);
  const [editTestItem, setEditTestItem] = useState<any | null>(null);

  // Test Form
  const [testTitle, setTestTitle] = useState('');
  const [testTimeLimit, setTestTimeLimit] = useState(0);
  const [testMaxAttempts, setTestMaxAttempts] = useState(1);
  const [testPassingPercentage, setTestPassingPercentage] = useState(60);
  const [testCourseId, setTestCourseId] = useState('');
  const [testModuleId, setTestModuleId] = useState('');
  const [testLessonId, setTestLessonId] = useState('');
  const [testModules, setTestModules] = useState<any[]>([]);
  const [testLessons, setTestLessons] = useState<any[]>([]);
  const [testQuestions, setTestQuestions] = useState<any[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Record<string, boolean>>({});
  const [allStudentsAllowed, setAllStudentsAllowed] = useState(true);
  const [allowedStudentIdsMap, setAllowedStudentIdsMap] = useState<Record<string, boolean>>({});
  const [testSaving, setTestSaving] = useState(false);

  // AI Quiz Generator states
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiSourceText, setAiSourceText] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  // AI Test Builder Chat
  const [showAiBuilder, setShowAiBuilder] = useState(false);

  // Attempt viewing states
  const [showAttemptsModal, setShowAttemptsModal] = useState(false);
  const [viewingTestTitle, setViewingTestTitle] = useState<string>('');
  const [attempts, setAttempts] = useState<any[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  
  // Single attempt report detail view
  const [selectedAttempt, setSelectedAttempt] = useState<any | null>(null);

  const importFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchItems();
    fetchTests();
    getCourses().then(r => setCourses(r.data)).catch(() => {});
    getUsers({ role: 'Student', pageSize: 1000 }).then(r => {
      setStudents(r.data.items.map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email })));
    }).catch(() => {});
  }, []);

  async function fetchItems() {
    setLoading(true);
    try {
      const r = await api.get<QuestionBankItem[]>('/questionbank');
      setItems(r.data);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTests() {
    try {
      const r = await api.get<any[]>('/tests');
      setTests(r.data);
    } catch {}
  }

  // Course dropdown tree selection helper
  async function handleCourseChange(cId: string) {
    setTestCourseId(cId);
    setTestModuleId('');
    setTestLessonId('');
    setTestLessons([]);
    if (!cId) {
      setTestModules([]);
      return;
    }
    try {
      const { data } = await api.get(`/courses/${cId}`);
      setTestModules(data.modules || []);
    } catch {
      setTestModules([]);
    }
  }

  function handleModuleChange(mId: string) {
    setTestModuleId(mId);
    setTestLessonId('');
    const module = testModules.find(m => m.id === mId);
    setTestLessons(module ? module.lessons : []);
  }

  // --- Question Bank Operations ---
  function openCreate() {
    setEditItem(null); setText(''); setType('Single');
    setOptions([{ text: '', isCorrect: false }]); setTags(''); setCategory('');
    setShowForm(true);
  }

  function openEdit(item: QuestionBankItem) {
    setEditItem(item); setText(item.text); setType(item.type);
    setOptions(item.options.length ? item.options : [{ text: '', isCorrect: false }]);
    setTags(item.tags ?? ''); setCategory(item.category ?? '');
    setShowForm(true);
  }

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const payload = { text, type, options: type === 'Text' ? [] : options.filter((o) => o.text.trim()), tags: tags || null, category: category || null };
      if (editItem) await api.put(`/questionbank/${editItem.id}`, payload);
      else await api.post('/questionbank', payload);
      setShowForm(false);
      await fetchItems();
      toast('success', 'Питання збережено!');
    } catch {
      toast('error', 'Не вдалося зберегти питання');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Видалити це питання з банку?')) return;
    try {
      await api.delete(`/questionbank/${id}`);
      setItems((p) => p.filter((i) => i.id !== id));
      toast('success', 'Питання видалено');
    } catch {
      toast('error', 'Помилка видалення');
    }
  }

  // --- Test Operations ---
  async function openCreateTest() {
    setEditTestItem(null);
    setTestTitle('');
    setTestTimeLimit(0);
    setTestMaxAttempts(1);
    setTestPassingPercentage(60);
    setTestCourseId('');
    setTestModuleId('');
    setTestLessonId('');
    setTestModules([]);
    setTestLessons([]);
    setAllStudentsAllowed(true);
    setAllowedStudentIdsMap({});
    
    // Select all questions in the bank by default or leave empty
    const questionSelections: Record<string, boolean> = {};
    items.forEach(item => {
      questionSelections[item.id] = false;
    });
    setSelectedQuestions(questionSelections);
    setTestQuestions([]);
    setShowTestForm(true);
  }

  async function openEditTest(test: any) {
    setEditTestItem(test);
    setTestTitle(test.title);
    setTestTimeLimit(test.timeLimitMinutes);
    setTestMaxAttempts(test.maxAttempts);
    setTestPassingPercentage(test.passingPercentage);
    
    // Load full test detail to check lesson context & questions
    try {
      const { data } = await api.get(`/tests/${test.id}`);
      
      // Set allowed students selection
      if (test.allowedStudentIds) {
        setAllStudentsAllowed(false);
        const map: Record<string, boolean> = {};
        test.allowedStudentIds.split(',').forEach((sId: string) => {
          if (sId.trim()) map[sId.trim()] = true;
        });
        setAllowedStudentIdsMap(map);
      } else {
        setAllStudentsAllowed(true);
        setAllowedStudentIdsMap({});
      }

      // Check module tree from backend
      // First, get lesson and find course
      const lessonRes = await api.get(`/lessons/detail/${test.lessonId}`).catch(() => null);
      if (lessonRes) {
        const { courseId, moduleId } = lessonRes.data;
        setTestCourseId(courseId);
        const courseRes = await api.get(`/courses/${courseId}`);
        setTestModules(courseRes.data.modules || []);
        
        setTestModuleId(moduleId);
        const activeMod = courseRes.data.modules.find((m: any) => m.id === moduleId);
        setTestLessons(activeMod ? activeMod.lessons : []);
        setTestLessonId(test.lessonId);
      }

      // Populate test questions selected
      const selections: Record<string, boolean> = {};
      items.forEach(q => {
        selections[q.id] = data.questions.some((tq: any) => tq.text === q.text);
      });
      setSelectedQuestions(selections);
      
      // Also map internal test questions
      setTestQuestions(data.questions);
    } catch {
      toast('error', 'Не вдалося завантажити деталі тесту');
    }
    
    setShowTestForm(true);
  }

  async function handleSaveTest() {
    if (!testTitle.trim()) return toast('error', 'Введіть назву тесту');
    if (!testLessonId) return toast('error', 'Оберіть урок для тесту');

    // Compile questions array for server
    const questionsToSave: any[] = [];
    
    // 1. Gather selected questions from Bank
    Object.entries(selectedQuestions).forEach(([qId, isSelected]) => {
      if (!isSelected) return;
      const bankQ = items.find(i => i.id === qId);
      if (!bankQ) return;
      
      questionsToSave.push({
        id: bankQ.id,
        type: bankQ.type.toLowerCase(),
        text: bankQ.text,
        options: bankQ.options,
        correctAnswer: bankQ.options.find(o => o.isCorrect)?.text || '',
        correctAnswers: bankQ.options.filter(o => o.isCorrect).map(o => o.text)
      });
    });

    // 2. Gather custom imported/AI questions
    testQuestions.forEach(tq => {
      if (questionsToSave.some(q => q.text === tq.text)) return;
      questionsToSave.push({
        id: tq.id || Math.random().toString(36).substr(2, 9),
        type: tq.type.toLowerCase(),
        text: tq.text,
        options: tq.options,
        correctAnswer: tq.correctAnswer || tq.options?.find((o: any) => o.isCorrect)?.text || '',
        correctAnswers: tq.correctAnswers || tq.options?.filter((o: any) => o.isCorrect).map((o: any) => o.text) || []
      });
    });

    if (questionsToSave.length === 0) {
      return toast('error', 'Оберіть хоча б одне питання для тесту');
    }

    const allowedStudentIds = allStudentsAllowed 
      ? '' 
      : Object.entries(allowedStudentIdsMap)
          .filter(([_, isAllowed]) => isAllowed)
          .map(([id]) => id)
          .join(',');

    setTestSaving(true);
    try {
      const payload = {
        title: testTitle,
        timeLimitMinutes: Number(testTimeLimit),
        maxAttempts: Number(testMaxAttempts),
        passingPercentage: Number(testPassingPercentage),
        questions: questionsToSave
      };

      if (editTestItem) {
        await api.put(`/tests/${editTestItem.id}?allowedStudentIds=${allowedStudentIds}`, payload);
        toast('success', 'Тест успішно оновлено!');
      } else {
        await api.post(`/tests?lessonId=${testLessonId}&allowedStudentIds=${allowedStudentIds}`, payload);
        toast('success', 'Тест успішно створено!');
      }
      
      setShowTestForm(false);
      fetchTests();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Помилка збереження тесту');
    } finally {
      setTestSaving(false);
    }
  }

  async function handleDeleteTest(id: string) {
    if (!confirm('Ви впевнені, що хочете видалити цей тест? Усі спроби студентів будуть також видалені.')) return;
    try {
      await api.delete(`/tests/${id}`);
      setTests(prev => prev.filter(t => t.id !== id));
      toast('success', 'Тест успішно видалено!');
    } catch {
      toast('error', 'Не вдалося видалити тест');
    }
  }

  // --- AI generation inside test builder ---
  async function handleGenerateAiQuiz() {
    if (!aiSourceText.trim()) return;
    setAiGenerating(true);
    try {
      const { data } = await api.post('/tests/generate-from-text', aiSourceText);
      // Auto-insert questions into local Test Questions and check them
      if (Array.isArray(data)) {
        setTestQuestions(prev => [...prev, ...data]);
        
        // Also save these generated questions to the question bank!
        for (const q of data) {
          const formattedOptions = q.options.map((o: any) => ({
            text: o.text,
            isCorrect: q.type === 'single' 
              ? o.id === q.correctAnswer 
              : q.correctAnswers?.includes(o.id) || o.isCorrect === true
          }));
          await api.post('/questionbank', {
            text: q.text,
            type: q.type === 'single' ? 'Single' : q.type === 'multiple' ? 'Multi' : 'Text',
            options: formattedOptions,
            category: category || 'Генерація ШІ',
            tags: tags || 'AI'
          });
        }
        await fetchItems(); // reload question bank

        toast('success', `ШІ успішно згенерував ${data.length} питань та зберіг у Банк!`);
        setShowAiModal(false);
        setAiSourceText('');
      } else {
        toast('error', 'ШІ повернув некоректний формат питань');
      }
    } catch {
      toast('error', 'Помилка ШІ генерації тесту');
    } finally {
      setAiGenerating(false);
    }
  }

  // --- JSON Import/Export ---
  function handleExportTest(testItem: any) {
    api.get(`/tests/${testItem.id}`).then((r) => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(r.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `${testItem.title}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast('success', 'Тест експортовано у файл');
    }).catch(() => toast('error', 'Не вдалося експортувати тест'));
  }

  function handleImportTestFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (!parsed.title || !parsed.questions) {
          toast('error', 'Невірний формат файлу тесту JSON');
          return;
        }
        
        // Auto pre-fill
        setTestTitle(parsed.title);
        setTestTimeLimit(parsed.timeLimitMinutes ?? 0);
        setTestMaxAttempts(parsed.maxAttempts ?? 1);
        setTestPassingPercentage(parsed.passingPercentage ?? 60);
        
        // Map imported questions
        const imported = parsed.questions.map((q: any) => ({
          id: q.id || Math.random().toString(36).substr(2, 9),
          type: q.type || 'single',
          text: q.text || '',
          options: q.options || [],
          correctAnswer: q.correctAnswer || '',
          correctAnswers: q.correctAnswers || []
        }));
        
        setTestQuestions(imported);
        
        // Auto check bank options if match
        const selections: Record<string, boolean> = {};
        items.forEach(bq => {
          selections[bq.id] = imported.some((iq: any) => iq.text === bq.text);
        });
        setSelectedQuestions(selections);

        setEditTestItem(null);
        setTestCourseId('');
        setTestModuleId('');
        setTestLessonId('');
        setTestModules([]);
        setTestLessons([]);
        setAllStudentsAllowed(true);
        setAllowedStudentIdsMap({});

        setShowTestForm(true);
        toast('success', 'Тест завантажено! Оберіть урок та збережіть.');
      } catch {
        toast('error', 'Помилка зчитування файлу тесту');
      }
    };
    reader.readAsText(file);
    if (importFileInputRef.current) importFileInputRef.current.value = '';
  }

  // --- Student Attempts list and details ---
  async function openAttempts(test: any) {
    setViewingTestTitle(test.title);
    setAttempts([]);
    setSelectedAttempt(null);
    setShowAttemptsModal(true);
    setAttemptsLoading(true);
    try {
      const { data } = await api.get(`/tests/${test.id}/attempts`);
      setAttempts(data);
    } catch {
      toast('error', 'Не вдалося завантажити спроби');
    } finally {
      setAttemptsLoading(false);
    }
  }

  // ── AI Builder save ────────────────────────────────────────────────────────
  async function handleAiBuilderSave(aiQuestions: AiQuestion[], title: string) {
    try {
      // Save each question to question bank
      for (const q of aiQuestions) {
        const formattedOptions = q.options?.map(o => ({
          text: o.text,
          isCorrect: q.type === 'single'
            ? o.id === q.correctAnswer
            : q.correctAnswers?.includes(o.id) ?? false,
        })) ?? [];

        await api.post('/questionbank', {
          text: q.text,
          type: q.type === 'single' ? 'Single' : q.type === 'multiple' ? 'Multi' : 'Text',
          options: formattedOptions,
          category: title,
          tags: 'AI-конструктор',
        });
      }
      await fetchItems();
      toast('success', `✅ ${aiQuestions.length} питань збережено в Банк питань під категорією «${title}»`);
      setActiveTab('questions');
    } catch {
      toast('error', 'Помилка збереження питань');
    }
  }

  function formatDuration(start: string, finish: string) {
    const s = new Date(start).getTime();
    const f = new Date(finish).getTime();
    const diffSecs = Math.max(0, Math.floor((f - s) / 1000));
    const mins = Math.floor(diffSecs / 60);
    const secs = diffSecs % 60;
    return mins > 0 ? `${mins} хв ${secs} сек` : `${secs} сек`;
  }

  return (
    <Layout title="Банк питань та тести" subtitle="Управляйте базою тестових питань та створюйте тести">
      
      {/* Tabs bar */}
      <div className="flex gap-2 border-b border-ink-100 dark:border-[#1c3a2a] pb-3 mb-5">
        <button
          onClick={() => setActiveTab('questions')}
          className={cx('px-4 py-2 text-sm font-bold rounded-xl transition',
            activeTab === 'questions' ? 'bg-brand-600 text-white shadow-sm' : 'bg-transparent text-ink-500 dark:text-[#9aa2bd] hover:bg-ink-50 dark:hover:bg-[#102a1d]')}
        >
          ❓ Банк питань ({items.length})
        </button>
        <button
          onClick={() => setActiveTab('tests')}
          className={cx('px-4 py-2 text-sm font-bold rounded-xl transition',
            activeTab === 'tests' ? 'bg-brand-600 text-white shadow-sm' : 'bg-transparent text-ink-500 dark:text-[#9aa2bd] hover:bg-ink-50 dark:hover:bg-[#102a1d]')}
        >
          📝 Власні тести ({tests.length})
        </button>
      </div>

      {activeTab === 'questions' ? (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={openCreate} className="btn btn-primary">+ Нове питання</button>
          </div>

          {loading ? (
            <Loader />
          ) : items.length === 0 ? (
            <EmptyState icon="❓" title="Банк порожній" hint="Додайте перше питання" />
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge tone="brand">{item.type === 'Single' ? 'Одна відповідь' : item.type === 'Multi' ? 'Кілька відповідей' : 'Текст'}</Badge>
                        {item.category && <Badge tone="amber">{item.category}</Badge>}
                        {item.tags && item.tags.split(',').map((t, i) => (
                          <span key={i} className="chip text-xs bg-ink-100 dark:bg-[#163a28] text-ink-500 dark:text-[#9aa2bd]">{t.trim()}</span>
                        ))}
                      </div>
                      <p className="font-bold text-ink-850 mb-2">{item.text}</p>
                      {item.type !== 'Text' && (
                        <div className="flex flex-col gap-1">
                          {item.options.map((o, i) => (
                            <div key={i} className={cx('text-sm px-2 py-1 rounded-lg', o.isCorrect ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-ink-500')}>
                              {o.isCorrect ? '✓' : '○'} {o.text}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => openEdit(item)} className="btn btn-soft text-xs py-1.5 px-3">Редагувати</button>
                      <button onClick={() => handleDelete(item.id)} className="btn text-xs py-1.5 px-3 text-rose-500 hover:bg-rose-50">Видалити</button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".json"
                ref={importFileInputRef}
                onChange={handleImportTestFile}
                className="hidden"
              />
              <button 
                onClick={() => importFileInputRef.current?.click()} 
                className="btn btn-soft text-xs py-2 px-3 flex items-center gap-2"
              >
                📥 Імпорт JSON
              </button>
            </div>
            <button
              onClick={() => setShowAiBuilder(true)}
              className="btn text-sm py-2 px-4 text-white font-bold flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
            >
              🤖 AI-конструктор
            </button>
            <button onClick={openCreateTest} className="btn btn-primary">+ Створити тест</button>
          </div>

          {tests.length === 0 ? (
            <EmptyState icon="📝" title="Тестів немає" hint="Створіть свій перший тест та призначте його учням" />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {tests.map((test) => (
                <Card key={test.id} className="p-5 flex flex-col justify-between gap-4">
                  <div>
                    <h3 className="font-extrabold text-ink-900 dark:text-white text-lg mb-1 truncate">{test.title}</h3>
                    <p className="text-xs text-ink-400 mb-3">
                      Курс: <span className="font-semibold text-ink-600">{test.courseTitle}</span> / Урок: <span className="font-semibold text-ink-600">{test.lessonTitle}</span>
                    </p>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3 text-ink-600">
                      <div className="bg-ink-50/50 dark:bg-[#102a1d]/50 p-2 rounded-lg">⏱ Час: <strong>{test.timeLimitMinutes > 0 ? `${test.timeLimitMinutes} хв` : '∞'}</strong></div>
                      <div className="bg-ink-50/50 dark:bg-[#102a1d]/50 p-2 rounded-lg">🎓 Спроб: <strong>{test.maxAttempts}</strong></div>
                      <div className="bg-ink-50/50 dark:bg-[#102a1d]/50 p-2 rounded-lg">🎯 Прохідний: <strong>{test.passingPercentage}%</strong></div>
                      <div className="bg-ink-50/50 dark:bg-[#102a1d]/50 p-2 rounded-lg">❓ Питань: <strong>{test.questionsCount}</strong></div>
                    </div>

                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <Badge tone={test.allowedStudentIds ? 'amber' : 'green'}>
                        {test.allowedStudentIds ? '🔒 Обмежений доступ' : '🌍 Доступний всім'}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex gap-2 border-t border-ink-50 pt-3 flex-wrap">
                    <button onClick={() => openEditTest(test)} className="btn btn-soft text-xs py-1.5 px-3 flex-1">✏️ Ред.</button>
                    <button onClick={() => openAttempts(test)} className="btn btn-soft text-xs py-1.5 px-3 flex-1 !bg-indigo-50 !text-indigo-600 hover:!bg-indigo-100">📊 Спроби</button>
                    <button onClick={() => handleExportTest(test)} className="btn btn-soft text-xs py-1.5 px-2.5" title="Експорт JSON">💾</button>
                    <button onClick={() => handleDeleteTest(test.id)} className="btn text-xs py-1.5 px-2.5 text-rose-500 hover:bg-rose-50" title="Видалити">✕</button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* --- Question Edit Modal --- */}
      <Modal open={showForm} onClose={() => setShowForm(false)} className="max-w-lg">
        <div className="p-6">
          <h2 className="font-extrabold text-ink-900 dark:text-white text-lg mb-5">{editItem ? 'Редагувати питання' : 'Нове питання'}</h2>
          <div className="flex flex-col gap-4">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
              className="input resize-none" placeholder="Текст питання" />
            <div>
              <label className="label">Тип</label>
              <select value={type} onChange={(e) => setType(e.target.value as QType)} className="input">
                <option value="Single">Одна правильна відповідь</option>
                <option value="Multi">Кілька правильних відповідей</option>
                <option value="Text">Текстова відповідь</option>
              </select>
            </div>

            {type !== 'Text' && (
              <div>
                <label className="label">Відповіді</label>
                <div className="flex flex-col gap-2">
                  {options.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type={type === 'Single' ? 'radio' : 'checkbox'} checked={o.isCorrect}
                        onChange={(e) => {
                          const updated = [...options];
                          if (type === 'Single') updated.forEach((u, j) => u.isCorrect = j === i);
                          else updated[i] = { ...o, isCorrect: e.target.checked };
                          setOptions(updated);
                        }} className="w-4 h-4 accent-brand-600" />
                      <input value={o.text} onChange={(e) => { const u = [...options]; u[i] = { ...o, text: e.target.value }; setOptions(u); }}
                        className="input py-1.5 flex-1 text-sm" placeholder={`Варіант ${i + 1}`} />
                      {options.length > 1 && (
                        <button onClick={() => setOptions(options.filter((_, j) => j !== i))} className="text-ink-300 hover:text-rose-500">✕</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setOptions([...options, { text: '', isCorrect: false }])}
                    className="text-xs text-brand-600 hover:text-brand-700 font-bold text-left">+ Додати варіант</button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Категорія</label>
                <input value={category} onChange={(e) => setCategory(e.target.value)} className="input text-sm py-1.5" placeholder="Математика…" />
              </div>
              <div>
                <label className="label">Теги (через кому)</label>
                <input value={tags} onChange={(e) => setTags(e.target.value)} className="input text-sm py-1.5" placeholder="алгебра, рівняння…" />
              </div>
            </div>

            <button onClick={handleSave} disabled={saving || !text.trim()} className="btn btn-primary w-full py-2.5">
              {saving ? 'Збереження…' : 'Зберегти'}
            </button>
          </div>
        </div>
      </Modal>

      {/* --- Test Create/Edit Modal --- */}
      <Modal open={showTestForm} onClose={() => setShowTestForm(false)} className="max-w-3xl">
        <div className="p-6 max-h-[85vh] overflow-y-auto">
          <h2 className="font-extrabold text-ink-900 dark:text-white text-xl mb-4">{editTestItem ? '✏️ Редагувати тест' : '✨ Новий тест'}</h2>
          
          <div className="grid md:grid-cols-2 gap-5 mb-5">
            {/* Left side parameters */}
            <div className="flex flex-col gap-4">
              <div>
                <label className="label">Назва тесту</label>
                <input value={testTitle} onChange={e => setTestTitle(e.target.value)} className="input" placeholder="Напр. Фізика: Контрольна робота №1" />
              </div>

              {/* Lesson selection */}
              <div>
                <label className="label">Зв'язок з уроком</label>
                <div className="flex flex-col gap-2 bg-ink-50/50 dark:bg-[#102a1d]/50 p-3 rounded-2xl">
                  <select value={testCourseId} onChange={e => handleCourseChange(e.target.value)} className="input text-xs py-1.5">
                    <option value="">— Оберіть курс —</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                  <select value={testModuleId} onChange={e => handleModuleChange(e.target.value)} disabled={!testCourseId} className="input text-xs py-1.5">
                    <option value="">— Оберіть модуль —</option>
                    {testModules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                  <select value={testLessonId} onChange={e => setTestLessonId(e.target.value)} disabled={!testModuleId} className="input text-xs py-1.5">
                    <option value="">— Оберіть урок —</option>
                    {testLessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                  </select>
                </div>
              </div>

              {/* Limits config */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label text-xs">Час (хв, 0=∞)</label>
                  <input type="number" min="0" value={testTimeLimit} onChange={e => setTestTimeLimit(Number(e.target.value))} className="input text-sm text-center" />
                </div>
                <div>
                  <label className="label text-xs">Макс спроб</label>
                  <input type="number" min="1" value={testMaxAttempts} onChange={e => setTestMaxAttempts(Number(e.target.value))} className="input text-sm text-center" />
                </div>
                <div>
                  <label className="label text-xs">Прохідний (%)</label>
                  <input type="number" min="1" max="100" value={testPassingPercentage} onChange={e => setTestPassingPercentage(Number(e.target.value))} className="input text-sm text-center" />
                </div>
              </div>

              {/* Access control Students */}
              <div className="border-t border-ink-100 dark:border-[#1c3a2a] pt-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="label !mb-0 font-bold">Доступ до тесту</label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-brand-650">
                    <input type="checkbox" checked={allStudentsAllowed} onChange={e => setAllStudentsAllowed(e.target.checked)} className="accent-brand-600" />
                    Всі студенти
                  </label>
                </div>
                {!allStudentsAllowed && (
                  <div className="border border-ink-150 dark:border-[#1f4d36] rounded-xl p-3 max-h-40 overflow-y-auto flex flex-col gap-1.5">
                    {students.map(st => (
                      <label key={st.id} className="flex items-center gap-2 text-xs cursor-pointer text-ink-700 hover:text-ink-950 font-medium">
                        <input
                          type="checkbox"
                          checked={!!allowedStudentIdsMap[st.id]}
                          onChange={e => setAllowedStudentIdsMap(prev => ({ ...prev, [st.id]: e.target.checked }))}
                          className="accent-brand-600"
                        />
                        {st.name} ({st.email})
                      </label>
                    ))}
                    {students.length === 0 && <p className="text-[10px] text-ink-400 italic">Студентів в базі немає</p>}
                  </div>
                )}
              </div>
            </div>

            {/* Right side: Questions selector */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="label !mb-0 font-bold">Оберіть питання для тесту</label>
                <button
                  onClick={() => setShowAiModal(true)}
                  className="btn btn-soft py-1 px-2.5 text-[10px] !bg-indigo-50 !text-indigo-600 hover:!bg-indigo-100 font-bold"
                >
                  🤖 ШІ Генерація
                </button>
              </div>

              <div className="border border-ink-150 dark:border-[#1f4d36] rounded-2xl p-4 max-h-[50vh] overflow-y-auto flex flex-col gap-3 bg-ink-50/30 dark:bg-[#102a1d]/30">
                {items.map(q => (
                  <label key={q.id} className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-[#102a1d] border border-ink-100 dark:border-[#1c3a2a] cursor-pointer hover:border-brand-300 transition text-left">
                    <input
                      type="checkbox"
                      checked={!!selectedQuestions[q.id]}
                      onChange={e => setSelectedQuestions(prev => ({ ...prev, [q.id]: e.target.checked }))}
                      className="accent-brand-600 w-4 h-4 mt-0.5 flex-shrink-0"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-brand-600 text-[10px] uppercase block mb-1">
                        {q.type === 'Single' ? 'Одна відповідь' : q.type === 'Multi' ? 'Кілька' : 'Вільний текст'}
                      </span>
                      <p className="font-semibold text-ink-800 dark:text-[#e8eaf0] line-clamp-2 leading-relaxed">{q.text}</p>
                    </div>
                  </label>
                ))}

                {testQuestions.map((tq, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 text-left">
                    <span className="text-emerald-500 font-bold text-xs mt-0.5">✓</span>
                    <div className="text-xs flex-1">
                      <span className="font-bold text-indigo-600 text-[10px] uppercase block mb-1">
                        Нове / Імпортоване Питання
                      </span>
                      <p className="font-semibold text-ink-800 dark:text-[#e8eaf0] leading-relaxed">{tq.text}</p>
                    </div>
                    <button 
                      onClick={() => setTestQuestions(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-ink-400 hover:text-rose-500 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {items.length === 0 && testQuestions.length === 0 && (
                  <p className="text-xs text-ink-400 text-center py-8 italic">Банк питань порожній. Додайте спочатку питання або скористайтеся ШІ.</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 border-t border-ink-100 dark:border-[#1c3a2a] pt-4">
            <button onClick={() => setShowTestForm(false)} className="btn btn-soft flex-1">Скасувати</button>
            <button onClick={handleSaveTest} disabled={testSaving} className="btn btn-primary flex-1">
              {testSaving ? '⏳ Зберігаю…' : '💾 Зберегти тест'}
            </button>
          </div>
        </div>
      </Modal>

      {/* --- AI Question Generator Prompt Modal --- */}
      <Modal open={showAiModal} onClose={() => setShowAiModal(false)} className="max-w-md">
        <div className="p-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-2xl mb-4">🤖</div>
          <h3 className="font-extrabold text-ink-900 dark:text-white text-lg mb-1">Згенерувати тест за допомогою ШІ</h3>
          <p className="text-xs text-ink-400 mb-4">Введіть тему або вставте конспект уроку, ШІ створить 5 тестових питань.</p>
          
          <textarea
            value={aiSourceText}
            onChange={e => setAiSourceText(e.target.value)}
            rows={5}
            placeholder="Введіть текст або опис теми сюди…"
            className="input resize-none mb-4 text-xs"
          />

          <div className="flex gap-2">
            <button onClick={() => setShowAiModal(false)} className="btn btn-soft flex-1 text-xs">Скасувати</button>
            <button 
              onClick={handleGenerateAiQuiz} 
              disabled={aiGenerating || !aiSourceText.trim()} 
              className="btn btn-primary flex-1 text-xs !bg-indigo-600 hover:!bg-indigo-700 text-white font-bold"
            >
              {aiGenerating ? '⚡ Генерую…' : '🔮 Згенерувати'}
            </button>
          </div>
        </div>
      </Modal>

      {/* --- Attempts analytics modal --- */}
      <Modal open={showAttemptsModal} onClose={() => setShowAttemptsModal(false)} className="max-w-4xl">
        <div className="p-6 max-h-[85vh] overflow-y-auto">
          <h2 className="font-extrabold text-ink-900 dark:text-white text-lg mb-1">Спроби здачі тесту «{viewingTestTitle}»</h2>
          <p className="text-xs text-ink-400 mb-5">Аналітика успішності та детальний звіт по кожній роботі</p>
          
          {selectedAttempt ? (
            /* Subview: Detailed Report of a single attempt */
            <div className="bg-ink-50/50 dark:bg-[#102a1d]/50 p-5 rounded-2xl border border-ink-150 dark:border-[#1f4d36]">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-ink-150 dark:border-[#1f4d36]">
                <div>
                  <h3 className="font-bold text-ink-900 dark:text-white text-base">Звіт спроби: {selectedAttempt.studentName}</h3>
                  <p className="text-xs text-ink-400">{selectedAttempt.studentEmail}</p>
                </div>
                <div className="text-right">
                  <span className={cx('text-lg font-extrabold px-3 py-1 rounded-xl', selectedAttempt.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
                    {selectedAttempt.scorePercentage}%
                  </span>
                  <p className="text-[10px] text-ink-400 mt-1">
                    Час: {formatDuration(selectedAttempt.startedAt, selectedAttempt.finishedAt)}
                  </p>
                </div>
              </div>

              {/* Questions breakdown */}
              <div className="flex flex-col gap-4">
                {(() => {
                  const attemptDetails = selectedAttempt.answersJson || {};
                  const givenAnswers = attemptDetails.answers || {};
                  const questionTimes = attemptDetails.questionTimes || {};

                  // Let's render questions if saved inside details or list of answers
                  // We can display the question ids, given answers, correct answers and time
                  return (
                    <div className="flex flex-col gap-4">
                      {Object.entries(givenAnswers).map(([qId, ansVal]: any, idx) => {
                        const time = questionTimes[qId] || 0;
                        
                        return (
                          <div key={qId} className="bg-white dark:bg-[#102a1d] p-4 rounded-xl border border-ink-100 dark:border-[#1c3a2a]">
                            <div className="flex items-start gap-2 mb-2">
                              <span className="w-5 h-5 rounded-md bg-ink-100 dark:bg-[#163a28] text-ink-600 dark:text-[#9aa2bd] flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                              <div>
                                <p className="font-bold text-ink-800 dark:text-[#e8eaf0] text-sm">ID питання: {qId}</p>
                                <p className="text-xs text-ink-500 mt-0.5">⏱ Час розгляду питання: <strong className="text-brand-600 font-semibold">{time} сек</strong></p>
                              </div>
                            </div>
                            
                            <div className="grid md:grid-cols-2 gap-2 text-xs mt-3">
                              <div className="p-2.5 rounded-lg bg-ink-50 dark:bg-[#102a1d]">
                                <span className="text-ink-400 block font-semibold mb-0.5">Відповідь студента:</span>
                                <strong className="text-ink-700 dark:text-[#e8eaf0] select-all">{JSON.stringify(ansVal)}</strong>
                              </div>
                              <div className="p-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-400">
                                <span className="text-emerald-600/80 block font-semibold mb-0.5">Час витрачено на питання:</span>
                                <strong>{time} секунд</strong>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {Object.keys(givenAnswers).length === 0 && (
                        <p className="text-xs text-ink-400 italic text-center py-4">Немає збережених детальних відповідей для цієї спроби</p>
                      )}
                    </div>
                  );
                })()}
              </div>

              <button 
                onClick={() => setSelectedAttempt(null)} 
                className="btn btn-soft text-xs py-2 px-4 mt-5"
              >
                ← Назад до списку спроб
              </button>
            </div>
          ) : (
            /* Main Attempts list */
            <>
              {attemptsLoading ? (
                <div className="py-12"><Loader /></div>
              ) : attempts.length === 0 ? (
                <EmptyState icon="📊" title="Спроб ще немає" hint="Студенти ще не проходили цей тест" />
              ) : (
                <div className="overflow-x-auto border border-ink-100 dark:border-[#1c3a2a] rounded-2xl bg-white dark:bg-[#0e2218]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-ink-100 dark:border-[#1c3a2a] bg-ink-50/50 dark:bg-[#0c2118]/50">
                        {['Студент', 'Email', 'Дата', 'Час всього', 'Оцінка', 'Статус', ''].map((h, i) => (
                          <th key={i} className="text-left px-4 py-3 font-bold text-ink-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {attempts.map((att) => (
                        <tr key={att.id} className="border-b border-ink-50 dark:border-[#102a1d] last:border-0 hover:bg-ink-50/40 dark:hover:bg-[#102a1d]/60 transition">
                          <td className="px-4 py-3.5 font-bold text-ink-800 dark:text-[#e8eaf0]">{att.studentName}</td>
                          <td className="px-4 py-3.5 text-ink-500 dark:text-[#6b7394]">{att.studentEmail}</td>
                          <td className="px-4 py-3.5 text-ink-400">{new Date(att.startedAt).toLocaleDateString('uk-UA')}</td>
                          <td className="px-4 py-3.5 text-ink-700 dark:text-[#b0b8d0] font-semibold">{formatDuration(att.startedAt, att.finishedAt)}</td>
                          <td className="px-4 py-3.5 text-ink-800 dark:text-white font-bold">{att.scorePercentage}%</td>
                          <td className="px-4 py-3.5">
                            <Badge tone={att.passed ? 'green' : 'rose'}>{att.passed ? 'Зарах.' : 'Незарах.'}</Badge>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <button 
                              onClick={() => setSelectedAttempt(att)}
                              className="btn btn-soft py-1 px-2.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                            >
                              Деталі спроби
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <button onClick={() => setShowAttemptsModal(false)} className="btn btn-soft w-full text-xs py-2 mt-5">Закрити</button>
        </div>
      </Modal>

      {/* ── AI Test Builder Chat ──────────────────────────────────────────── */}
      <TestBuilderChat
        open={showAiBuilder}
        onClose={() => setShowAiBuilder(false)}
        onSave={handleAiBuilderSave}
      />
    </Layout>
  );
}
