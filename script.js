// VERSÃO COM AUTH0 - Diagnóstico Robusto2

const urlPlanilha = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQn8t8Uk0mXe7dz6Acwn_hs_KWbY4gdLwzg6j190EkTNgI1xfLUiEWVWxzNNARAPlmMwUsO0NwDwEe0/pub?output=csv';

// --- CONFIGURAÇÃO DO AUTH0 ---
const auth0Config = {
    domain: "jsunai.us.auth0.com",
    clientId: "TvTxOmzG7Z4kskPYGg4XVapGoKQ9eS1a",
    authorizationParams: {
        redirect_uri: window.location.href.split('?')[0]
    }
};
let auth0Client = null;

// --- ELEMENTOS DA PÁGINA ---
// É mais seguro obter os elementos apenas quando o DOM estiver pronto.
let loginPrompt, appContent, btnLogin, btnLogout, userNameEl,
    loadingIndicator, backToTopButton, searchInput, brandFiltersContainer,
    typeFiltersContainer, toggleFiltersBtn, collapsibleFilters;

// --- FLUXO PRINCIPAL ---
window.addEventListener('load', async () => {
    console.log("1. Janela carregada (window.load).");

    // Inicializa os elementos do DOM agora que temos certeza que a página carregou.
    initializeDOMElements();
    
    try {
        console.log("2. Tentando criar cliente Auth0...");
        auth0Client = await auth0.createAuth0Client(auth0Config);
        console.log("3. Cliente Auth0 criado com sucesso.");

        // Verifica se a URL contém os parâmetros de retorno do Auth0
        if (location.search.includes("code=") && location.search.includes("state=")) {
            console.log("4. Parâmetros de redirect encontrados. Processando...");
            await auth0Client.handleRedirectCallback();
            console.log("5. Redirect processado. Limpando URL...");
            // Limpa os parâmetros da URL para evitar loops
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        console.log("6. Atualizando a interface do usuário (UI)...");
        await updateUI();

    } catch (e) {
        console.error("ERRO CRÍTICO NA INICIALIZAÇÃO DO AUTH0:", e);
        loadingIndicator.innerHTML = '<p>Erro na autenticação. Verifique o console (F12) e as configurações do Auth0.</p>';
        loadingIndicator.style.display = 'flex'; // Garante que a mensagem de erro seja visível
    }
});

function initializeDOMElements() {
    loginPrompt = document.getElementById('login-prompt');
    appContent = document.getElementById('app-content');
    btnLogin = document.getElementById('btn-login-main');
    btnLogout = document.getElementById('btn-logout');
    userNameEl = document.getElementById('user-name');
    loadingIndicator = document.getElementById('loading-indicator');
    backToTopButton = document.getElementById('back-to-top');
    searchInput = document.getElementById('searchInput');
    brandFiltersContainer = document.getElementById('brand-filters');
    typeFiltersContainer = document.getElementById('type-filters');
    toggleFiltersBtn = document.getElementById('toggle-filters-btn');
    collapsibleFilters = document.getElementById('collapsible-filters');

    // Adiciona os listeners de clique aqui para garantir que os botões existem
    btnLogin.addEventListener('click', login);
    btnLogout.addEventListener('click', logout);
}

const updateUI = async () => {
    try {
        const isAuthenticated = await auth0Client.isAuthenticated();
        console.log("7. Usuário está autenticado?", isAuthenticated);
        
        if (isAuthenticated) {
            loginPrompt.style.display = 'none';
            appContent.style.display = 'block';

            const user = await auth0Client.getUser();
            userNameEl.textContent = user.name || user.email;

            await carregarDados(); // Carrega os dados da planilha
            window.addEventListener('scroll', handleScroll);
        } else {
            loginPrompt.style.display = 'flex';
            appContent.style.display = 'none';
            loadingIndicator.style.display = 'none'; // Esconde o "loading" para mostrar a tela de login
        }
    } catch (e) {
        console.error("ERRO ao atualizar UI:", e);
        loadingIndicator.innerHTML = '<p>Ocorreu um erro ao verificar o estado de login.</p>';
    }
};

// --- FUNÇÕES DE LOGIN/LOGOUT ---
const login = async () => {
    console.log("Iniciando processo de login...");
    await auth0Client.loginWithRedirect();
};

const logout = async () => {
    console.log("Iniciando processo de logout...");
    await auth0Client.logout({
        logoutParams: {
            returnTo: window.location.origin
        }
    });
};

// --- CÓDIGO DA APLICAÇÃO (sem mudanças) ---

async function carregarDados() {
    console.log("8. Iniciando carregamento dos dados da planilha...");
    loadingIndicator.style.display = 'flex';
    loadingIndicator.querySelector('p').textContent = 'Carregando lista de preços...';
    try {
        const response = await fetch(urlPlanilha);
        if (!response.ok) throw new Error(`Erro na rede ao buscar planilha: status ${response.status}`);
        const data = await response.text();
        console.log("9. Dados da planilha recebidos. Processando...");
        const itens = processarDados(data);
        renderizarPagina(itens);
        popularFiltros(itens);
        setupEventListeners();
        console.log("10. Página renderizada com sucesso.");
    } catch (error) {
        console.error("ERRO CRÍTICO ao carregar dados da planilha:", error);
        loadingIndicator.innerHTML = '<p>Ocorreu um erro ao carregar os dados da planilha. Verifique o link e as permissões de compartilhamento.</p>';
    }
}

function processarDados(csvData) {
    const linhas = csvData.trim().split(/\r?\n/).slice(1);
    return linhas.map(linha => {
        const colunas = linha.split(',');
        if (colunas.length < 5) return null;
        return {
            marca: colunas[0]?.trim() || 'Sem Marca',
            tipo: colunas[1]?.trim() || 'Outros',
            modelo: colunas[2]?.trim() || '',
            detalhes: colunas[3]?.trim() || '',
            preco: colunas[4]?.trim() || '0'
        };
    }).filter(item => item && item.marca && item.modelo && item.marca.length > 0);
}

function renderizarPagina(itens) {
    const containerLista = document.getElementById('lista-container');
    containerLista.innerHTML = '';
    const fragmentoLista = document.createDocumentFragment();
    const porMarca = itens.reduce((acc, item) => { (acc[item.marca] = acc[item.marca] || []).push(item); return acc; }, {});
    const marcas = Object.keys(porMarca).sort();

    marcas.forEach(marca => {
        const marcaContainer = document.createElement('div');
        marcaContainer.className = 'marca-container';
        marcaContainer.dataset.marca = marca;
        const tituloMarca = document.createElement('h2');
        tituloMarca.className = 'marca-titulo';
        tituloMarca.textContent = marca;
        marcaContainer.appendChild(tituloMarca);
        const porTipo = porMarca[marca].reduce((acc, item) => { (acc[item.tipo] = acc[item.tipo] || []).push(item); return acc; }, {});
        const tipos = Object.keys(porTipo).sort((a, b) => {
            if (a.toLowerCase().includes('tela')) return -1;
            if (b.toLowerCase().includes('tela')) return 1;
            return a.localeCompare(b);
        });
        tipos.forEach(tipo => {
            const table = document.createElement('table');
            table.dataset.tipo = tipo;
            table.innerHTML = `<thead><tr><th colspan="3" class="tipo-titulo">${tipo}</th></tr><tr><th>Modelo</th><th>Detalhes / Qualidade</th><th>Preço (R$)</th></tr></thead><tbody>${porTipo[tipo].sort((a, b) => a.modelo.localeCompare(b.modelo)).map(item => `<tr><td>${item.modelo}</td><td>${item.detalhes}</td><td>${item.preco}</td></tr>`).join('')}</tbody>`;
            marcaContainer.appendChild(table);
        });
        fragmentoLista.appendChild(marcaContainer);
    });
    containerLista.appendChild(fragmentoLista);
    loadingIndicator.style.display = 'none';
}

function popularFiltros(itens) {
    const marcasUnicas = [...new Set(itens.map(item => item.marca))];
    const marcas = marcasUnicas.length > 0 ? ['todas', ...marcasUnicas.sort()] : [];
    const tiposUnicos = [...new Set(itens.map(item => item.tipo))];
    const tipos = tiposUnicos.length > 0 ? ['todas', ...tiposUnicos.sort()] : [];
    brandFiltersContainer.innerHTML = marcas.map(marca => 
        `<button class="filter-pill ${marca === 'todas' ? 'active' : ''}" data-filter="${marca}">${marca === 'todas' ? 'Todas as Marcas' : marca}</button>`
    ).join('');
    typeFiltersContainer.innerHTML = tipos.map(tipo =>
        `<button class="filter-pill ${tipo === 'todas' ? 'active' : ''}" data-filter="${tipo}">${tipo === 'todas' ? 'Todos os Tipos' : tipo}</button>`
    ).join('');
}

function setupEventListeners() {
    toggleFiltersBtn.addEventListener('click', () => {
        toggleFiltersBtn.classList.toggle('open');
        collapsibleFilters.classList.toggle('open');
    });
    brandFiltersContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            filtroAtivoMarca = e.target.dataset.filter;
            brandFiltersContainer.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            aplicarTodosOsFiltros();
        }
    });
    typeFiltersContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            filtroAtivoTipo = e.target.dataset.filter;
            typeFiltersContainer.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            aplicarTodosOsFiltros();
        }
    });
    searchInput.addEventListener('keyup', aplicarTodosOsFiltros);
}

