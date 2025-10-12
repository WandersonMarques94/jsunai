// --- CONFIGURAÇÕES GERAIS ---

// Ligo/desligo o aviso de "lista desatualizada" aqui. (1 = LIGADO, 0 = DESLIGADO)
const avisoAtivado = 1;

// Link da minha planilha de preços.
const urlPlanilha = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQn8t8Uk0mXe7dz6Acwn_hs_KWbY4gdLwzg6j190EkTNgI1xfLUiEWVWxzNNARAPlmMwUsO0NwDwEe0/pub?output=csv';

// Modo DEV para pular o login em testes locais.
const isDevelopmentMode = window.location.protocol === 'file:';

// Minha config do Auth0.
const auth0Config = {
    domain: "jsunai.us.auth0.com",
    clientId: "TvTxOmzG7Z4kskPYGg4XVapGoKQ9eS1a",
    authorizationParams: {
        redirect_uri: window.location.href.split('?')[0].split('#')[0]
    }
};

// --- VARIÁVEIS GLOBAIS ---
let auth0Client = null;
let loginPrompt, appContent, btnLogin, btnLogout, userNameEl,
    loadingIndicator, backToTopButton, searchInput, brandFiltersContainer,
    typeFiltersContainer, toggleFiltersBtn, collapsibleFilters,
    filtroAtivoMarca = 'todas', filtroAtivoTipo = 'todas';


// --- INICIALIZAÇÃO DA PÁGINA ---

window.addEventListener('load', async () => {
    initializeDOMElements();

    if (isDevelopmentMode) {
        // Se estou no meu PC, pulo o login.
        console.warn("MODO DE DESENVOLVIMENTO ATIVADO");
        loginPrompt.style.display = 'none';
        appContent.style.display = 'block';
        loadingIndicator.style.display = 'flex';
        await carregarDados();
        window.addEventListener('scroll', handleScroll);
    } else {
        // Se o site está online, executo o fluxo normal de login.
        try {
            auth0Client = await auth0.createAuth0Client(auth0Config);
            if (location.search.includes("code=") && location.search.includes("state=")) {
                await auth0Client.handleRedirectCallback();
                window.history.replaceState({}, document.title, window.location.pathname);
            }
            await updateUI();
        } catch (e) {
            console.error("ERRO NO AUTH0:", e);
            loadingIndicator.innerHTML = '<p>Erro na autenticação.</p>';
        }
    }
});


// --- LÓGICA DE AUTENTICAÇÃO E UI ---

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
    
    btnLogin.addEventListener('click', login);
    btnLogout.addEventListener('click', logout);
}

const updateUI = async () => {
    const isAuthenticated = await auth0Client.isAuthenticated();
    if (isAuthenticated) {
        loginPrompt.style.display = 'none';
        appContent.style.display = 'block';
        const user = await auth0Client.getUser();
        userNameEl.textContent = user.name || user.email;
        await carregarDados();
        window.addEventListener('scroll', handleScroll);
    } else {
        loginPrompt.style.display = 'flex';
        appContent.style.display = 'none';
        loadingIndicator.style.display = 'none';
        document.getElementById('login-prompt').classList.add('show');
    }
};

const login = async () => {
    await auth0Client.loginWithRedirect({ authorizationParams: { ui_locales: 'pt' } });
};

const logout = async () => {
    await auth0Client.logout({ logoutParams: { returnTo: window.location.href.split('?')[0].split('#')[0] } });
};


// --- LÓGICA DE DADOS E RENDERIZAÇÃO ---

async function carregarDados() {
    if (avisoAtivado === 1 && !isDevelopmentMode) {
        document.getElementById('update-banner').style.display = 'block';
    }
    loadingIndicator.style.display = 'flex';
    loadingIndicator.querySelector('p').textContent = 'Carregando lista de preços...';
    try {
        const response = await fetch(urlPlanilha);
        if (!response.ok) throw new Error(`Erro na rede: ${response.status}`);
        const data = await response.text();
        const itens = processarDados(data);
        renderizarPagina(itens);
        popularFiltros(itens);
        setupEventListeners();
    } catch (error) {
        console.error("ERRO AO CARREGAR DADOS:", error);
        loadingIndicator.innerHTML = '<p>Ocorreu um erro ao carregar os dados.</p>';
    }
}

function processarDados(csvData) {
    const linhas = csvData.trim().split(/\r?\n/).slice(1); // Pula o cabeçalho
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
    }).filter(item => item && item.marca && item.modelo);
}

