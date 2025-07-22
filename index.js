const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({ authStrategy: new LocalAuth() });
const informedClients = new Set();

const WELCOME_DEBOUNCE = 10000;
const pendingWelcomes = {};
const activeSessions = {};
const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutos

const OPTIONS = ['1', '2', '3', '4', '5', '6', '7'];

const MESSAGES = {
	1: `1️⃣ Atendimentos para crianças e adolescentes

Ofereço atendimentos psicológicos voltados para crianças e adolescentes com foco em:

✔ Regulação emocional
✔ Comportamentos desafiadores
✔ Dificuldades escolares
✔ Questões familiares ou sociais
✔ Autoconhecimento e autoestima
✔ Acompanhamento do desenvolvimento
✔ Casos de TEA, TDAH, DI, etc

Os atendimentos são conduzidos com base nas abordagens Comportamental e Cognitivo-Comportamental, por meio de atividades adequadas à idade e objetivos terapêuticos.

📍 Presencial: crianças e adolescentes
💻 Online: apenas adolescentes (a partir de 12 anos, mediante avaliação da disponibilidade e maturidade emocional)`,
	2: `2️ Avaliação psicológica: objetivos, etapas e duração

A avaliação psicológica é indicada quando há necessidade de compreender melhor aspectos emocionais, comportamentais e/ou cognitivos da criança ou adolescente.

👩‍🏫 Pode ser solicitada por escolas, profissionais da saúde ou responsáveis.

A avaliação envolve:
✔ Entrevistas com os responsáveis
✔ Aplicação de testes psicológicos e/ou protocolos avaliativos autorizados pelo CFP
✔ Observações clínicas
✔ Devolutiva com orientações e entrega de relatório, laudo ou parecer psicológico (quando necessário)

A quantidade de sessões varia conforme o caso, mas normalmente envolve de 6 a 12 encontros.`,
	3: `3️ Orientação parental: como funciona e para quem é indicada

A orientação parental é um recurso fundamental para pais e responsáveis que desejam:

👨‍👩‍👧‍👦 Entender melhor o comportamento dos filhos
📚 Aplicar estratégias eficazes de manejo e disciplina
💬 Melhorar a comunicação familiar
🧠 Apoiar o desenvolvimento emocional das crianças e adolescentes

As sessões são conduzidas de forma respeitosa, prática e baseada em evidências. Não se trata de julgamento, e sim de um acolhimento com foco em soluções adaptadas à realidade da sua família.

📍 Disponível presencialmente e online`,
	4: `4️ Agendamento de consultas e disponibilidade

Para agendar uma consulta ou saber sobre os horários disponíveis, basta clicar no link abaixo:
📅 https://calendar.app.google/7GsKGZ6JDTeKuAmK8 

📍 Atendimentos presenciais: 
Av. Baden Powell, 1714 - Jardim Nova Europa, Campinas - SP.
💻 Atendimentos online: horários flexíveis, conforme disponibilidade

⚠ Lembre-se: para confirmar o agendamento, é necessário o pagamento de 50% antecipado, conforme descrito na política de atendimento.`,
	5: `5️ Valores, formas de pagamento e política de cancelamento

💰 Valores por sessão:
• Presencial: R$ 180 (atendimentos para crianças, adolescentes e suas famílias)
• Online: R$ 150 (atendimentos para adolescentes e orientação parental)

Formas de pagamento:
✔ Cartão de crédito ou débito
✔ PIX

Como funciona o pagamento:
🔹 50% no momento da confirmação (enviada 48h antes da consulta)
🔹 50% no dia do atendimento

---

📌 Política de cancelamento e reembolso

• Cancelamentos com mais de 24h de antecedência: o valor pago pode ser reembolsado ou usado no reagendamento.
• Cancelamentos com menos de 24h ou faltas sem aviso: o valor pago não será reembolsado, mas pode ser usado no reagendamento (pagando apenas os outros 50% no novo dia).
• Dois cancelamentos em cima da hora consecutivos: o valor antecipado será perdido e será necessário novo pagamento para reagendar.

Se eu, profissional, precisar cancelar ou reagendar:
✔ O valor pago será reembolsado integralmente ou utilizado em nova data — você escolhe!
✔ Em caso de atraso da minha parte, o tempo será compensado ou avaliaremos ajuste/reembolso justo, se necessário.`,
	6: `6️ Falar diretamente com a profissional (atendimento humano)

Caso deseje conversar comigo diretamente, por favor, envie sua dúvida ou mensagem abaixo.
👩‍⚕ Responderei o mais breve possível, dentro do meu horário de atendimento.

Obrigada pela confiança!`,

	7: 'Sessão encerrada. Obrigado pelo contato! 👋',
};

