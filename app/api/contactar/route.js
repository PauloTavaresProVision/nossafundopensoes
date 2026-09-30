/**
 * POST /api/contactar — pedido de contacto (botão "Quero Ser Contactado").
 * Envia POR EMAIL, do servidor, os contactos e o resumo da simulação para a
 * equipa do Fundo de Pensões da NOSSA Seguros.
 *
 * Configuração por variáveis de ambiente (.env / docker-compose), o mesmo SMTP
 * do simulador de Empregados Domésticos:
 *   SMTP_HOST, SMTP_PORT (587 por omissão; 465 = TLS implícito),
 *   SMTP_USER, SMTP_PASS, SMTP_FROM (remetente),
 *   EMAIL_FUNDOS_PENSOES (destino; por omissão fundos.pensoes@nossaseguros.ao)
 *
 * Nota: o limite de pedidos é em memória, por instância — suficiente para um
 * único contentor. Atrás do reverse proxy, o header X-Forwarded-For tem de ser
 * passado, senão o limite aplica-se globalmente a todos os visitantes.
 */

import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const EMAIL_FUNDOS_PENSOES = process.env.EMAIL_FUNDOS_PENSOES || 'fundos.pensoes@nossaseguros.ao';

const MAX_PEDIDOS = 5;          // pedidos aceites por IP...
const JANELA_MS   = 10 * 60e3;  // ...nesta janela (10 minutos)

const ERRO_GENERICO = 'Não foi possível enviar o pedido. Tente novamente ou ligue para o Contact Center: +244 923 190 860.';

if (!SMTP_HOST) {
  console.warn('[contactar] AVISO: SMTP_HOST não definido — o botão "Quero Ser Contactado" vai responder 503 até o SMTP ser configurado (.env / docker-compose).');
}

const pedidosPorIp = new Map();

function ipDoPedido(request) {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'desconhecido';
}

function excedeuLimite(ip) {
  const agora = Date.now();
  const registos = (pedidosPorIp.get(ip) || []).filter((t) => agora - t < JANELA_MS);
  pedidosPorIp.set(ip, registos);
  return registos.length >= MAX_PEDIDOS;
}

function registarPedido(ip) {
  const registos = pedidosPorIp.get(ip) || [];
  registos.push(Date.now());
  pedidosPorIp.set(ip, registos);
}

function json(corpo, status) {
  return Response.json(corpo, { status });
}

/* aceita 9xx xxx xxx, com ou sem indicativo 244 */
function normalizarTelefone(valor) {
  let d = String(valor || '').replace(/\D/g, '');
  if (d.startsWith('244') && d.length === 12) d = d.slice(3);
  return /^9\d{8}$/.test(d) ? d : null;
}

function emailValido(v) {
  return v.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(v);
}

/* texto livre vindo do browser: uma linha, sem caracteres de controlo, com limite */
function textoSimples(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
}

/* os valores da simulação vêm do browser: aceitam-se só números finitos e são formatados aqui */
function numero(v) {
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) < 1e15 ? n : null;
}
function kz(v) {
  const n = numero(v);
  if (n === null) return '-';
  const partes = n.toFixed(2).split('.');
  return partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + partes[1] + ' Kz';
}
function pct(v) {
  const n = numero(v);
  return n === null ? '-' : String(+(n * 100).toFixed(2)).replace('.', ',') + '%';
}
function inteiro(v) {
  const n = numero(v);
  return n === null ? '-' : String(Math.round(n));
}

