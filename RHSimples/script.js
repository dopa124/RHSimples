import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, query, where, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Ativar logs de debug para o Firestore
setLogLevel('debug');

// --- CONSTANTES DE METAS DE JORNADA ---
const DAILY_WORK_MINUTES = 480;        // 8 horas
const WEEKLY_GOAL_MINUTES = 56 * 60;   // 3360 minutos
const MONTHLY_GOAL_MINUTES = 224 * 60; // 13440 minutos
const ANNUAL_GOAL_MINUTES = 2688 * 60; // 161280 minutos
const FREQUENCY_THRESHOLD = 0.70;      // 70% (Etiqueta Verde/Vermelha)
    
// --- CONSTANTES DE AVALIAÇÕES ---
const EVALUATION_CATEGORIES = {
    neurodev: { label: "Transtornos de Neurodesenvolvimento", type: 'text' },
    psychotic: { label: "Transtorno Psicótico", type: 'text' },
    mood: { label: "Transtornos de Humor", type: 'text' },
    anxiety: { label: "Transtornos de Ansiedade", type: 'text' },
    ocd: { label: "Transtorno Obsessivo-Compulsivo e Relacionados", type: 'text' },
    stress: { label: "Transtornos Relacionados a Estresse", type: 'text' },
    dissociative: { label: "Transtornos Dissociativos", type: 'text' },
    somatic: { label: "Transtornos Somatoformes e Somáticos", type: 'text' },
    eating: { label: "Transtornos Alimentares", type: 'text' },
    elimination: { label: "Transtornos de Eliminação", type: 'text' },
    sleep: { label: "Transtornos de Sono-Vigília", type: 'text' },
    sexual: { label: "Disfunções Sexuais", type: 'text' },
    impulse: { label: "Transtornos Relacionados ao Controle de Impulsos", type: 'text' },
    substance: { label: "Transtornos Relacionados a Substâncias e Dependência", type: 'text' },
    neurocognitive: { label: "Transtornos Neurocognitivos", type: 'text' },
    personality: { label: "Transtornos da Personalidade", type: 'text' },
    paraphilic: { label: "Transtornos Parafílicos", type: 'text' },
    parenting: { label: "Transtornos Relacionados à Paternidade e Cuidado", type: 'text' },
    psychologicalFactors: { label: "Condições Relacionadas a Comportamentos Psicológicos", type: 'text' },
    cultural: { label: "Transtornos Relacionados a Condições Culturais", type: 'text' },
    qi: { label: "Teste de QI", type: 'number', highlighted: true },
    behavioralProfile: { label: "Perfil Comportamental", type: 'text', highlighted: true },
};

// Função para gerar um objeto de avaliação vazio
const createEmptyEvaluations = () => {
    const evals = {};
    for (const key in EVALUATION_CATEGORIES) {
        evals[key] = { has: false, testName: '', score: '' };
    }
    return evals;
};
    
// Variáveis globais para Firebase
let app, db, auth;
let authReady = false;
let currentUserId = null;
let currentTimesheetSnapshot = null;
let selectedTimesheetEmployeeId = null;
let selectedPdiEmployeeId = null;  
let selectedEvaluationEmployeeId = null;

// Variáveis globais existentes (dados mocados)
let employees =[
    { id: 1, nomeCompleto: "Ana Costa Silva", departamento: "Marketing", cargo: "Estágio", salario: 2916.67, dataContratacao: "2023-08-15", genero: "Feminino", fotoUrl: "https://placehold.co/128x128/9CA3AF/ffffff?text=AC",
        competencias: { comunicacao: 8, iniciativa: 7, lideranca: 4, trabalhoEmEquipe: 9, frequencia: 6.9, organizacao: 8 },
        trainings:[
            { name: "Comunicação Eficaz", score: 9.5, date: "2024-03-10" },
            { name: "Soft Skills para Estágio", score: 8.0, date: "2023-10-01" }
        ],
        evaluations: {
            ...createEmptyEvaluations(),
            anxiety: { has: true, testName: 'GAD-7', score: 'Nível moderado de ansiedade generalizada, recomenda-se acompanhamento.' },
            behavioralProfile: { has: true, testName: 'DISC', score: 'Dominante-Influente' },
            qi: { has: true, testName: 'WAIS-IV', score: 115 },
        }
    },
    { id: 2, nomeCompleto: "Bruno Torres Mendes", departamento: "TI", cargo: "Técnico", salario: 5416.67, dataContratacao: "2020-03-01", genero: "Masculino", fotoUrl: "https://placehold.co/128x128/9CA3AF/ffffff?text=BM",
        competencias: { comunicacao: 7, iniciativa: 9, lideranca: 6, trabalhoEmEquipe: 8, frequencia: 8.7, organizacao: 9 },
        trainings:[
            { name: "Segurança Cibernética", score: 10.0, date: "2024-06-01" },
            { name: "Gestão de Projetos Ágeis", score: 9.0, date: "2023-11-15" }
        ],
        evaluations: {
            ...createEmptyEvaluations(),
            behavioralProfile: { has: true, testName: 'MBTI', score: 'INTJ' },
            qi: { has: true, testName: 'WAIS-IV', score: 132 },
        }
    },
    { id: 3, nomeCompleto: "Carla Ribeiro Alves", departamento: "Planejamento", cargo: "Supervisor", salario: 7916.67, dataContratacao: "2022-11-20", genero: "Feminino", fotoUrl: "https://placehold.co/128x128/9CA3AF/ffffff?text=CA",
        competencias: { comunicacao: 9, iniciativa: 8, lideranca: 9, trabalhoEmEquipe: 7, frequencia: 7.5, organizacao: 7 },
        trainings:[
            { name: "Liderança de Equipes", score: 8.5, date: "2024-01-20" },
            { name: "Orçamento Empresarial", score: 9.2, date: "2023-07-01" }
        ],
        evaluations: {
            ...createEmptyEvaluations(),
            stress: { has: true, testName: 'Escala de Estresse Percebido (PSS)', score: 'Níveis elevados de estresse relacionados a prazos.' },
            mood: { has: false, testName: 'BDI-II', score: 'Sem indicativos de transtorno de humor.' },
            behavioralProfile: { has: true, testName: 'DISC', score: 'Estável-Conforme' },
            qi: { has: true, testName: 'WAIS-IV', score: 121 },
        }
    },
    { id: 4, nomeCompleto: "Daniel Lima Rocha", departamento: "TI", cargo: "Estágio", salario: 2500.00, dataContratacao: "2024-01-10", genero: "Masculino", fotoUrl: "https://placehold.co/128x128/9CA3AF/ffffff?text=DR",
        competencias: { comunicacao: 6, iniciativa: 7, lideranca: 3, trabalhoEmEquipe: 6, frequencia: 5.4, organizacao: 5 },
        trainings:[
            { name: "Fundamentos de Cloud", score: 6.0, date: "2024-05-10" },
            { name: "Python Básico", score: 7.5, date: "2024-03-01" }
        ],
        evaluations: createEmptyEvaluations(),
    },
];

