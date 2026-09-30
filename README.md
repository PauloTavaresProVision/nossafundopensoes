# Simulador do Fundo de Pensões Complementar — NOSSA Seguros

Aplicação Next.js que serve o simulador (página estática em `public/index.html`),
com a mesma identidade visual do simulador de Empregados Domésticos.

## Versões

Todas as versões são a mesma página (`public/index.html`); a versão é escolhida pelo caminho.

| Caminho | Produto | Pressupostos |
|---|---|---|
| `/` | Fundo de Pensões Complementar (empresa) | fixos |
| `/comercial` | Fundo de Pensões Complementar (empresa) | editáveis cliente a cliente |
| `/particulares` | Particulares (contribuição fixa, mínimo 10 000 Kz/mês) | fixos |
| `/particulares/comercial` | Particulares | editáveis cliente a cliente |

As versões comerciais não são indexadas pelos motores de busca (`X-Robots-Tag: noindex`),
mas não têm senha: quem tiver o link acede.

## Modelo de cálculo (base: Excel "Fundo de Pensões Complementar - Simulador", 29/09/2026)

Pressupostos (constante `PADRAO` no `<script>` de `public/index.html`):

| Pressuposto | Valor |
|---|---|
| Contribuição do colaborador | escolhida pelo participante, 3% a 30% (por omissão 3%) |
| Contribuição da empresa | 5% do salário |
| Taxa de rentabilidade | 12% / ano |
| Taxa de crescimento salarial | 5% / ano |
| Salários por ano | 12 |
| Idade de reforma | 60 |
| Factor de conversão | 11 (pensão = VA / 11 / 12) |
| Crescimento anual da pensão | 0% (campo preparado; só aparece na versão pública se for diferente de 0) |
| Pensão mínima legal | 100 000 Kz/mês (alerta abaixo deste valor) |

Cálculo:

- Idade = anos completos à data de hoje; `n = 60 − idade`.
- Contribuição mensal = salário × (3% + 5%) + contribuição voluntária.
- Contribuição anual do ano `k` (k = 0..n−1) = mensal × 12 × (1,05)^k, entregue no início do ano.
- Saldo no fim de cada ano = (saldo anterior + contribuição do ano) × 1,12.
- Pensão mensal = valor acumulado / 11 / 12.
- As contribuições começam na data da simulação; a tabela anual mostra o período de cada ano.
- Opções na reforma: 100% em pensão, ou 50% em capital + pensão sobre os outros 50%.
- Crescimento da pensão `g`: o factor F é o n.º de anos de pensão; pensão inicial anual =
  VA / [((1+g)^F − 1) / g] (com g = 0 fica VA / F).
- Pensão abaixo de 100 000 Kz: alerta com a contribuição necessária (a pensão é proporcional
  à contribuição mensal): % do colaborador (se ≤ 30%), contribuição voluntária adicional,
  ou, nos particulares, a nova contribuição mensal.
- Particulares: contribuição mensal fixa (mínimo 10 000 Kz), com aumento anual opcional
  escolhido pelo cliente (0% a 20%); sem contribuição da empresa nem crescimento salarial.

### Diferenças face ao Excel original

O Excel usava `VA = CA × (1+tr) × [1 − ((1+tr)(1+tcs))^(n−1)] / [1 − (1+tr)(1+tcs)]`,
que compõe a rentabilidade e o crescimento salarial num só factor e conta `n−1` anos,
e calculava a idade com `ROUNDUP((HOJE−nasc)/365)`.

Confirmado pela NOSSA (Albertina Napita, 29/09/2026): empresa 5%, pressupostos
financeiros fixos, factor de conversão 11 igual para todos, fórmula corrigida
aprovada, simulador para uso interno e externo (site público).

Confirmado (30/09/2026): contribuições desde a data da simulação, pensão mínima legal de
100 000 Kz, % do colaborador variável, crescimento da pensão como campo aberto (sem taxa
por agora), particulares com mínimo de 10 000 Kz/mês e aumento à escolha do cliente.

Pendente: limites da % do colaborador (assumido 3% a 30%), se os particulares usam os
mesmos pressupostos (12%, reforma aos 60, factor 11) e se a voluntária cresce com o
salário (hoje cresce, como no Excel).

## Pedido de contacto (botão "Quero Ser Contactado")

Nome, telefone e email são obrigatórios para ver a simulação. O botão abre um pop-up de
confirmação e envia, pelo servidor (`POST /api/contactar`), um email para
**fundos.pensoes@nossaseguros.ao** com os contactos e o resumo da simulação (Reply-To = email
do cliente). Usa o mesmo SMTP do simulador de Empregados Domésticos.

- O servidor revalida nome, telefone (9 dígitos começado por 9, aceita 244) e email.
- Os valores da simulação vêm do browser: só são aceites números, formatados no servidor.
- Limite de 5 pedidos enviados por IP a cada 10 minutos (o proxy tem de passar `X-Forwarded-For`).
- Sem `SMTP_HOST`, o botão responde "Serviço temporariamente indisponível".

## Deploy com Docker

Primeira instalação no servidor:

```bash
git clone https://github.com/PauloTavaresProVision/nossafundopensoes.git
cd nossafundopensoes
cp .env.example .env
nano .env            # SMTP_* iguais aos do simulador de Empregados Domésticos
docker compose up -d --build
curl -I http://localhost:6511/
```

Actualizar depois de novos commits:

```bash
cd nossafundopensoes
git pull
docker compose up -d --build
```

O serviço fica em `127.0.0.1:6511` (apenas localhost). O acesso público faz-se pelo
reverse proxy, que trata o TLS. Exemplo nginx:

```nginx
location / {
    proxy_pass http://127.0.0.1:6511;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

As credenciais SMTP ficam só no `.env` do servidor (nunca no GitHub). Não há volumes: nada é guardado no disco.

## Desenvolvimento local

```bash
npm install
npm run dev   # http://localhost:3000
```

Ou, sem Node, servir só a página estática: `python -m http.server 6512 --directory public`.