export async function POST(request) {
  const ip = ipDoPedido(request);
  if (excedeuLimite(ip)) {
    return json({ sucesso: false, mensagem: 'Demasiados pedidos. Tente novamente mais tarde ou ligue para o Contact Center: +244 923 190 860.' }, 429);
  }

  let corpo;
  try { corpo = await request.json(); }
  catch { return json({ sucesso: false, mensagem: 'Pedido inválido.' }, 400); }

  const nome = textoSimples(corpo.nome, 100);
  if (!nome) return json({ sucesso: false, mensagem: 'Indique um nome válido.' }, 422);

  const telefone = normalizarTelefone(corpo.telefone);
  if (!telefone) return json({ sucesso: false, mensagem: 'Indique um telefone válido (9 dígitos, começado por 9).' }, 422);

  const email = textoSimples(corpo.email, 254);
  if (!emailValido(email)) return json({ sucesso: false, mensagem: 'Indique um email válido.' }, 422);

  if (!SMTP_HOST) return json({ sucesso: false, mensagem: 'Serviço temporariamente indisponível.' }, 503);

  const s = corpo.simulacao && typeof corpo.simulacao === 'object' ? corpo.simulacao : {};
  const particular = s.versao === 'particular';
  const produto = particular ? 'Fundo de Pensões - Particulares' : 'Fundo de Pensões Complementar';
  const dataNasc = /^\d{4}-\d{2}-\d{2}$/.test(String(s.nascimento || '')) ? s.nascimento.split('-').reverse().join('/') : '-';
  const telFormatado = '(+244) ' + telefone.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');

  const linhas = [
    'Pedido de contacto recebido através do simulador do ' + produto + (s.comercial ? ' (versão comercial)' : '') + '.',
    '',
    'CONTACTOS',
    'Nome: ' + nome,
    'Telefone: ' + telFormatado,
    'Email: ' + email,
    '',
    'SIMULAÇÃO',
    'Data de nascimento: ' + dataNasc + ' (' + inteiro(s.idade) + ' anos)',
  ];
  if (particular) {
    linhas.push(
      'Contribuição mensal: ' + kz(s.contribMensal),
      'Aumento anual da contribuição: ' + pct(s.crescimento)
    );
  } else {
    linhas.push(
      'Salário mensal: ' + kz(s.salario),
      'Contribuição do colaborador: ' + pct(s.pctColab),
      'Contribuição voluntária mensal: ' + kz(s.voluntaria),
      'Total da contribuição mensal: ' + kz(s.contribMensal)
    );
  }
  linhas.push(
    'Anos de contribuição até à reforma: ' + inteiro(s.anos),
    'Valor acumulado na reforma: ' + kz(s.acumulado),
    'Pensão mensal estimada: ' + kz(s.pensao)
  );

  const p = s.pressupostos && typeof s.pressupostos === 'object' ? s.pressupostos : {};
  linhas.push('', 'PRESSUPOSTOS');
  if (!particular) {
    linhas.push(
      'Contribuição da empresa: ' + pct(p.CONTRIB_EMPRESA),
      'Crescimento salarial: ' + pct(p.CRESCIMENTO_SALARIAL),
      'Salários por ano: ' + inteiro(p.SALARIOS_ANO)
    );
  }
  linhas.push(
    'Rentabilidade: ' + pct(p.RENTABILIDADE),
    'Idade de reforma: ' + inteiro(p.IDADE_REFORMA),
    'Factor de conversão: ' + textoSimples(numero(p.FACTOR_CONVERSAO) ?? '-', 10),
    'Crescimento da pensão: ' + pct(p.CRESCIMENTO_PENSAO)
  );

  try {
    const transporte = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
      /* sem timeouts, uma porta SMTP bloqueada deixa o pedido pendurado */
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });

    await transporte.sendMail({
      from: SMTP_FROM,
      to: EMAIL_FUNDOS_PENSOES,
      replyTo: email,
      subject: 'Pedido de Contacto - ' + produto + ' - ' + nome,
      text: linhas.join('\n'),
    });

    /* conta para o limite apenas quando o email sai */
    registarPedido(ip);
    return json({ sucesso: true, mensagem: 'Pedido enviado com sucesso.' }, 200);
  } catch (erro) {
    console.error('[contactar] falha no envio do email:', erro && erro.message ? erro.message : erro);
    return json({ sucesso: false, mensagem: ERRO_GENERICO }, 502);
  }
}
