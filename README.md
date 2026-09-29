# Simulador do Fundo de Pensões Complementar — NOSSA Seguros

Aplicação Next.js que serve o simulador (página estática em `public/index.html`),
com a mesma identidade visual do simulador de Empregados Domésticos.

## Modelo de cálculo (base: Excel "Fundo de Pensões Complementar - Simulador", 29/09/2026)

Pressupostos (constante `P` no `<script>` de `public/index.html`):

| Pressuposto | Valor |
|---|---|
| Contribuição do colaborador | 3% do salário |
| Contribuição da empresa | 5% do salário |
| Taxa de rentabilidade | 12% / ano |
| Taxa de crescimento salarial | 5% / ano |
| Salários por ano | 12 |
| Idade de reforma | 60 |
| Factor de conversão | 11 (pensão = VA / 11 / 12) |

Cálculo:

- Idade = anos completos à data de hoje; `n = 60 − idade`.
- Contribuição mensal = salário × (3% + 5%) + contribuição voluntária.
- Contribuição anual do ano `k` (k = 0..n−1) = mensal × 12 × (1,05)^k, entregue no início do ano.
- Saldo no fim de cada ano = (saldo anterior + contribuição do ano) × 1,12.
- Pensão mensal = valor acumulado / 11 / 12.

### Diferenças face ao Excel original

O Excel usava `VA = CA × (1+tr) × [1 − ((1+tr)(1+tcs))^(n−1)] / [1 − (1+tr)(1+tcs)]`,
que compõe a rentabilidade e o crescimento salarial num só factor e conta `n−1` anos,
e calculava a idade com `ROUNDUP((HOJE−nasc)/365)`.

Confirmado pela NOSSA (Albertina Napita, 29/09/2026): empresa 5%, pressupostos
financeiros fixos, factor de conversão 11 igual para todos, fórmula corrigida
aprovada, simulador para uso interno e externo (site público).

Pendente: o que acontece depois da simulação (só PDF, pedido de contacto, email) e
se a voluntária cresce com o salário (hoje cresce, como no Excel).

## Deploy com Docker

Primeira instalação no servidor:

```bash
git clone https://github.com/PauloTavaresProVision/nossafundopensoes.git
cd nossafundopensoes
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

Não há variáveis de ambiente nem volumes: a página é estática e não guarda dados.

## Desenvolvimento local

```bash
npm install
npm run dev   # http://localhost:3000
```

Ou, sem Node, servir só a página estática: `python -m http.server 6512 --directory public`.