function getWelcomeMessage(nomeCliente) {
	return `Olá, ${nomeCliente}! Seja muito bem-vindo(a) ao meu canal de atendimento psicológico!
Sou psicóloga infantojuvenil (CRP 06/217225) e meus atendimentos são baseados na Terapia Comportamental e Cognitivo-Comportamental.

✨ Aqui você encontrará acolhimento e escuta qualificada para crianças, adolescentes e famílias, com foco no desenvolvimento emocional e na promoção de bem-estar.

Para facilitar sua experiência, selecione uma das opções abaixo enviando o número correspondente:

1️ Atendimentos para crianças e adolescentes.
2️ Avaliação psicológica: objetivos, etapas e duração.
3️ Orientação parental: como funciona e para quem é indicada.
4️ Agendamento de consultas e disponibilidade.
5️ Valores, formas de pagamento e política de reembolso.
6️  Falar diretamente com a profissional (atendimento humano).

📌 Caso sua dúvida não se encaixe nas opções acima, é só enviar sua mensagem que retornarei o mais breve possível!`;
}

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendReply(message, text, delayMs = 1200) {
	await delay(delayMs);
	await message.reply(text);
}

function endSession(from, message, reason) {
	if (activeSessions[from]) {
		clearTimeout(activeSessions[from]);
		delete activeSessions[from];
	}
	if (reason === 'inactivity') {
		message.reply('Sessão encerrada por inatividade. Até logo! 👋');
	}
}

function startSessionTimeout(from, message) {
	if (activeSessions[from]) clearTimeout(activeSessions[from]);
	activeSessions[from] = setTimeout(() => {
		endSession(from, message, 'inactivity');
	}, SESSION_TIMEOUT);
}

async function handleIncomingMessage(message) {
	const from = message.from;
	const contact = await message.getContact();
	const nomeCliente = contact.pushname || contact.name || 'cliente';
	const body = message.body.trim();

	// Boas-vindas na primeira mensagem
	if (!informedClients.has(from)) {
		informedClients.add(from);
		await sendReply(message, getWelcomeMessage(nomeCliente), WELCOME_DEBOUNCE);
		startSessionTimeout(from, message);
		return;
	}

	// Opção 7: Encerrar atendimento
	if (body === '7') {
		await sendReply(message, MESSAGES[7]);
		endSession(from, message, 'user');
		return;
	}

	// Opção 6: Conversar com atendente
	if (body === '6') {
		await sendReply(message, MESSAGES[6]);
		startSessionTimeout(from, message); // Continua monitorando inatividade após falar com atendente
		return;
	}

	// Outras opções válidas
	if (OPTIONS.includes(body)) {
		await sendReply(message, MESSAGES[body]);
		startSessionTimeout(from, message);
		return;
	}

	// Opção inválida
	await sendReply(message, 'Escolha uma opção (1 à 7)');
	startSessionTimeout(from, message);
}

const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot is running!'));

app.listen(PORT, '0.0.0.0', () => {
	console.log(`HTTP server listening on port ${PORT}`);
});

client.on('qr', (qr) => qrcode.generate(qr, { small: true }));

client.on('ready', () => console.log('Cliente está pronto'));

client.on('message', async (message) => {
	const from = message.from;

	if (pendingWelcomes[from]) clearTimeout(pendingWelcomes[from]);

	pendingWelcomes[from] = await handleIncomingMessage(message);
	delete pendingWelcomes[from];
});

client.initialize();