let tasks =[
    { id: 1, name: "Revisar campanha de marketing Q4", status: "Em Andamento", assignedEmployeeIds:[1], dueDate: "2025-10-08" },
    { id: 2, name: "Atualizar servidor de produção", status: "Concluído", assignedEmployeeIds: [2], dueDate: "2025-09-30" },
    { id: 3, name: "Planejamento estratégico 2026", status: "A Fazer", assignedEmployeeIds:[3, 1], dueDate: "2025-10-25" },
    { id: 4, name: "Debug de rotina de backup", status: "A Fazer", assignedEmployeeIds:[2, 4], dueDate: "2025-10-06" }
];
let nextEmployeeId = employees.length + 1;
let nextTaskId = tasks.length + 1;
let selectedEmployee = employees[0];

const cargos =["Técnico", "Estágio", "Supervisor", "Gerente", "Analista"];
const departamentos =["Marketing", "TI", "Planejamento", "Financeiro", "Vendas"];

// Instâncias de Chart.js
let radarChartInstance = null, barChartInstance = null, genderChartInstance = null,
    tenureChartInstance = null, hiringFiringChartInstance = null, departmentSalaryChartInstance = null,
    pdiScoreBarChartInstance = null, trainingRadarChartInstance = null, evaluationPieChartInstance = null,
    evaluationRadarChartInstance = null, qiComparisonChartInstance = null, behavioralProfileChartInstance = null,
    qiByDepartmentChartInstance = null, departmentAvgScoreChartInstance = null, departmentPdiChartInstance = null,
    employeesByDeptChartInstance = null, assignedTasksChartInstance = null, completedTasksChartInstance = null,
    inProgressTasksChartInstance = null;

// --- FIREBASE INICIALIZAÇÃO E AUTENTICAÇÃO ---

const initializeFirebase = async () => {
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

        if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
            throw new Error("Firebase config não fornecida.");
        }

        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
            
        await setPersistence(auth, browserSessionPersistence);

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUserId = user.uid;
                authReady = true;
                document.getElementById('firestore-status').textContent = `Conectado como ID de Usuário: ${currentUserId}`;
                if (document.getElementById('timesheet-content').classList.contains('hidden') === false) {
                    setupTimesheetListener();
                }
            } else {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth);
                }
            }
        });
    } catch (error) {
        console.error("Erro ao inicializar ou autenticar Firebase:", error);
        document.getElementById('firestore-status').textContent = `Erro de conexão: ${error.message}`;
    }
};


// --- FUNÇÕES DE UTILIDADE ---
    
const parseDateDDMMYYYY = (dateString) => {
    if (!dateString) return null;
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = dateString.match(dateRegex);

    if (match) {
        const [_, day, month, year] = match;
        return `${year}-${month}-${day}`;
    }
    return null;
};

const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const parts = dateString.split('-');  
    if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
    }
    return dateString;
};
    
const formatDuration = (totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    return `${hours}h ${minutes}m`;
};

const calculateTenure = (dateString) => {
    const contractDate = new Date(dateString);
    const today = new Date();
    let years = today.getFullYear() - contractDate.getFullYear();
    let months = today.getMonth() - contractDate.getMonth();
    if (months < 0 || (months === 0 && today.getDate() < contractDate.getDate())) {
        years--;
        months += 12;
    }
    if (years === 0 && months === 0) return "Menos de 1 Mês";
    const yearText = years > 0 ? `${years} Ano${years > 1 ? 's' : ''}` : '';
    const monthText = months > 0 ? `${months} Mê${months > 1 ? 'ses' : 's'}` : '';
    return[yearText, monthText].filter(t => t).join(' e ');
};
    
const calculatePdiScore = (employee) => {
    if (!employee.trainings || employee.trainings.length === 0) return 0;
    const total = employee.trainings.reduce((sum, t) => sum + t.score, 0);
    return total / employee.trainings.length;
};

// --- LÓGICA DE GESTÃO DE TAREFAS ---
    
const calculatePriority = (dueDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(23, 59, 59, 999);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 3) return { label: 'Alta', color: 'bg-red-500', text: 'text-white' };
    if (diffDays <= 10) return { label: 'Média', color: 'bg-yellow-400', text: 'text-gray-800' };
    return { label: 'Baixa', color: 'bg-green-500', text: 'text-white' };
};

const renderTaskList = () => {
    const tbody = document.getElementById('task-list-body');
    const sortedTasks = tasks.sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));

    tbody.innerHTML = sortedTasks.map(task => {
        const priority = calculatePriority(task.dueDate);
        const assignedNames = task.assignedEmployeeIds
            .map(id => employees.find(e => e.id === id)?.nomeCompleto.split(' ')[0] || 'N/A')
            .join(', ');

        return ` 
            <tr>
                <td class="px-6 py-4"><span class="px-3 py-1 text-xs font-bold rounded-full ${priority.color} ${priority.text}">${priority.label}</span></td>
                <td class="px-6 py-4 font-medium">${task.name}</td>
                <td class="px-6 py-4">${task.status}</td>
                <td class="px-6 py-4 text-sm text-gray-600">${assignedNames}</td>
                <td class="px-6 py-4">${formatDate(task.dueDate)}</td>
                <td class="px-6 py-4">
                    <button onclick="removeTask(${task.id})" class="text-red-500 hover:text-red-700 font-semibold text-sm">Remover</button>
                </td>
            </tr>
        `;
    }).join('');
    if (tasks.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-gray-500">Nenhuma tarefa cadastrada.</td></tr>`;
    }
};
    
window.removeTask = (id) => {
    if(confirm('Tem certeza que deseja remover esta tarefa?')) {
        tasks = tasks.filter(t => t.id !== id);
        renderTasksContent();
        alertPlaceholder('Tarefa removida com sucesso!', 'bg-green-100');
    }
};

