import config from '../config';

function authHeaders() {
	const token = localStorage.getItem('token');
	const headers = {};
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
}

async function consultarProvimentos({ pergunta }) {
	const body = { pergunta };
	const resp = await fetch(`${config.apiURL}/ia/consulta-provimento`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...authHeaders() },
		body: JSON.stringify(body)
	});

	const text = await resp.text();
	let json = null;
	try { json = text ? JSON.parse(text) : null; } catch (_) { json = null; }

	if (!resp.ok) {
		const msg = json?.error || json?.mensagem || text || 'Falha ao consultar provimentos';
		const err = new Error(msg);
		err.detail = json?.detail || null;
		err.logs = json?.logs || [];
		throw err;
	}

	return json || {};
}

const IAAgentService = { consultarProvimentos };
export default IAAgentService;
