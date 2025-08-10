// public/js/shared-ui.js

/**
 * Busca dados do usuário no Firestore ('usuarios') e seu nível hierárquico ('funcionarios').
 * ATENÇÃO: Esta função assume que as instâncias 'db' e 'auth' do Firebase
 * foram inicializadas globalmente no script da página HTML que a chama.
 *
 * @param {string} userId - O UID do usuário do Firebase Auth.
 * @returns {Promise<object|null>} - Uma Promise que resolve com um objeto
 * {
 * userData: { // Dados da coleção 'usuarios' + funcionarioId
 * uid: string,
 * nome: string,
 * email: string | null,
 * nivelAcesso: number, // Nível numérico (ex: 0, 1, 2, 3)
 * nickHabbo: string | null,
 * cargo: string, // Cargo (pode ser atualizado com o de 'funcionarios')
 * funcionarioId: string | null // ID do documento na coleção 'funcionarios' (ou null)
 * },
 * hierarchicalLevel: string // Nível hierárquico "N0" a "N10"
 * }
 * Retorna null se houver erro crítico na busca do usuário inicial.
 * @throws {Error} - Lança um erro se os dados essenciais não forem encontrados ou se db/auth não estiverem disponíveis.
 */
async function fetchUserDataAndLevel(userId, dbInstance) {
    // Usa dbInstance se fornecido, senão tenta usar 'db' global
    const db = dbInstance || (typeof db !== 'undefined' ? db : null);

    // Verifica se a instância 'db' está disponível
    if (!db) {
        console.error("fetchUserDataAndLevel: Instância do Firestore (db) não definida globalmente ou não passada.");
        throw new Error("Falha interna: Instância do DB não disponível.");
    }
    console.log(`--- fetchUserDataAndLevel: Iniciando para User ID: ${userId}`);

    try {
        // 1. Buscar dados da coleção 'usuarios'
        const userDocRef = db.collection('usuarios').doc(userId);
        const userDoc = await userDocRef.get();

        if (!userDoc.exists) {
            console.error(`--- fetchUserDataAndLevel: Documento NÃO encontrado em 'usuarios' para UID: ${userId}`);
            throw new Error("Dados de usuário não encontrados no sistema.");
        }

        const userDataFromUsuarios = userDoc.data();
        if (!userDataFromUsuarios) {
            console.error(`--- fetchUserDataAndLevel: Dados vazios no documento 'usuarios' para UID: ${userId}`);
            throw new Error("Falha ao ler dados do usuário.");
        }
        console.log("--- fetchUserDataAndLevel: Dados de 'usuarios' obtidos:", userDataFromUsuarios);

        // Prepara objeto de resultado inicial, incluindo funcionarioId como null
        const result = {
            userData: {
                uid: userId,
                nome: userDataFromUsuarios.nome || "Usuário Desconhecido",
                email: userDataFromUsuarios.email || null,
                nivelAcesso: userDataFromUsuarios.nivel || 0, // Nível numérico do sistema
                nickHabbo: userDataFromUsuarios.nickHabbo || null,
                cargo: userDataFromUsuarios.cargo || "Não definido", // Cargo inicial
                funcionarioId: null // Inicializa como null <<< IMPORTANTE
            },
            hierarchicalLevel: 'N0' // Nível hierárquico padrão N1-N10
        };

        // 2. Buscar nível hierárquico e ID do funcionário da coleção 'funcionarios' se houver nickHabbo
        if (result.userData.nickHabbo) {
            console.log(`--- fetchUserDataAndLevel: Buscando 'funcionarios' com nickHabbo: ${result.userData.nickHabbo}`);
            const funcQuery = db.collection('funcionarios')
                                 .where('nickHabbo', '==', result.userData.nickHabbo)
                                 .where('ativo', '==', true) // Garante que o funcionário está ativo
                                 .limit(1);
            const funcSnapshot = await funcQuery.get();

            if (!funcSnapshot.empty) {
                const funcDoc = funcSnapshot.docs[0];
                const funcData = funcDoc.data();
                const funcDocId = funcDoc.id; // ID do documento 'funcionarios'

                console.log(`--- fetchUserDataAndLevel: Funcionário ATIVO encontrado! ID=${funcDocId}, Dados:`, funcData);

                // ***** LINHA CRÍTICA ADICIONADA *****
                result.userData.funcionarioId = funcDocId; // Atribui o ID do documento encontrado
                // ************************************

                result.hierarchicalLevel = funcData.nivel || 'N0'; // Nível N1-N10 de 'funcionarios'
                // Atualiza o cargo com o da coleção 'funcionarios' se encontrado e diferente
                if (funcData.cargo && funcData.cargo !== result.userData.cargo) {
                     console.log(`--- fetchUserDataAndLevel: Atualizando cargo de "${result.userData.cargo}" para "${funcData.cargo}" (de funcionarios)`);
                     result.userData.cargo = funcData.cargo;
                }
                 console.log(`--- fetchUserDataAndLevel: Nível Hierárquico final: ${result.hierarchicalLevel}, Cargo final: ${result.userData.cargo}`);

            } else {
                // Usuário existe em 'usuarios' mas não tem funcionário ativo correspondente.
                console.warn(`--- fetchUserDataAndLevel: Funcionário ATIVO não encontrado para nick: ${result.userData.nickHabbo}. funcionarioId permanecerá null.`);
                // Decide nível hierárquico baseado no nível de acesso
                if (result.userData.nivelAcesso >= 3) {
                     console.warn("--- fetchUserDataAndLevel: Assumindo Nível Hierárquico N10 (Admin sem func).");
                     result.hierarchicalLevel = 'N10';
                }
                // Para níveis < 3, hierarchicalLevel permanece 'N0' por padrão
            }
        } else {
             console.warn("--- fetchUserDataAndLevel: Usuário sem nickHabbo.");
             // Decide nível hierárquico baseado no nível de acesso
             if (result.userData.nivelAcesso >= 3) {
                 console.warn("--- fetchUserDataAndLevel: Assumindo Nível Hierárquico N10 (Admin sem nick).");
                 result.hierarchicalLevel = 'N10';
             }
             // Para níveis < 3, hierarchicalLevel permanece 'N0'
        }

        console.log("--- fetchUserDataAndLevel: Retornando com sucesso:", result);
        return result; // Retorna o objeto com os dados combinados

    } catch (error) {
        console.error(`--- fetchUserDataAndLevel: Erro GERAL durante a execução para User ID ${userId}:`, error);
        // Lança o erro original ou um novo erro mais específico
        throw new Error(`Falha ao carregar dados essenciais: ${error.message || error}`);
    }
}