const renderTaskCharts = () => {
        // Chart 1: Tarefas por Funcionário (Total)
    const assignedData = employees.map(emp => ({
        name: emp.nomeCompleto.split(' ')[0],
        count: tasks.filter(t => t.assignedEmployeeIds.includes(emp.id)).length
    }));
    const assignedCtx = document.getElementById('assignedTasksChart').getContext('2d');
    if (assignedTasksChartInstance) assignedTasksChartInstance.destroy();
    assignedTasksChartInstance = new Chart(assignedCtx, { type: 'bar', data: { labels: assignedData.map(d => d.name), datasets:[{ label: 'Total de Tarefas', data: assignedData.map(d => d.count), backgroundColor: '#3b82f6' }] }, options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } } });

    // Chart 2: Tarefas Concluídas por Funcionário
    const completedData = employees.map(emp => ({
        name: emp.nomeCompleto.split(' ')[0],
        count: tasks.filter(t => t.status === 'Concluído' && t.assignedEmployeeIds.includes(emp.id)).length
    }));
    const completedCtx = document.getElementById('completedTasksChart').getContext('2d');
    if (completedTasksChartInstance) completedTasksChartInstance.destroy();
    completedTasksChartInstance = new Chart(completedCtx, { type: 'bar', data: { labels: completedData.map(d => d.name), datasets:[{ label: 'Tarefas Concluídas', data: completedData.map(d => d.count), backgroundColor: '#10b981' }] }, options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } } });
    
    // Chart 3: Tarefas em Andamento por Funcionário
    const inProgressData = employees.map(emp => ({
        name: emp.nomeCompleto.split(' ')[0],
        count: tasks.filter(t => t.status === 'Em Andamento' && t.assignedEmployeeIds.includes(emp.id)).length
    }));
    const inProgressCtx = document.getElementById('inProgressTasksChart').getContext('2d');
    if (inProgressTasksChartInstance) inProgressTasksChartInstance.destroy();
    inProgressTasksChartInstance = new Chart(inProgressCtx, { type: 'bar', data: { labels: inProgressData.map(d => d.name), datasets:[{ label: 'Tarefas em Andamento', data: inProgressData.map(d => d.count), backgroundColor: '#f59e0b' }] }, options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } } });
};

const populateTaskEmployeeSelect = () => {
    const select = document.getElementById('taskEmployees');
    select.innerHTML = employees.map(emp => `<option value="${emp.id}">${emp.nomeCompleto}</option>`).join('');
};

const renderTasksContent = () => {
    populateTaskEmployeeSelect();
    renderTaskList();
    renderTaskCharts();
};

document.getElementById('add-task-form').addEventListener('submit', function(event) {
    event.preventDefault();
    const form = event.target;
    const assignedEmployeeIds = Array.from(form.taskEmployees.selectedOptions).map(option => parseInt(option.value));

    if (assignedEmployeeIds.length === 0) {
            alertPlaceholder('Selecione pelo menos um funcionário.', 'bg-red-100');
            return;
    }

    const dueDateText = form.taskDueDate.value.trim();
    const parsedDate = parseDateDDMMYYYY(dueDateText);

    if (!parsedDate) {
        alertPlaceholder('Formato de data inválido. Use DD/MM/AAAA.', 'bg-red-100');
        return;
    }

    const newTask = {
        id: nextTaskId++,
        name: form.taskName.value.trim(),
        status: form.taskStatus.value,
        assignedEmployeeIds,
        dueDate: parsedDate
    };
    tasks.push(newTask);
    form.reset();
    renderTasksContent();
    alertPlaceholder('Tarefa adicionada com sucesso!', 'bg-green-100');
});

// --- LÓGICA DO TIMESHEET ---
const calculateTotalTime = (punches, isToday = false) => {
    let totalMinutes = 0, timeIn = null;
    for (const punch of punches) {
        const punchTime = parseInt(punch.time.split(':')[0]) * 60 + parseInt(punch.time.split(':')[1]);
        if (punch.type === 'in') timeIn = punchTime;
        else if (punch.type === 'out' && timeIn !== null) {
            totalMinutes += punchTime >= timeIn ? punchTime - timeIn : (24 * 60) - timeIn + punchTime;
            timeIn = null;
        }
    }
    if (timeIn !== null && isToday) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        totalMinutes += currentTime >= timeIn ? currentTime - timeIn : (24 * 60) - timeIn + currentTime;
    }
    return totalMinutes;
};

const getAggregatedMinutes = async (period) => {
    const daysMap = { weekly: 7, monthly: 30, annual: 365 };
    const days = daysMap[period] || 0;
    const promises =[];
    for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const path = `artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'}/users/${currentUserId}/timesheets/${selectedTimesheetEmployeeId}_${dateStr}`;
        promises.push(
            getDoc(doc(db, path)).then(snap => {
                if (snap.exists()) {
                    const punches = snap.data().punches ||[];
                    const isToday = i === 0;
                    return calculateTotalTime(punches, isToday);
                }
                return 0;
            })
        );
    }
    const results = await Promise.all(promises);
    return results.reduce((a, b) => a + b, 0);
};

const renderAggregatedGoals = (weekly, monthly, annual) => {
    const container = document.getElementById('aggregated-goals-container');
    const goals =[
        { period: "Semanal", goal: WEEKLY_GOAL_MINUTES, progress: weekly, goalHours: "56h" },
        { period: "Mensal", goal: MONTHLY_GOAL_MINUTES, progress: monthly, goalHours: "224h" },
        { period: "Anual", goal: ANNUAL_GOAL_MINUTES, progress: annual, goalHours: "2.688h" }
    ];
    container.innerHTML = goals.map(g => {
        const progressPercentage = Math.min(100, (g.progress / g.goal) * 100).toFixed(1);
        const isFrequent = progressPercentage >= (FREQUENCY_THRESHOLD * 100);
        const tagColor = isFrequent ? 'bg-emerald-500' : 'bg-red-500';
        return ` 
            <div class="bg-white p-4 rounded-xl card border border-gray-100 shadow-sm">
                <div class="flex justify-between items-start mb-2"><h4 class="text-md font-semibold text-gray-700">${g.period}</h4><span class="px-3 py-1 text-xs font-bold text-white rounded-full ${tagColor}">${isFrequent ? 'Meta Atingida' : 'Abaixo da Meta'}</span></div>
                <p class="text-2xl font-bold text-gray-900 mb-1">${progressPercentage}%</p>
                <p class="text-sm text-gray-500 mb-3">Meta: ${g.goalHours}</p>
                <div class="w-full bg-gray-200 rounded-full h-2.5"><div class="h-2.5 rounded-full ${tagColor}" style="width: ${progressPercentage}%"></div></div>
            </div>`;
    }).join('');
};

const updateAggregates = async () => {
    if (!authReady || !selectedTimesheetEmployeeId) return;
    try {
        const weekly = await getAggregatedMinutes('weekly');
        const monthly = await getAggregatedMinutes('monthly');
        const annual = await getAggregatedMinutes('annual');
        renderAggregatedGoals(weekly, monthly, annual);
    } catch (error) {
        console.error("Erro ao calcular agregados:", error);
    }
};

