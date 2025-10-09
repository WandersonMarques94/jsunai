// VERSÃO COM AUTH0 - FINAL E CORRIGIDA v3

const urlPlanilha = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQn8t8Uk0mXe7dz6Acwn_hs_KWbY4gdLwzg6j190EkTNgI1xfLUiEWVWxzNNARAPlmMwUsO0NwDwEe0/pub?output=csv';

// --- CONFIGURAÇÃO DO AUTH0 (COM O CLIENT ID CORRETO) ---
const auth0Config = {
    domain: "jsunai.us.auth0.com",
    clientId: "TvTxOmzG7Z4kskPYGg4XVapGoKQ9eS1a", // <-- CORRIGIDO
    authorizationParams: {
        redirect_uri: window.location.href.split('?')[0].split('#')[0]
    }
};
let auth0Client = null;

// --- ELEMENTOS DA PÁGINA ---
let loginPrompt, appContent, btnLogin, btnLogout, userNameEl,
    loadingIndicator, backToTopButton, searchInput, brandFiltersContainer,
    typeFiltersContainer, toggleFiltersBtn, collapsibleFilters;

// --- FLUXO PRINCIPAL ---
window.addEventListener('load', async () => {
    initializeDOMElements();
    
    try {
        auth0Client = await auth0.createAuth0Client(auth0Config);

        if (location.search.includes("code=") && location.search.includes("state=")) {
            await auth0Client.handleRedirectCallback();
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        await updateUI();

    } catch (e) {
        console.error("ERRO CRÍTICO NA INICIALIZAÇÃO DO AUTH0:", e);
        loadingIndicator.innerHTML = '<p>Erro na autenticação. Verifique o console (F12) e as configurações do Auth0.</p>';
        loadingIndicator.style.display = 'flex';
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
        }
    } catch (e) {