/**
 * Gera o HTML do menu da sidebar com base no nível HIERÁRQUICO do usuário e na página atual.
 * @param {string} userHierarchicalLevel - O nível HIERÁRQUICO do usuário (ex: "N1", "N2", ..., "N10", ou "N0").
 * @param {string} currentPageFilename - O nome do arquivo da página atual (ex: "dashboard.html").
 * @returns {string} - O HTML para ser inserido em #sidebarMenu.
 */
function generateSidebarMenu(userHierarchicalLevel, currentPageFilename) {
    console.log("Gerando menu para Nível Hierárquico:", userHierarchicalLevel, "| Página Atual:", currentPageFilename);

    const allMenuItems = [
        { href: 'dashboard.html', icon: 'fa-chart-line', text: 'Dashboard', level: 'N10' },
        { href: 'admissao_funcionarios.html', icon: 'fa-user-plus', text: 'Admissão', level: 'N10' },
        { href: 'lista_funcionarios.html', icon: 'fa-users', text: 'Funcionários', level: 'N10' },
        { href: 'gestao_usuarios.html', icon: 'fa-user-shield', text: 'Gestão de Usuários', level: 'N10' },
        { href: 'controle_pontos.html', icon: 'fa-clock', text: 'Controle de Pontos', level: 'N10' },
        { href: 'pagamentos_salarios.html', icon: 'fa-money-bill-wave', text: 'Pagamentos', level: 'N10' },
        { href: 'avaliacao_desempenho.html', icon: 'fa-star', text: 'Avaliação', level: 'N10' },
        { href: 'promocoes.html', icon: 'fa-level-up-alt', text: 'Promoções', level: 'N10' },
        { href: 'orcamentos.html', icon: 'fa-file-invoice-dollar', text: 'Orçamentos', level: 'N10' },
        { href: 'desligamentos.html', icon: 'fa-user-minus', text: 'Desligamentos', level: 'N10' },
        { href: 'dashboard_user.html', icon: 'fa-tachometer-alt', text: 'Dashboard', levels: ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9'] },
        { href: 'feedback.html', icon: 'fa-comment-dots', text: 'Meu Feedback', levels: ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9'] },
        { href: 'avaliacao_desempenho_user.html', icon: 'fa-star-half-alt', text: 'Avaliação', levels: ['N2', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9'] },
        { href: 'escalas.html', icon: 'fa-calendar-alt', text: 'Escalas', levels: ['N2', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10'] },
        { href: 'regimento_interno.html', icon: 'fa-book', text: 'Regimento', levels: ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10'] },
        { href: 'trilha.html', icon: 'fa-road', text: 'Trilha de Carreira', levels: ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10'] }
    ];
    let menuHtml = ''; let itemsAdded = 0;
    allMenuItems.forEach(item => {
        let showItem = false;
        if (item.level) { showItem = item.level === userHierarchicalLevel; }
        else if (item.levels) { showItem = item.levels.includes(userHierarchicalLevel); }
        if (showItem) {
            const isActivePage = currentPageFilename === item.href;
            // Marca ativo em 'avaliacao_desempenho.html' ou 'avaliacao_desempenho_user.html' se estiver em 'avaliar.html'
            const isAvaliacaoActive = currentPageFilename === 'avaliar.html' && (item.href === 'avaliacao_desempenho.html' || item.href === 'avaliacao_desempenho_user.html');
            const isActive = isActivePage || isAvaliacaoActive;

            menuHtml += `<a href="${item.href}" class="menu-item ${isActive ? 'active' : ''}"><i class="fas ${item.icon}"></i><span>${item.text}</span></a>`;
            itemsAdded++;
        }
    });
    if (itemsAdded === 0) { return '<p class="error-message" style="color: white; padding: 15px;">Menu indisponível.</p>'; }
    return menuHtml;
}


/**
 * Inicializa as interações da sidebar (toggle, collapse, overlay, logout).
 * Assume que 'auth' do Firebase está disponível globalmente.
 */
function initializeSidebarInteractions() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const collapseMenuBtn = document.getElementById('collapseMenuBtn');
    const mainContent = document.getElementById('mainContent');
    const logoutBtn = document.getElementById('logoutBtn'); // Botão de logout no footer

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof auth !== 'undefined' && auth.signOut) {
                auth.signOut().then(() => { window.location.href = 'login.html'; })
                .catch((error) => { console.error("Erro ao fazer logout:", error); alert("Erro ao tentar sair."); });
            } else { console.error("Firebase Auth não definido."); alert("Erro ao tentar sair."); }
        });
    } else { console.warn("Botão de Logout ('logoutBtn') não encontrado no footer."); }

    // Collapse
    if (collapseMenuBtn && sidebar && mainContent) {
        // Verifica estado inicial no localStorage
        if (localStorage.getItem('sidebarCollapsed') === 'true') {
            sidebar.classList.add('collapsed');
            mainContent.classList.add('expanded');
            const icon = collapseMenuBtn.querySelector('i');
            if (icon) { icon.classList.remove('fa-chevron-left'); icon.classList.add('fa-chevron-right'); }
        }
        // Adiciona listener
        collapseMenuBtn.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
            const icon = this.querySelector('i');
            if (icon) { icon.classList.toggle('fa-chevron-left'); icon.classList.toggle('fa-chevron-right'); }
            // Salva estado no localStorage
            localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
        });
    } else { console.warn("Elementos para collapse (botão, sidebar ou mainContent) não encontrados."); }

    // Hamburguer (Mobile)
    if (sidebarToggle && sidebar && overlay) {
        sidebarToggle.addEventListener('click', function() { sidebar.classList.toggle('active'); overlay.classList.toggle('active'); this.classList.toggle('menu-open'); });
        overlay.addEventListener('click', function() { sidebar.classList.remove('active'); overlay.classList.remove('active'); sidebarToggle.classList.remove('menu-open'); });
        window.addEventListener('resize', function() { if (window.innerWidth > 768) { sidebar.classList.remove('active'); overlay.classList.remove('active'); sidebarToggle.classList.remove('menu-open'); } });
    } else { console.warn("Elementos para toggle mobile (toggle, sidebar ou overlay) não encontrados."); }

    console.log("Interações da Sidebar inicializadas.");
}


/**
 * Função para mostrar mensagens de feedback ao usuário de forma padronizada.
 * @param {string} type - Tipo da mensagem ('success', 'error', 'info', 'warning').
 * @param {string} message - O texto da mensagem.
 * @param {string} [containerElementId='alertaContainer'] - O ID do elemento HTML onde a mensagem será exibida.
 */
function showGlobalMessage(type, message, containerElementId = 'alertaContainer') {
    const container = document.getElementById(containerElementId);
    if (!container) { console.error(`Elemento #${containerElementId} não encontrado.`); return; }
    const iconClassMap = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    const iconClass = iconClassMap[type] || 'fa-info-circle'; container.innerHTML = `<i class="fas ${iconClass}"></i> ${message}`;
    // Usa as classes base 'message' e tipo específico (ex: 'success-message')
    container.className = `message ${type}-message`;
    container.style.display = 'flex'; container.style.opacity = '1'; container.style.transition = '';
    setTimeout(() => { container.style.opacity = '0'; container.style.transition = 'opacity 0.5s ease'; }, 4500);
    setTimeout(() => { container.style.display = 'none'; }, 5000);
}

// Fim de public/js/shared-ui.js