const updateTimesheetUI = (timesheetDoc) => {
    const punches = (timesheetDoc?.punches ||[]).sort((a, b) => a.time.localeCompare(b.time));
    document.getElementById('timesheet-history-body').innerHTML = punches.map(p => `<tr><td class="px-6 py-2 capitalize">${p.type}</td><td class="px-6 py-2">${p.time}</td></tr>`).join('');
        
    const lastPunch = punches[punches.length - 1];
    const isLogged = lastPunch?.type === 'in';
    const nextAction = isLogged ? 'out' : 'in';
    const button = document.getElementById('punch-button');
        
    document.getElementById('timesheet-status').textContent = isLogged ? 'LOGADO' : 'DESLOGADO';
    document.getElementById('timesheet-status').className = `text-xl font-bold ${isLogged ? 'text-emerald-600' : 'text-red-600'}`;
    document.getElementById('timesheet-last-punch').textContent = lastPunch ? `Último registro: ${lastPunch.time} (${lastPunch.type})` : 'Nenhum ponto hoje.';
    button.textContent = `BATER ${nextAction === 'in' ? 'ENTRADA' : 'SAÍDA'}`;
    button.className = `w-full py-3 px-4 rounded-lg text-white font-bold transition shadow-lg ${isLogged ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}`;
    button.dataset.action = nextAction;
    button.disabled = false;

    const totalMinutes = calculateTotalTime(punches, true);
    document.getElementById('total-hours-worked').textContent = formatDuration(totalMinutes);
    document.getElementById('progress-percentage').textContent = `${Math.min(100, (totalMinutes / DAILY_WORK_MINUTES) * 100).toFixed(1)}%`;
    updateAggregates();
};
    
const getTimesheetDocPath = (employeeId) => `artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'}/users/${currentUserId || 'anon_user'}/timesheets/${employeeId}_${new Date().toISOString().split('T')[0]}`;

const setupTimesheetListener = () => {
    if (!authReady || !selectedTimesheetEmployeeId || !db) return;
    if (currentTimesheetSnapshot) currentTimesheetSnapshot();
    document.getElementById('current-timesheet-date').textContent = formatDate(new Date().toISOString().split('T')[0]);
    currentTimesheetSnapshot = onSnapshot(doc(db, getTimesheetDocPath(selectedTimesheetEmployeeId)), (docSnap) => {
        updateTimesheetUI(docSnap.exists() ? docSnap.data() : { punches:[] });
    }, (error) => console.error("Erro ao ouvir timesheet:", error));
};

const recordPunch = async () => {
    if (!authReady || !selectedTimesheetEmployeeId) return alertPlaceholder('Autenticação pendente.', 'bg-red-100');
    const button = document.getElementById('punch-button');
    const newPunch = { type: button.dataset.action, time: new Date().toTimeString().substring(0, 5) };
    const timesheetRef = doc(db, getTimesheetDocPath(selectedTimesheetEmployeeId));
    button.disabled = true;
    try {
        const snap = await new Promise(resolve => onSnapshot(timesheetRef, resolve, { once: true }));
        if (snap.exists()) await updateDoc(timesheetRef, { punches:[...(snap.data().punches || []), newPunch] });
        else await setDoc(timesheetRef, { employeeId: selectedTimesheetEmployeeId, date: new Date().toISOString().split('T')[0], punches:[newPunch] });
        alertPlaceholder(`Ponto registrado!`, 'bg-green-100');
    } catch (e) { console.error("Erro ao registrar ponto: ", e); alertPlaceholder("Erro ao salvar ponto.", 'bg-red-100'); }
    finally { button.disabled = false; }
};

const populateTimesheetEmployeeSelect = () => {
    const select = document.getElementById('timesheet-employee-select');
    select.innerHTML = employees.map(emp => `<option value="${emp.id}">${emp.nomeCompleto}</option>`).join('');
    if (employees.length > 0) {
        selectedTimesheetEmployeeId = employees[0].id;
        select.value = selectedTimesheetEmployeeId;
    }
};
    
document.getElementById('timesheet-employee-select').addEventListener('change', (e) => { selectedTimesheetEmployeeId = parseInt(e.target.value); setupTimesheetListener(); });
document.getElementById('punch-button').addEventListener('click', recordPunch);


// --- LÓGICA PDI/TREINAMENTO ---

const populatePdiEmployeeSelect = () => {
    const select = document.getElementById('pdi-employee-select');
    select.innerHTML = employees.map(emp => `<option value="${emp.id}">${emp.nomeCompleto}</option>`).join('');
    if (employees.length > 0) selectedPdiEmployeeId = employees[0].id;
    renderPdiContent();
};

const renderPdiContent = () => {
    const employee = employees.find(emp => emp.id === selectedPdiEmployeeId);
    if (!employee) return;
    document.getElementById('pdi-employee-name').textContent = employee.nomeCompleto;
    document.getElementById('pdi-score-display').textContent = calculatePdiScore(employee).toFixed(2);
    const historyBody = document.getElementById('pdi-history-body');
    const hasTrainings = employee.trainings && employee.trainings.length > 0;
    document.getElementById('pdi-history-empty').classList.toggle('hidden', hasTrainings);
    if (hasTrainings) {
        historyBody.innerHTML = employee.trainings.map((t, index) => ({...t, originalIndex: index}))
            .sort((a,b) => new Date(b.date) - new Date(a.date))
            .map(t => `<tr>
                <td class="px-6 py-2">${formatDate(t.date)}</td>
                <td class="px-6 py-2">${t.name}</td>
                <td class="px-6 py-2 font-bold">${t.score.toFixed(1)}</td>
                <td class="px-6 py-2"><button onclick="removeTraining(${employee.id}, ${t.originalIndex})" class="text-red-500 hover:text-red-700 text-sm font-semibold">Remover</button></td>
            </tr>`).join('');
    }
    renderEmployeePdiComparisonChart();
    renderTrainingRadarChart(employee);
};

window.removeTraining = (empId, tIndex) => {
    if(confirm('Tem certeza que deseja remover este treinamento/PDI?')) {
        const emp = employees.find(e => e.id === empId);
        if(emp) {
            emp.trainings.splice(tIndex, 1);
            renderPdiContent();
            renderDashboard();
            alertPlaceholder('Treinamento removido com sucesso!', 'bg-green-100');
        }
    }
};

document.getElementById('add-training-form').addEventListener('submit', function(event) {
    event.preventDefault();
    const employeeId = parseInt(document.getElementById('pdi-employee-select').value);
    const employee = employees.find(emp => emp.id === employeeId);
    const trainingName = event.target.trainingName.value.trim();
    const score = parseFloat(event.target.trainingScore.value);
    if (employee && trainingName && !isNaN(score)) {
        employee.trainings.push({ name: trainingName, score: score, date: new Date().toISOString().split('T')[0] });
        event.target.reset();
        renderPdiContent();
        renderDashboard();
        alertPlaceholder(`Treinamento registrado!`, 'bg-green-100');
    } else { alertPlaceholder('Dados inválidos.', 'bg-red-100'); }
});

document.getElementById('pdi-employee-select').addEventListener('change', (e) => { selectedPdiEmployeeId = parseInt(e.target.value); renderPdiContent(); });

const renderEmployeePdiComparisonChart = () => {
    const ctx = document.getElementById('pdiScoreBarChart').getContext('2d');
    if (pdiScoreBarChartInstance) pdiScoreBarChartInstance.destroy();
    pdiScoreBarChartInstance = new Chart(ctx, { type: 'bar', data: { labels: employees.map(e => e.nomeCompleto.split(' ')[0]), datasets:[{ label: 'PDI Score (0-10)', data: employees.map(calculatePdiScore), backgroundColor: '#a78bfa' }] }, options: { responsive: true, scales: { y: { beginAtZero: true, max: 10 } }, plugins: { legend: { display: false } } } });
};