function aplicarTodosOsFiltros() {
    const buscaTexto = searchInput.value.toUpperCase();
    document.querySelectorAll('.marca-container').forEach(containerMarca => {
        const marcaAtual = containerMarca.dataset.marca;
        let marcaTemItensVisiveis = false;
        const marcaPassaFiltro = (filtroAtivoMarca === 'todas' || marcaAtual === filtroAtivoMarca);
        if (marcaPassaFiltro) {
            containerMarca.querySelectorAll('table').forEach(tabelaTipo => {
                const tipoAtual = tabelaTipo.dataset.tipo;
                let tipoTemItensVisiveis = false;
                const tipoPassaFiltro = (filtroAtivoTipo === 'todas' || tipoAtual === filtroAtivoTipo);
                if (tipoPassaFiltro) {
                    tabelaTipo.querySelectorAll('tbody tr').forEach(linha => {
                        const textoLinha = linha.textContent.toUpperCase();
                        if (textoLinha.includes(buscaTexto)) {
                            linha.style.display = "";
                            tipoTemItensVisiveis = true;
                        } else {
                            linha.style.display = "none";
                        }
                    });
                }
                if (tipoTemItensVisiveis) {
                    tabelaTipo.style.display = "";
                    marcaTemItensVisiveis = true;
                } else {
                    tabelaTipo.style.display = "none";
                }
            });
        }
        containerMarca.style.display = marcaTemItensVisiveis ? "" : "none";
    });
}

function handleScroll() {
    if (window.scrollY > 300) {
        backToTopButton.classList.add('visible');
    } else {
        backToTopButton.classList.remove('visible');
    }
}

