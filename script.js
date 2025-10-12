// VERSÃO FINAL COM ORDENAÇÃO CRONOLÓGICA E FILTRO CORRIGIDO

const urlPlanilha = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQn8t8Uk0mXe7dz6Acwn_hs_KWbY4gdLwzg6j190EkTNgI1xfLUiEWVWxzNNARAPlmMwUsO0NwDwEe0/pub?output=csv';

const isDevelopmentMode = window.location.protocol === 'file:';

const auth0Config = {
    domain: "jsunai.us.auth0.com",
    clientId: "TvTxOmzG7Z4kskPYGg4XVapGoKQ9eS1a",
    authorizationParams: {
        redirect_uri: window.location.href.split('?')[0].split('#')[0]
    }
};
let auth0Client = null;

let loginPrompt, appContent, btnLogin, btnLogout, userNameEl,
    loadingIndicator, backToTopButton, searchInput, brandFiltersContainer,
    typeFiltersContainer, toggleFiltersBtn, collapsibleFilters,
    filtroAtivoMarca = 'todas', filtroAtivoTipo = 'todas';

// MAPA DE ORDENAÇÃO CRONOLÓGICA (CORRIGIDO)
const chronologicalSortMap = {
    'G5': 1702, 'G5 PLUS': 1702.1, 'G5S PLUS': 1708, 'G6': 1804, 'G6 PLAY': 1804.1, 'G6 PLUS': 1804.2, 'E5': 1804.3, 'Z PLAY': 1609, 'Z2 PLAY': 1706, 'Z3 PLAY': 1806, 'ONE': 1808, 'G7 PLAY': 1902, 'G7': 1902.1, 'G7 POWER': 1902.2, 'G7 PLUS': 1902.3, 'ONE VISION': 1905, 'ONE ACTION': 1908, 'E6 PLAY': 1910, 'E6 PLUS': 1909, 'G8 PLAY': 1910.1, 'G8 PLUS': 1910.2, 'ONE MACRO': 1910.3, 'G8': 2003, 'G8 POWER': 2002, 'G8 POWER LITE': 2004, 'ONE FUSION': 2006, 'ONE FUSION PLUS': 2006.1, 'ONE HIPER': 1912, 'E6S': 2003.1, 'E6I': 2102, 'G9 PLAY': 2008, 'G9 PLUS': 2009, 'G9 POWER': 2011, 'E7 PLUS': 2009.1, 'E7': 2011.1, 'E7 POWER': 2102.1, 'G10': 2102.2, 'G30': 2102.3, 'G50': 2104, 'G20': 2104.1, 'G60': 2104.2, 'G60S': 2108, 'E20': 2109, 'E30': 2110, 'E40': 2110.1, 'G31': 2111, 'G41': 2111.1, 'G71': 2111.2, 'G22': 2203, 'E32': 2205, 'G42': 2206, 'G52': 2204, 'G62': 2206.1, 'G82': 2205.1, 'EDGE 30': 2204.1, 'EDGE 30 NEO': 2209, 'G13': 2301, 'G23': 2301.1, 'G53': 2301.2, 'G73': 2301.3, 'E13': 2301.4, 'G04': 2402, 'G04S': 2402.1, 'G14': 2308, 'G24': 2401, 'G34': 2312, 'G54': 2309, 'G84': 2309.1,
};

function getSortKey(marca, modelo) {
    let modeloUpper = modelo.toUpperCase();
    if (chronologicalSortMap[modeloUpper]) { return chronologicalSortMap[modeloUpper]; }
    if (marca === 'Apple') {
        const match = modelo.match(/iPhone\s*(\d+|XR|XS|X|SE)/i);
        if (!match) return 9999;
        let coreModel = match[1].toUpperCase();
        const order = {'5S': 5, '6': 6, '6S': 6.5, '7': 7, '8': 8, 'SE': 9, 'X': 10, 'XR': 10.1, 'XS': 10.2, '11': 11, '12': 12, '13': 13, '14': 14 };
        let baseValue = order[coreModel] || (parseInt(coreModel) * 1.0) || 9998;
        if (modelo.toLowerCase().includes('plus')) baseValue += 0.01;
        if (modelo.toLowerCase().includes('pro')) baseValue += 0.02;
        if (modelo.toLowerCase().includes('max')) baseValue += 0.03;
        return baseValue;
    }
    const match = modeloUpper.match(/(\d+)/);
    if (match) { return 1000 + parseInt(match[1]); }
    return 9999;
}