const renderTrainingRadarChart = (employee) => {
    const ctx = document.getElementById('trainingRadarChart').getContext('2d');
    if (trainingRadarChartInstance) trainingRadarChartInstance.destroy();
    if (!employee || !employee.trainings || employee.trainings.length === 0) return;
    const recent =[...employee.trainings].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    trainingRadarChartInstance = new Chart(ctx, { type: 'radar', data: { labels: recent.map(t => t.name), datasets:[{ label: `${employee.nomeCompleto} - Notas Recentes`, data: recent.map(t => t.score), backgroundColor: 'rgba(167, 139, 250, 0.3)', borderColor: '#8b5cf6' }] }, options: { responsive: true, scales: { r: { suggestedMin: 0, suggestedMax: 10 } } } });
};

// --- LÓGICA DE AVALIAÇÕES ---

const populateEvaluationEmployeeSelect = () => {
    const select = document.getElementById('evaluation-employee-select');
    select.innerHTML = employees.map(emp => `<option value="${emp.id}">${emp.nomeCompleto}</option>`).join('');
    if (employees.length > 0) selectedEvaluationEmployeeId = employees[0].id;
};

const generateEvaluationFormFields = () => {
    const container = document.getElementById('evaluation-fields-container');
    container.innerHTML = Object.entries(EVALUATION_CATEGORIES).map(([key, {label, type, highlighted}]) => ` 
        <div class="p-4 border rounded-lg ${highlighted ? 'bg-sky-50 border-sky-200' : 'bg-gray-50'}">
            <label class="font-semibold ${highlighted ? 'text-sky-800' : 'text-gray-800'} block mb-3">${label}</label>
            <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div class="md:col-span-2 flex items-center"><input type="checkbox" id="eval-has-${key}" class="h-5 w-5 rounded"><label for="eval-has-${key}" class="ml-2 text-sm">Possui (X)</label></div>
                <div class="md:col-span-4"><label for="eval-testName-${key}" class="text-xs block">Nome do Teste</label><input type="text" id="eval-testName-${key}" class="mt-1 block w-full p-2 border rounded-md"></div>
                <div class="md:col-span-6"><label for="eval-score-${key}" class="text-xs block">${type === 'number' ? 'Nota (Número)' : 'Nota/Texto Avaliativo'}</label> 
                    ${type === 'number' ? `<input type="number" id="eval-score-${key}" class="mt-1 block w-full p-2 border rounded-md">` : `<textarea id="eval-score-${key}" rows="2" class="mt-1 block w-full p-2 border rounded-md"></textarea>`} 
                </div>
            </div>
        </div>`).join('');
};

const populateEvaluationForm = (employee) => {
    if (!employee?.evaluations) return;
    for (const key in EVALUATION_CATEGORIES) {
        const data = employee.evaluations[key];
        if (data) {
            document.getElementById(`eval-has-${key}`).checked = data.has;
            document.getElementById(`eval-testName-${key}`).value = data.testName || '';
            document.getElementById(`eval-score-${key}`).value = data.score || '';
        }
    }
};
    
document.getElementById('evaluation-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const employee = employees.find(emp => emp.id === selectedEvaluationEmployeeId);
    if (!employee) return alertPlaceholder('Colaborador não encontrado.', 'bg-red-100');
    for (const key in EVALUATION_CATEGORIES) {
        employee.evaluations[key] = {
            has: document.getElementById(`eval-has-${key}`).checked,
            testName: document.getElementById(`eval-testName-${key}`).value.trim(),
            score: document.getElementById(`eval-score-${key}`).value.trim(),
        };
    }
    renderEvaluationContent();
    renderDashboard();  
    alertPlaceholder(`Avaliações salvas!`, 'bg-green-100');
});

const renderEmployeeComparisonPieChart = () => {
    const data = employees.map(e => ({ name: e.nomeCompleto.split(' ')[0], count: Object.values(e.evaluations || {}).filter(ev => ev.has).length })).filter(d => d.count > 0);
    const ctx = document.getElementById('evaluationComparisonPieChart').getContext('2d');
    if (evaluationPieChartInstance) evaluationPieChartInstance.destroy();
    evaluationPieChartInstance = new Chart(ctx, { type: 'pie', data: { labels: data.map(d => d.name), datasets: [{ data: data.map(d => d.count), backgroundColor:['#0ea5e9', '#f472b6', '#f59e0b', '#10b981'] }] }, options: { responsive: true, plugins: { legend: { position: 'right' } } } });
};

const renderEvaluationRadarChart = (employee) => {
    const ctx = document.getElementById('evaluationRadarChart').getContext('2d');
    if (evaluationRadarChartInstance) evaluationRadarChartInstance.destroy();
    if (!employee?.evaluations) return;
    const labels = Object.values(EVALUATION_CATEGORIES).map(c => c.label.split(' ')[0]);
    const data = Object.values(employee.evaluations).map(e => (e.testName && e.score) ? 1 : 0);
    evaluationRadarChartInstance = new Chart(ctx, { type: 'radar', data: { labels, datasets:[{ label: `Avaliações Preenchidas`, data, backgroundColor: 'rgba(14, 165, 233, 0.3)', borderColor: '#0ea5e9' }] }, options: { responsive: true, scales: { r: { suggestedMin: 0, max: 1, ticks: { stepSize: 1 } } } } });
};

const renderEvaluationReport = (employee) => {
    const container = document.getElementById('evaluation-report-container');
    if (!employee?.evaluations) { container.innerHTML = ''; return; }
    const items = Object.entries(employee.evaluations).map(([key, data]) => {
        const category = EVALUATION_CATEGORIES[key];
        return `<div class="py-3 border-b">
                    <h5 class="font-semibold">${category.label}</h5>
                    <div class="mt-2 text-sm grid grid-cols-3 gap-4">
                        <div><strong>Possui:</strong> <span class="${data.has ? 'text-red-600' : ''}">${data.has ? 'Sim (X)' : 'Não'}</span></div>
                        <div class="col-span-2"><strong>Teste:</strong> ${data.testName || 'N/A'}</div>
                        <div class="col-span-3"><strong>Avaliação:</strong><p class="mt-1 p-2 bg-gray-100 rounded">${data.score || 'N/A'}</p></div>
                    </div>
                </div>`;
    }).join('');
    container.innerHTML = `<h3 class="text-xl font-semibold mb-4">Relatório de ${employee.nomeCompleto}</h3><div>${items}</div>`;
};

const renderEvaluationContent = () => {
    const employee = employees.find(emp => emp.id === selectedEvaluationEmployeeId);
    populateEvaluationForm(employee);
    renderEmployeeComparisonPieChart();
    renderEvaluationRadarChart(employee);
    renderEvaluationReport(employee);
};
    