function renderizarPagina(itens) {
    const containerLista = document.getElementById('lista-container');
    containerLista.innerHTML = '';
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
        const tipos = Object.keys(porTipo).sort();

        tipos.forEach(tipo => {
            const items = porTipo[tipo];
            
            // Lógica de ordenação: exceção para Apple, "natural" para os outros para corrigir o bug do G5 vs G10.
            items.sort((a, b) => {
                if (marca === 'Apple') {
                    return getIphoneSortKey(a.modelo) - getIphoneSortKey(b.modelo);
                }
                return a.modelo.localeCompare(b.modelo, 'pt-BR', { numeric: true, sensitivity: 'base' });
            });

            const table = document.createElement('table');
            table.dataset.tipo = tipo;
            table.innerHTML = `<thead><tr><th colspan="3" class="tipo-titulo">${tipo}</th></tr><tr><th>Modelo</th><th>Detalhes / Qualidade</th><th>Preço</th></tr></thead><tbody>${items.map(item => `<tr><td>${item.modelo}</td><td>${item.detalhes}</td><td>R$ ${item.preco}</td></tr>`).join('')}</tbody>`;
            marcaContainer.appendChild(table);
        });
        containerLista.appendChild(marcaContainer);
    });
    loadingIndicator.style.display = 'none';
}

// Exceção para iPhones, que não seguem ordem numérica simples (X, XR, XS, etc).
function getIphoneSortKey(modelo) {
    const match = modelo.match(/iPhone\s*(\d+|XR|XS|X|SE)/i);
    if (!match) return 999;
    let coreModel = match[1].toUpperCase();
    const order = {'6': 6, '6S': 6.5, '7': 7, '8': 8, 'SE': 9, 'X': 10, 'XR': 10.1, 'XS': 10.2, '11': 11, '12': 12, '13': 13, '14': 14 };
    let baseValue = order[coreModel] || parseInt(coreModel) || 998;
    if (modelo.toLowerCase().includes('plus')) baseValue += 0.01;
    if (modelo.toLowerCase().includes('pro')) baseValue += 0.02;
    if (modelo.toLowerCase().includes('max')) baseValue += 0.03;
    return baseValue;
}


// --- FILTROS E EVENTOS ---

function popularFiltros(itens) {
    const marcasUnicas = [...new Set(itens.map(item => item.marca))];
    const marcas = ['todas', ...marcasUnicas.sort()];
    const tiposUnicos = [...new Set(itens.map(item => item.tipo))];
    const tipos = ['todas', ...tiposUnicos.sort()];
    brandFiltersContainer.innerHTML = marcas.map(marca => `<button class="filter-pill ${marca === 'todas' ? 'active' : ''}" data-filter="${marca}">${marca === 'todas' ? 'Todas as Marcas' : marca}</button>`).join('');
    typeFiltersContainer.innerHTML = tipos.map(tipo => `<button class="filter-pill ${tipo === 'todas' ? 'active' : ''}" data-filter="${tipo}">${tipo === 'todas' ? 'Todos os Tipos' : tipo}</button>`).join('');
}

function setupEventListeners() {
    toggleFiltersBtn.addEventListener('click', () => {
        toggleFiltersBtn.classList.toggle('open');
        collapsibleFilters.classList.toggle('open');
    });
    brandFiltersContainer.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        filtroAtivoMarca = e.target.dataset.filter;
        brandFiltersContainer.querySelector('.active')?.classList.remove('active');
        e.target.classList.add('active');
        aplicarTodosOsFiltros();
    });
    typeFiltersContainer.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        filtroAtivoTipo = e.target.dataset.filter;
        typeFiltersContainer.querySelector('.active')?.classList.remove('active');
        e.target.classList.add('active');
        aplicarTodosOsFiltros();
    });
    searchInput.addEventListener('keyup', aplicarTodosOsFiltros);
}

function aplicarTodosOsFiltros() {
    const buscaTexto = searchInput.value.toUpperCase();
    document.querySelectorAll('.marca-container').forEach(marcaContainer => {
        const marcaAtual = marcaContainer.dataset.marca;
        const passaFiltroMarca = (filtroAtivoMarca === 'todas' || marcaAtual === filtroAtivoMarca);
        let marcaTemItensVisiveis = false;
        if (passaFiltroMarca) {
            marcaContainer.querySelectorAll('table').forEach(tabela => {
                const tipoAtual = tabela.dataset.tipo;
                const passaFiltroTipo = (filtroAtivoTipo === 'todas' || tipoAtual === filtroAtivoTipo);
                let tipoTemItensVisiveis = false;
                if (passaFiltroTipo) {
                    tabela.querySelectorAll('tbody tr').forEach(item => {
                        if (item.textContent.toUpperCase().includes(buscaTexto)) {
                            item.style.display = "";
                            tipoTemItensVisiveis = true;
                        } else {
                            item.style.display = "none";
                        }
                    });
                }
                if (tipoTemItensVisiveis) {
                    tabela.style.display = "";
                    marcaTemItensVisiveis = true;
                } else {
                    tabela.style.display = "none";
                }
            });
        }
        marcaContainer.style.display = marcaTemItensVisiveis ? "" : "none";
    });
}

function handleScroll() {
    if (window.scrollY > 300) {
        backToTopButton.classList.add('visible');
    } else {
        backToTopButton.classList.remove('visible');
    }
}