window.addEventListener('load', async () => {
    initializeDOMElements();
    if (isDevelopmentMode) {
        console.warn("MODO DE DESENVOLVIMENTO ATIVADO - LOGIN IGNORADO");
        loginPrompt.style.display = 'none';
        appContent.style.display = 'block';
        loadingIndicator.style.display = 'flex';
        await carregarDados();
        window.addEventListener('scroll', handleScroll);
    } else {
        try {
            auth0Client = await auth0.createAuth0Client(auth0Config);
            if (location.search.includes("code=") && location.search.includes("state=")) {
                await auth0Client.handleRedirectCallback();
                window.history.replaceState({}, document.title, window.location.pathname);
            }
            await updateUI();
        } catch (e) {
            console.error("ERRO CRÍTICO NA INICIALIZAÇÃO DO AUTH0:", e);
            loadingIndicator.innerHTML = '<p>Erro na autenticação. Verifique o console (F12).</p>';
            loadingIndicator.style.display = 'flex';
        }
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
    btnLogin.addEventListener('click', login);
    btnLogout.addEventListener('click', logout);
}

const updateUI = async () => {
    try {
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
    } catch (e) { console.error("ERRO ao atualizar UI:", e); }
};

const login = async () => {
    await auth0Client.loginWithRedirect({ authorizationParams: { ui_locales: 'pt' } });
};

const logout = async () => {
    await auth0Client.logout({ logoutParams: { returnTo: window.location.href.split('?')[0].split('#')[0] } });
};

async function carregarDados() {
    loadingIndicator.style.display = 'flex';
    loadingIndicator.querySelector('p').textContent = 'Carregando lista de preços...';
    try {
        const response = await fetch(urlPlanilha);
        if (!response.ok) throw new Error(`Erro na rede: status ${response.status}`);
        const data = await response.text();
        const itens = processarDados(data);
        renderizarPagina(itens);
        popularFiltros(itens);
        setupEventListeners();
    } catch (error) {
        console.error("ERRO CRÍTICO ao carregar dados:", error);
        loadingIndicator.innerHTML = '<p>Ocorreu um erro ao carregar os dados. Verifique o link da planilha.</p>';
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
        const tipos = Object.keys(porTipo).sort();
        tipos.forEach(tipo => {
            const items = porTipo[tipo];
            items.sort((a, b) => {
                const keyA = getSortKey(marca, a.modelo);
                const keyB = getSortKey(marca, b.modelo);
                if (keyA !== keyB) { return keyA - keyB; }
                return a.modelo.localeCompare(b.modelo);
            });
            const table = document.createElement('table');
            table.dataset.tipo = tipo;
            table.innerHTML = `<thead><tr><th colspan="3" class="tipo-titulo">${tipo}</th></tr><tr><th>Modelo</th><th>Detalhes / Qualidade</th><th>Preço (R$)</th></tr></thead><tbody>${items.map(item => `<tr data-modelo="${item.modelo.toUpperCase()}" data-detalhes="${item.detalhes.toUpperCase()}"><td>${item.modelo}</td><td>${item.detalhes}</td><td>${item.preco}</td></tr>`).join('')}</tbody>`;
            marcaContainer.appendChild(table);
        });
        fragmentoLista.appendChild(marcaContainer);
    });
    containerLista.appendChild(fragmentoLista);
    loadingIndicator.style.display = 'none';
}

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
                        const textoItem = item.textContent.toUpperCase();
                        const passaBusca = textoItem.includes(buscaTexto);
                        if (passaBusca) {
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