document.getElementById('evaluation-employee-select').addEventListener('change', (e) => { selectedEvaluationEmployeeId = parseInt(e.target.value); renderEvaluationContent(); });

// --- LÓGICA DO DASHBOARD ---
const updateKPIs = () => {
    const kpiContainer = document.getElementById('kpi-container');
    const totalEmployees = employees.length;
    const totalSalary = employees.reduce((sum, emp) => sum + emp.salario, 0);
    const avgSalary = totalEmployees > 0 ? totalSalary / totalEmployees : 0;
    const avgCompetency = totalEmployees > 0 ? employees.reduce((sum, emp) => sum + Object.values(emp.competencias).reduce((a,b)=>a+b,0)/6, 0) / totalEmployees : 0;
    const avgPdiScore = totalEmployees > 0 ? employees.reduce((sum, emp) => sum + calculatePdiScore(emp), 0) / totalEmployees : 0;
    const qiScores = employees.map(e => e.evaluations.qi.score).filter(Boolean).map(Number);
    const avgQI = qiScores.length > 0 ? qiScores.reduce((a, b) => a + b, 0) / qiScores.length : 0;

    const kpis =[
        { title: "Funcionários Ativos", value: totalEmployees, icon: "👥" },
        { title: "Gasto Total", value: `R$ ${totalSalary.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, icon: "💸" },
        { title: "Salário Médio", value: `R$ ${avgSalary.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, icon: "💰" },
        { title: "Avaliação Média", value: avgCompetency.toFixed(2), icon: "⭐️" },
        { title: "PDI Score Médio", value: avgPdiScore.toFixed(2), icon: "🎓" },
        { title: "QI Médio da Equipe", value: avgQI.toFixed(1), icon: "🧠" }
    ];
        
    kpiContainer.innerHTML = kpis.map(kpi => ` 
        <div class="bg-white p-4 rounded-xl card flex items-center justify-between"><div class="flex-1"> 
            <p class="text-sm text-gray-500">${kpi.title}</p><p class="text-xl font-bold">${kpi.value}</p> 
        </div><span class="text-3xl">${kpi.icon}</span></div>`).join('');
};

const updateEmployeeDetails = () => {
    const detailsDiv = document.getElementById('employee-details');
    if (!selectedEmployee) { 
        detailsDiv.innerHTML = '<p>Selecione um funcionário.</p>'; 
        if(radarChartInstance) radarChartInstance.destroy();
        if(barChartInstance) barChartInstance.destroy();
        return; 
    }
        
    const avgComp = Object.values(selectedEmployee.competencias).reduce((a,b)=>a+b,0)/6;
    const qiScore = selectedEmployee.evaluations?.qi?.score || 'N/A';
    const behavioralProfile = selectedEmployee.evaluations?.behavioralProfile?.score || 'N/A';
        
    detailsDiv.innerHTML = ` 
        <div class="photo-placeholder mx-auto mb-4"><img src="${selectedEmployee.fotoUrl}" class="w-full h-full object-cover rounded-full"></div> 
        <h3 class="text-2xl font-bold">${selectedEmployee.nomeCompleto}</h3> 
        <p class="text-lg font-medium text-emerald-600">${selectedEmployee.cargo} - ${selectedEmployee.departamento}</p> 
        <div class="text-left space-y-3 p-4 bg-gray-50 rounded-lg mt-4"> 
            <p><strong>Salário:</strong> R$ ${selectedEmployee.salario.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p> 
            <p><strong>Contratação:</strong> ${formatDate(selectedEmployee.dataContratacao)}</p> 
            <p><strong>Tempo de Empresa:</strong> ${calculateTenure(selectedEmployee.dataContratacao)}</p> 
            <p><strong>Avaliação Média:</strong> <span class="text-xl font-bold text-indigo-600">${avgComp.toFixed(2)}</span></p> 
            <p><strong>PDI Score:</strong> <span class="text-xl font-bold text-purple-600">${calculatePdiScore(selectedEmployee).toFixed(2)}</span></p> 
            <div class="pt-3 mt-3 border-t"> 
                <p><strong>QI:</strong> <span class="text-xl font-bold text-sky-600">${qiScore}</span></p> 
                <p><strong>Perfil Comportamental:</strong> <span class="text-lg font-bold text-amber-600">${behavioralProfile}</span></p> 
            </div> 
        </div>`;
    updateCompetencyCharts(selectedEmployee.competencias);
};

const updateCompetencyCharts = (competencias) => {
    const labels =['Comunicação', 'Iniciativa', 'Liderança', 'Equipe', 'Organização', 'Frequência'];
    const data = Object.values(competencias).map(v => v/2); // 0-5 scale
        
    const radarCtx = document.getElementById('radarChart').getContext('2d');
    if (radarChartInstance) radarChartInstance.destroy();
    radarChartInstance = new Chart(radarCtx, { type: 'radar', data: { labels, datasets:[{ label: 'Competências', data, backgroundColor: 'rgba(16, 185, 129, 0.3)', borderColor: '#10b981' }] }, options: { responsive: true, scales: { r: { suggestedMin: 0, max: 5 } } } });

    const barCtx = document.getElementById('barChart').getContext('2d');
    if (barChartInstance) barChartInstance.destroy();
    barChartInstance = new Chart(barCtx, { type: 'bar', data: { labels, datasets:[{ label: 'Competências', data, backgroundColor:['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#a78bfa', '#06b6d4'] }] }, options: { responsive: true, scales: { y: { beginAtZero: true, max: 5 } }, plugins: { legend: { display: false } } } });
};
    
const renderQIAndBehavioralCharts = () => {
    const qiData = employees.filter(e => e.evaluations?.qi?.score).map(e => ({name: e.nomeCompleto.split(' ')[0], score: Number(e.evaluations.qi.score) }));
    const qiCtx = document.getElementById('qiComparisonChart').getContext('2d');
    if (qiComparisonChartInstance) qiComparisonChartInstance.destroy();
    qiComparisonChartInstance = new Chart(qiCtx, { type: 'bar', data: { labels: qiData.map(d => d.name), datasets:[{ label: 'Pontuação de QI', data: qiData.map(d => d.score), backgroundColor: '#0ea5e9' }] }, options: { responsive: true, plugins: { legend: { display: false } } } });

    const profileCounts = employees.reduce((acc, e) => {
        const profile = e.evaluations?.behavioralProfile?.score;
        if (profile) acc[profile] = (acc[profile] || 0) + 1;
        return acc;
    }, {});
    const profileCtx = document.getElementById('behavioralProfileChart').getContext('2d');
    if(behavioralProfileChartInstance) behavioralProfileChartInstance.destroy();
    behavioralProfileChartInstance = new Chart(profileCtx, { type: 'doughnut', data: { labels: Object.keys(profileCounts), datasets:[{ data: Object.values(profileCounts), backgroundColor:['#f59e0b', '#f472b6', '#a78bfa', '#60a5fa'] }] }, options: { responsive: true, plugins: { legend: { position: 'right' } } } });
};
    
const renderQiByDepartmentChart = () => {
    const deptQiData = employees.reduce((acc, emp) => {
        const qi = emp.evaluations?.qi?.score;
        if(qi && !isNaN(Number(qi))){
            if(!acc[emp.departamento]) acc[emp.departamento] = { total: 0, count: 0 };
            acc[emp.departamento].total += Number(qi);
            acc[emp.departamento].count++;
        }
        return acc;
    }, {});

    const labels = Object.keys(deptQiData);
    const data = labels.map(dept => (deptQiData[dept].total / deptQiData[dept].count).toFixed(1));

    const ctx = document.getElementById('qiByDepartmentChart').getContext('2d');
    if(qiByDepartmentChartInstance) qiByDepartmentChartInstance.destroy();
    qiByDepartmentChartInstance = new Chart(ctx, { type: 'bar', data: { labels, datasets:[{ label: 'QI Médio', data, backgroundColor: '#14b8a6'}] }, options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false } } } });
};

const renderEmployeeList = () => {
    const tbody = document.getElementById('employee-list-body');
    tbody.innerHTML = employees.map(emp => {
        const avgComp = Object.values(emp.competencias).reduce((a,b)=>a+b,0)/6;
        const qi = emp.evaluations?.qi?.score || '-';
        const isSelected = selectedEmployee?.id === emp.id ? 'bg-emerald-50' : 'hover:bg-gray-50';
        return `<tr class="cursor-pointer ${isSelected}" data-employee-id="${emp.id}" onclick="selectEmployee(${emp.id})">
                <td class="px-6 py-4 font-medium">${emp.nomeCompleto}</td>
                <td class="px-6 py-4">${emp.departamento}</td>
                <td class="px-6 py-4">${emp.cargo}</td>
                <td class="px-6 py-4 font-bold text-sky-700">${qi}</td>
                <td class="px-6 py-4 font-bold text-indigo-600">${avgComp.toFixed(2)}</td>
            </tr>`;
    }).join('');
};

window.selectEmployee = (id) => { selectedEmployee = employees.find(e => e.id === id); renderEmployeeList(); updateEmployeeDetails(); };

const renderDemographicCharts = () => {
    const genderData = employees.reduce((acc, e) => { acc[e.genero] = (acc[e.genero] || 0) + 1; return acc; }, {});
    const genderCtx = document.getElementById('genderChart').getContext('2d');
    if (genderChartInstance) genderChartInstance.destroy();
    genderChartInstance = new Chart(genderCtx, { type: 'pie', data: { labels: Object.keys(genderData), datasets: [{ data: Object.values(genderData), backgroundColor:['#3b82f6', '#f472b6', '#6b7280'] }] }, options: { responsive: true, plugins: { legend: { position: 'right' } } } });

    const tenureData = employees.reduce((acc, e) => {
        const years = new Date().getFullYear() - new Date(e.dataContratacao).getFullYear();
        const bin = years === 0 ? '0-1 Ano' : years <= 3 ? '1-3 Anos' : years <= 7 ? '4-7 Anos' : '7+ Anos';
        acc[bin] = (acc[bin] || 0) + 1; return acc;
    }, {});
    const tenureCtx = document.getElementById('tenureChart').getContext('2d');
    if (tenureChartInstance) tenureChartInstance.destroy();
    tenureChartInstance = new Chart(tenureCtx, { type: 'doughnut', data: { labels:['0-1 Ano', '1-3 Anos', '4-7 Anos', '7+ Anos'], datasets:[{ data:['0-1 Ano', '1-3 Anos', '4-7 Anos', '7+ Anos'].map(l => tenureData[l] || 0), backgroundColor:['#10b981', '#f59e0b', '#60a5fa', '#a78bfa'] }] }, options: { responsive: true, plugins: { legend: { position: 'right' } } } });

    const hfCtx = document.getElementById('hiringFiringChart').getContext('2d');
    if (hiringFiringChartInstance) hiringFiringChartInstance.destroy();
    hiringFiringChartInstance = new Chart(hfCtx, { type: 'bar', data: { labels:['2023', '2024', '2025'], datasets:[{ label: 'Contratações', data:[12, 15, 6], backgroundColor: '#10b981' }, { label: 'Desligamentos', data:[5, 3, 1], backgroundColor: '#ef4444' }] }, options: { responsive: true, scales: { x: { stacked: true }, y: { stacked: true } } } });
};

const renderDepartmentCharts = () => {
        // Avaliação Média por Depto
    const deptScoreData = employees.reduce((acc, e) => {
        if (!acc[e.departamento]) acc[e.departamento] = { total: 0, count: 0 };
        acc[e.departamento].total += Object.values(e.competencias).reduce((a,b)=>a+b,0)/6;
        acc[e.departamento].count++;
        return acc;
    }, {});
    const scoreCtx = document.getElementById('departmentAvgScoreChart').getContext('2d');
    if(departmentAvgScoreChartInstance) departmentAvgScoreChartInstance.destroy();
    departmentAvgScoreChartInstance = new Chart(scoreCtx, { type: 'bar', data: { labels: Object.keys(deptScoreData), datasets:[{ label: 'Avaliação Média', data: Object.keys(deptScoreData).map(l => deptScoreData[l].total/deptScoreData[l].count), backgroundColor: '#3b82f6' }] }, options: { responsive: true, scales: { y: { beginAtZero: true, max: 10 } }, plugins: { legend: { display: false } } } });
        
    // PDI Score por Depto
    const deptPdiData = employees.reduce((acc, e) => {
        if (!acc[e.departamento]) acc[e.departamento] = { total: 0, count: 0 };
        acc[e.departamento].total += calculatePdiScore(e);
        acc[e.departamento].count++;
        return acc;
    }, {});
    const pdiCtx = document.getElementById('departmentPdiChart').getContext('2d');
    if(departmentPdiChartInstance) departmentPdiChartInstance.destroy();
    departmentPdiChartInstance = new Chart(pdiCtx, { type: 'bar', data: { labels: Object.keys(deptPdiData), datasets:[{ label: 'PDI Score Médio', data: Object.keys(deptPdiData).map(l => deptPdiData[l].total/deptPdiData[l].count), backgroundColor: '#8b5cf6' }] }, options: { responsive: true, scales: { y: { beginAtZero: true, max: 10 } }, plugins: { legend: { display: false } } } });
        
    // Funcionários por Depto
    const deptCountData = employees.reduce((acc, e) => {
        acc[e.departamento] = (acc[e.departamento] || 0) + 1;
        return acc;
    }, {});
    const countCtx = document.getElementById('employeesByDeptChart').getContext('2d');
    if(employeesByDeptChartInstance) employeesByDeptChartInstance.destroy();
    employeesByDeptChartInstance = new Chart(countCtx, { type: 'doughnut', data: { labels: Object.keys(deptCountData), datasets:[{ data: Object.values(deptCountData), backgroundColor:['#10b981', '#f59e0b', '#60a5fa', '#a78bfa', '#f472b6'] }] }, options: { responsive: true, plugins: { legend: { display: false } } } });


    // Saláriopor Depto
    const deptSalaryData = employees.reduce((acc, e) => {
        if (!acc[e.departamento]) acc[e.departamento] = { total: 0, count: 0 };
        acc[e.departamento].total += e.salario;
        acc[e.departamento].count++;
        return acc;
    }, {});
    const salaryCtx = document.getElementById('departmentSalaryChart').getContext('2d');
    if(departmentSalaryChartInstance) departmentSalaryChartInstance.destroy();
    departmentSalaryChartInstance = new Chart(salaryCtx, { type: 'bar', data: { labels: Object.keys(deptSalaryData), datasets:[{ label: 'Salário Médio', data: Object.keys(deptSalaryData).map(l => deptSalaryData[l].total/deptSalaryData[l].count), backgroundColor: '#f59e0b' }] }, options: { responsive: true, indexAxis: 'y' } });
};

const renderDashboard = () => {
    updateKPIs();
    renderEmployeeList();
    renderDemographicCharts();
    renderDepartmentCharts();
    renderQIAndBehavioralCharts();
    renderQiByDepartmentChart();
    populateTimesheetEmployeeSelect();  
    populatePdiEmployeeSelect();
    populateEvaluationEmployeeSelect();
    populateRemoveEmployeeSelect();

    if (!selectedEmployee && employees.length > 0) selectEmployee(employees[0].id);
    else if (selectedEmployee) updateEmployeeDetails();
    else document.getElementById('employee-details').innerHTML = '<p>Nenhum funcionário.</p>';
        
    if (authReady && selectedTimesheetEmployeeId) setupTimesheetListener();
};

// --- LÓGICA DO FORMULÁRIO DE ADIÇÃO E REMOÇÃO ---

const populateFormOptions = () => {
    document.getElementById('cargo').innerHTML = cargos.map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('departamento').innerHTML = departamentos.map(d => `<option value="${d}">${d}</option>`).join('');
};

const populateRemoveEmployeeSelect = () => {
    const select = document.getElementById('remove-employee-select');
    select.innerHTML = employees.map(emp => `<option value="${emp.id}">${emp.nomeCompleto}</option>`).join('');
};

document.getElementById('btn-remove-employee').addEventListener('click', () => {
    const select = document.getElementById('remove-employee-select');
    if (!select.value) return;
    const empId = parseInt(select.value);

    if(confirm('Tem certeza que deseja remover definitivamente este colaborador? Todos os seus dados serão apagados.')) {
        employees = employees.filter(e => e.id !== empId);
        
        // Limpar referências
        if (selectedEmployee && selectedEmployee.id === empId) selectedEmployee = employees.length > 0 ? employees[0] : null;
        if (selectedTimesheetEmployeeId === empId) selectedTimesheetEmployeeId = employees.length > 0 ? employees[0].id : null;
        if (selectedPdiEmployeeId === empId) selectedPdiEmployeeId = employees.length > 0 ? employees[0].id : null;
        if (selectedEvaluationEmployeeId === empId) selectedEvaluationEmployeeId = employees.length > 0 ? employees[0].id : null;

        // Remover tarefas atreladas (opcionalmente limpar das arrays)
        tasks.forEach(t => {
            t.assignedEmployeeIds = t.assignedEmployeeIds.filter(id => id !== empId);
        });

        renderDashboard();
        renderTasksContent();
        alertPlaceholder('Colaborador removido com sucesso!', 'bg-green-100');
    }
});

const alertPlaceholder = (message, className) => {
    const containers =['form-message', 'pdi-content', 'evaluations-content', 'tasks-content'];
    containers.forEach(id => {
        const container = document.getElementById(id);
        if(!container) return;
        let msgDiv = container.querySelector('.message-placeholder');
        if (!msgDiv) { msgDiv = document.createElement('div'); msgDiv.className = 'message-placeholder'; container.prepend(msgDiv); }
        msgDiv.textContent = message;
        msgDiv.className = `message-placeholder mt-4 p-3 rounded-lg ${className}`;
        setTimeout(() => { msgDiv.className = 'message-placeholder hidden'; }, 4000);
    });
};
    
document.getElementById('add-employee-form').addEventListener('submit', function(event) {
    event.preventDefault();
    const form = event.target;
    const dataContratacao = parseDateDDMMYYYY(form.dataContratacao.value.trim());
    if (!form.nomeCompleto.value.trim() || !dataContratacao) return alertPlaceholder('Dados inválidos.', 'bg-red-100');
        
    employees.push({
        id: nextEmployeeId++,
        nomeCompleto: form.nomeCompleto.value.trim(),
        departamento: form.departamento.value,
        cargo: form.cargo.value,
        salario: parseFloat(form.salario.value),  
        dataContratacao: dataContratacao,  
        genero: form.genero.value,
        fotoUrl: `https://placehold.co/128x128/9CA3AF/ffffff?text=${form.nomeCompleto.value.trim().split(' ').map(n=>n[0]).join('')}`,
        competencias: {
            comunicacao: parseFloat(form.comunicacao.value), iniciativa: parseFloat(form.iniciativa.value), lideranca: parseFloat(form.lideranca.value),
            trabalhoEmEquipe: parseFloat(form.trabalhoEmEquipe.value), organizacao: parseFloat(form.organizacao.value),
            frequencia: Math.min(10, parseFloat(form.frequenciaRatio.value) * 30),  
        },
        trainings:[],
        evaluations: createEmptyEvaluations()
    });
    form.reset();
    renderDashboard();
    alertPlaceholder(`Colaborador adicionado!`, 'bg-green-100');
    setTimeout(() => switchTab('dashboard'), 1500);
});

// --- LÓGICA DE NAVEGAÇÃO ENTRE ABAS ---

const switchTab = (tabId) => {['dashboard', 'add-employee', 'tasks', 'timesheet', 'pdi', 'evaluations'].forEach(id => {
        const isTarget = id === tabId;
        document.getElementById(`${id}-content`).classList.toggle('hidden', !isTarget);
        document.getElementById(`tab-${id}`).classList.toggle('active', isTarget);
        if (isTarget) {
            if (id === 'timesheet' && authReady) setupTimesheetListener();
            if (id === 'pdi') renderPdiContent();  
            if (id === 'evaluations') renderEvaluationContent();
            if (id === 'tasks') renderTasksContent();
        }
    });
};['dashboard', 'add-employee', 'tasks', 'timesheet', 'pdi', 'evaluations'].forEach(id => {
    document.getElementById(`tab-${id}`).addEventListener('click', () => switchTab(id));
});


// --- INICIALIZAÇÃO GERAL ---
window.onload = function() {
    initializeFirebase();  
    populateFormOptions();
    generateEvaluationFormFields();
    renderDashboard();
    switchTab('dashboard');
};